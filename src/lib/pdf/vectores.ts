/**
 * Encontrar las infografías que el PDF dibuja con trazos y no con píxeles.
 *
 * Este módulo existe por una falla que no se veía. Las páginas 6 y 7 del número
 * de agosto llevan cada una una infografía grande —«67 plazas», «+50 árboles
 * nuevos», una ilustración de una plaza y rótulos con líneas de llamada— y en el
 * diario web no aparecía **nada** de eso: las notas quedaban con seis fotos y se
 * acabó. Medido con pdf.js sobre el archivo real, la página 6 devuelve 11 ítems
 * de texto y ninguno es de la infografía, y la 7 devuelve 7, que son los
 * epígrafes de las fotos. Los números, los rótulos, las líneas y el dibujo son
 * **arte vectorial con el texto pasado a curvas**: no existen como texto en
 * ninguna capa, así que ningún ajuste del clasificador los podía recuperar.
 *
 * Los dos extractores —el script de consola y el del panel— sólo miraban
 * `paintImageXObject`. Lo único que rescataban de esa franja era la ilustración
 * de fondo, que sí es un mapa de bits, y sale desvaída y decapitada: el dibujo
 * sin una sola de sus cifras.
 *
 * La salida de acá es una lista de **zonas para rasterizar**: rectángulos de la
 * página que hay que renderizar y guardar como una figura más. Quién los
 * renderiza y dónde los guarda es problema de cada extractor —uno escribe a
 * disco y el otro sube al bucket—; lo que **no** puede diferir entre los dos es
 * qué se considera una infografía, y por eso esa decisión vive en un solo lugar.
 *
 * Es puro a propósito: no importa pdf.js ni Node. Los códigos de operador
 * entran por parámetro.
 */

/** Una caja en puntos, medida desde arriba a la izquierda de la página. */
export interface CajaPagina {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/** Una imagen ya ubicada en la página, con el nombre que le da el PDF. */
export interface ImagenUbicada extends CajaPagina {
  id: string;
}

/** Una zona de arte vectorial que vale la pena rescatar. */
export interface ZonaVectorial extends CajaPagina {
  /** Cuántos trazos la forman. Va al informe: es el número que explica por qué
   *  una zona pasó el filtro y otra no. */
  trazos: number;
  /** Las imágenes que quedaron adentro. Son capas de esta misma infografía —la
   *  ilustración de fondo— y no figuras por su cuenta: quien llame tiene que
   *  saltearlas para no publicar dos veces el mismo dibujo. */
  absorbidas: string[];
}

/** Los códigos de operador de pdf.js que hacen falta acá. Entran por parámetro
 *  para que este módulo no importe el paquete y siga siendo puro. */
export interface CodigosDeOperador {
  save: number;
  restore: number;
  transform: number;
  constructPath: number;
  endPath: number;
  paintFormXObjectBegin: number;
  paintFormXObjectEnd: number;
}

/** La lista de operadores tal como la devuelve `page.getOperatorList()`. */
export interface ListaDeOperadores {
  fnArray: ArrayLike<number>;
  argsArray: ArrayLike<unknown>;
}

/** Un pedazo de texto de la página, con dónde empieza. Alcanza con eso: sólo se
 *  usa para saber cuánto texto cae adentro de una zona. */
export interface TextoUbicado {
  x: number;
  /** Puntos desde el borde **superior**, igual que en `estructura.ts`. */
  y: number;
  texto: string;
}

/**
 * Cuánto de la página tiene que ocupar el arte para ser una infografía.
 *
 * Es el umbral que separa un dibujo de un adorno, y está medido contra el
 * número de agosto, no elegido de arriba. Las dos infografías reales ocupan el
 * **35,9%** de su página cada una. Lo más grande que dibuja el vector fuera de
 * ellas es la tira de tres mapas de la página 2, con el 17,7%. Un cuarto de
 * página queda cómodo en el medio de esos dos números y se dice en castellano:
 * una infografía es algo que el lector mira como una pieza, no una viñeta.
 *
 * Es a propósito que la tira de mapas de la página 2 quede afuera. Ahí el texto
 * de la página **sí** cuenta lo que el mapa muestra, y esa página ya sale
 * entera; acá el criterio es no cambiar en silencio las siete páginas que hoy
 * salen bien para arreglar dos. Si algún día se quiere rescatar también eso, el
 * número a mover es éste y hay que volver a mirar las ocho páginas.
 */
const PARTE_MINIMA_DE_LA_PAGINA = 0.25;

/**
 * Cuántos trazos hacen falta para que una mancha sea un dibujo.
 *
 * Éste es el filtro que saca la mueblería, y hace falta porque el tamaño solo
 * no alcanza: el recuadro de datos de la página 5 mide el 27,2% de la página
 * —pasa el umbral de arriba— y es **un solo trazo**, un rectángulo. Lo mismo el
 * marco de la ficha de la página 3 y el filete de la bandera de la tapa. Un
 * filete, un borde, un marco o un subrayado son de uno a cinco trazos; las dos
 * infografías de agosto tienen 171 y 186.
 */
const TRAZOS_MINIMOS = 12;

/**
 * Cuán apaisada puede ser una zona.
 *
 * Un filete a lo ancho de la página es larguísimo y de dos puntos de alto; un
 * dibujo tiene dos dimensiones. Las infografías de agosto dan 0,56 (800×450) y
 * la bandera de la tapa 0,14 (757×108).
 */
const PROPORCION_MINIMA = 0.2;

/**
 * Cuánto pueden separarse dos trazos y seguir siendo el mismo dibujo.
 *
 * Una infografía llega como cientos de trazos sueltos —cada letra pasada a
 * curvas es uno— y hay que volver a juntarlos. 14 puntos es un poco más que el
 * blanco entre una cifra y su rótulo, y bastante menos que la calle entre la
 * infografía y las fotos que tiene arriba, que en las dos páginas es de más de
 * 100 puntos.
 */
const HUECO_ENTRE_TRAZOS = 14;

/**
 * Cuánto de una imagen tiene que caer dentro de la zona para ser una capa suya.
 *
 * La ilustración de la plaza es un mapa de bits que ocupa toda la franja, y el
 * arte vectorial está dibujado encima. Sin esto se publicaban las dos cosas: la
 * infografía completa y, aparte, el mismo dibujo desvaído y sin sus cifras.
 * La mitad alcanza y sobra: en agosto las ilustraciones caen adentro en un 86%
 * y las fotos de la misma página, en 0%.
 */
const PARTE_ABSORBIDA_DE_LA_IMAGEN = 0.5;

/**
 * Cuánto texto puede haber adentro de una zona.
 *
 * Una infografía trae rótulos o ninguna palabra —ése es justamente el
 * problema— y una columna de diario trae párrafos. El número es el mismo 400
 * con el que `estructura.ts` decide si una página es prosa o es gráfica, y por
 * el mismo motivo: «400 caracteres son unas seis líneas de columna; por debajo
 * de eso no hay un texto que leer, hay rótulos».
 *
 * Es una red de contención, no el criterio principal: existe para que un trazo
 * perdido que una dos manchas lejanas no termine convirtiendo media página de
 * texto en una foto ilegible. Las zonas de agosto tienen 0 y 75 caracteres.
 */
const CARACTERES_MAXIMOS = 400;

/** Multiplica dos matrices de transformación del PDF. */
function componer(m: number[], o: number[]): number[] {
  return [
    m[0] * o[0] + m[2] * o[1],
    m[1] * o[0] + m[3] * o[1],
    m[0] * o[2] + m[2] * o[3],
    m[1] * o[2] + m[3] * o[3],
    m[0] * o[4] + m[2] * o[5] + m[4],
    m[1] * o[4] + m[3] * o[5] + m[5],
  ];
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const areaDe = (r: Rect) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0);

/** Cuánto se pisan dos cajas, en puntos cuadrados. */
function interseccion(a: Rect, b: Rect): number {
  return (
    Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
    Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))
  );
}

const comoRect = (c: CajaPagina): Rect => ({
  x0: c.x,
  y0: c.y,
  x1: c.x + c.ancho,
  y1: c.y + c.alto,
});

/**
 * Dónde cae, en la página, el trazo que se acaba de construir.
 *
 * `constructPath` trae la caja del trazo en el espacio del usuario —el tercer
 * argumento, `[minX, minY, maxX, maxY]`— y hay que pasarla por la matriz de
 * transformación que se viene acumulando, que es lo único que sabe dónde quedó
 * puesto. Se transforman las **cuatro esquinas** y no dos: con una rotación o
 * un espejo, la esquina de arriba a la izquierda deja de estar arriba a la
 * izquierda.
 *
 * Después se recorta contra la página. Un PDF de imprenta dibuja fuera del
 * papel —en las páginas 6 y 7 hay trazos a 800 puntos del borde, tapados por un
 * recorte— y sin esto la envolvente del dibujo se iba al doble de la hoja.
 */
function cajaDelTrazo(
  m: number[],
  minMax: number[],
  ancho: number,
  alto: number,
): Rect | null {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [px, py] of [
    [minMax[0], minMax[1]],
    [minMax[2], minMax[1]],
    [minMax[0], minMax[3]],
    [minMax[2], minMax[3]],
  ]) {
    xs.push(m[0] * px + m[2] * py + m[4]);
    ys.push(m[1] * px + m[3] * py + m[5]);
  }
  const caja = {
    x0: Math.max(0, Math.min(...xs)),
    x1: Math.min(ancho, Math.max(...xs)),
    // El PDF mide desde abajo; acá se lee de arriba hacia abajo.
    y0: Math.max(0, alto - Math.max(...ys)),
    y1: Math.min(alto, alto - Math.min(...ys)),
  };
  if (caja.x1 <= caja.x0 || caja.y1 <= caja.y0) return null;
  return caja;
}

/**
 * Junta los trazos sueltos en manchas.
 *
 * Une de a dos y vuelve a empezar hasta que no queda nada por unir. Es
 * cuadrático y no importa: una página del diario trae menos de 250 trazos.
 */
function agruparEnManchas(trazos: Rect[]): (Rect & { trazos: number })[] {
  const manchas: (Rect & { trazos: number })[] = trazos.map((t) => ({
    ...t,
    trazos: 1,
  }));

  for (let hubo = true; hubo; ) {
    hubo = false;
    for (let i = 0; i < manchas.length; i++) {
      const a = manchas[i];
      for (let j = i + 1; j < manchas.length; j++) {
        const b = manchas[j];
        const cerca =
          a.x0 - HUECO_ENTRE_TRAZOS < b.x1 &&
          b.x0 - HUECO_ENTRE_TRAZOS < a.x1 &&
          a.y0 - HUECO_ENTRE_TRAZOS < b.y1 &&
          b.y0 - HUECO_ENTRE_TRAZOS < a.y1;
        if (!cerca) continue;
        a.x0 = Math.min(a.x0, b.x0);
        a.y0 = Math.min(a.y0, b.y0);
        a.x1 = Math.max(a.x1, b.x1);
        a.y1 = Math.max(a.y1, b.y1);
        a.trazos += b.trazos;
        manchas.splice(j, 1);
        j--;
        hubo = true;
      }
    }
  }
  return manchas;
}

/**
 * Las infografías vectoriales de una página, listas para rasterizar.
 *
 * Recorre la lista de operadores llevando la matriz de transformación —igual
 * que hace el extractor para las imágenes, y por lo mismo: el operador dice
 * *qué* se dibuja y la matriz *dónde*—, junta los trazos en manchas y devuelve
 * las que pasan el filtro. Casi siempre no devuelve ninguna: de las ocho
 * páginas de agosto, seis no tienen infografía vectorial y no la inventan.
 */
export function zonasDeInfografia(opciones: {
  operadores: ListaDeOperadores;
  OPS: CodigosDeOperador;
  ancho: number;
  alto: number;
  /** Las imágenes que el extractor ya decidió publicar. */
  imagenes: ImagenUbicada[];
  /** El texto de la página, para no rasterizar prosa. */
  textos: TextoUbicado[];
}): ZonaVectorial[] {
  const { operadores, OPS, ancho, alto, imagenes, textos } = opciones;

  /* ------------------------------------------------- dónde está cada trazo */

  const trazos: Rect[] = [];
  let matriz = [1, 0, 0, 1, 0, 0];
  const pila: number[][] = [];

  for (let i = 0; i < operadores.fnArray.length; i++) {
    const op = operadores.fnArray[i];
    const args = operadores.argsArray[i] as unknown[];
    if (op === OPS.save) {
      pila.push(matriz);
    } else if (op === OPS.restore) {
      matriz = pila.pop() ?? matriz;
    } else if (op === OPS.transform) {
      matriz = componer(matriz, args as unknown as number[]);
    } else if (op === OPS.paintFormXObjectBegin) {
      // Un objeto de formulario trae su propia matriz y abre un nivel. El
      // extractor de imágenes no los mira porque las fotos de este diario van
      // sueltas; el arte vectorial sí viene adentro de uno.
      pila.push(matriz);
      matriz = componer(matriz, args[0] as number[]);
    } else if (op === OPS.paintFormXObjectEnd) {
      matriz = pila.pop() ?? matriz;
    } else if (op === OPS.constructPath) {
      // `endPath` es el trazo que sólo recorta: no pinta nada y no es dibujo.
      if (args[0] === OPS.endPath) continue;
      const minMax = args[2] as number[] | undefined;
      // Sin caja no se puede ubicar. pdf.js la omite cuando reusa un trazo ya
      // construido; en el número de agosto no pasa nunca.
      if (!minMax) continue;
      const caja = cajaDelTrazo(matriz, minMax, ancho, alto);
      if (caja) trazos.push(caja);
    }
  }

  /* --------------------------------------------------- qué es una infografía */

  const areaPagina = ancho * alto;
  const zonas: ZonaVectorial[] = [];

  for (const mancha of agruparEnManchas(trazos)) {
    const w = mancha.x1 - mancha.x0;
    const h = mancha.y1 - mancha.y0;

    // Grande, densa y con dos dimensiones: un dibujo y no un filete, un marco,
    // un borde ni un subrayado.
    if (w * h < areaPagina * PARTE_MINIMA_DE_LA_PAGINA) continue;
    if (mancha.trazos < TRAZOS_MINIMOS) continue;
    if (Math.min(w, h) / Math.max(w, h) < PROPORCION_MINIMA) continue;

    // Lo que está dibujado ADENTRO de una foto es parte de la foto: la pastilla
    // negra del epígrafe, el círculo que recorta un retrato. Ya se publica con
    // ella.
    const adentroDeUnaFoto = imagenes.some(
      (im) => interseccion(mancha, comoRect(im)) >= areaDe(mancha) * 0.98,
    );
    if (adentroDeUnaFoto) continue;

    // Y nunca sobre texto que ya se lee. Rasterizar prosa la duplicaría en una
    // imagen que nadie puede buscar, copiar ni escuchar.
    const caracteres = textos.reduce(
      (total, t) =>
        t.x >= mancha.x0 - 4 &&
        t.x <= mancha.x1 + 4 &&
        t.y >= mancha.y0 - 4 &&
        t.y <= mancha.y1 + 12
          ? total + t.texto.trim().length
          : total,
      0,
    );
    if (caracteres > CARACTERES_MAXIMOS) continue;

    /*
     * La zona se estira para tragarse las imágenes que la infografía usa de
     * fondo.
     *
     * Es lo que evita publicar el mismo dibujo dos veces —una completo y otra
     * desvaído y sin sus cifras— y además arregla el recorte: la envolvente del
     * vector termina donde termina la última letra, y la ilustración sigue unos
     * puntos más allá.
     */
    const absorbidas: string[] = [];
    const zona: Rect = { ...mancha };
    for (let hubo = true; hubo; ) {
      hubo = false;
      for (const im of imagenes) {
        if (absorbidas.includes(im.id)) continue;
        const caja = comoRect(im);
        if (interseccion(zona, caja) < areaDe(caja) * PARTE_ABSORBIDA_DE_LA_IMAGEN) {
          continue;
        }
        zona.x0 = Math.min(zona.x0, caja.x0);
        zona.y0 = Math.min(zona.y0, caja.y0);
        zona.x1 = Math.max(zona.x1, caja.x1);
        zona.y1 = Math.max(zona.y1, caja.y1);
        absorbidas.push(im.id);
        hubo = true;
      }
    }

    zonas.push({
      x: Math.max(0, Math.round(zona.x0)),
      y: Math.max(0, Math.round(zona.y0)),
      ancho: Math.round(Math.min(ancho, zona.x1) - Math.max(0, zona.x0)),
      alto: Math.round(Math.min(alto, zona.y1) - Math.max(0, zona.y0)),
      trazos: mancha.trazos,
      absorbidas,
    });
  }

  return zonas.sort((a, b) => a.y - b.y || a.x - b.x);
}
