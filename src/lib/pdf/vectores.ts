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
 * La primera versión de esto sólo rescataba lo más grande: pedía un cuarto de
 * página. Con esa vara la página 2 de agosto seguía perdiendo una línea de
 * tiempo y una tira de tres mapas, las dos con el texto pasado a curvas y las
 * dos invisibles en el diario web. Al medir las manchas de las dieciséis
 * páginas de agosto y septiembre quedó claro que el tamaño no distingue nada
 * —el marco vacío de un recuadro puede ocupar el 27% de la hoja y una línea de
 * tiempo entera el 5%— y que lo que sí distingue es **cuántos trazos** tiene la
 * mancha. Ése es hoy el criterio; el tamaño y la forma quedaron de red. Y antes
 * que cualquier umbral hubo que arreglar una geometría: una recta se descartaba
 * por no tener espesor, y sin su eje una línea de tiempo no es un dibujo sino
 * dos pedazos sueltos.
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
  /** Las imágenes que quedaron adentro. Son partes de este mismo dibujo —la
   *  ilustración que le hace de fondo, o el panel de al lado que el impreso
   *  resolvió con píxeles— y no figuras por su cuenta: quien llame tiene que
   *  saltearlas para no publicar dos veces lo mismo. */
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
 * Cuántos trazos hacen falta para que una mancha sea un dibujo.
 *
 * **Éste es el criterio.** Antes el que mandaba era el tamaño —un cuarto de
 * página— y el tamaño no separa nada: la línea de tiempo de la página 2 ocupa
 * el 5,4% y es contenido, y el marco del recuadro de la página 5 ocupa el 27,2%
 * y es un rectángulo vacío. Contadas todas las manchas de las dieciséis páginas
 * de agosto y septiembre, el conteo de trazos sí separa, y con un pozo enorme
 * en el medio:
 *
 *     194  infografía de la página 7 de agosto
 *     176  infografía de la página 6
 *     166  aviso institucional de la página 2
 *     148  línea de tiempo de la página 2
 *     128  tira de tres mapas de la página 2
 *     ---  entre 61 y 127 no hay nada, en ninguna de las dos ediciones
 *      60  logotipo del pie, igual en las dos ediciones
 *     ≤ 9  todo lo demás: filetes, marcos, bordes de recuadro, pastillas de
 *          epígrafe, isotipos del cabezal — ninguno llega a diez trazos
 *
 * Cien queda cómodo en el medio del pozo. Es mucho más que los 12 de antes, y
 * puede serlo justamente porque ahora es el único filtro que decide: los otros
 * tres son redes de contención, no criterios.
 *
 * Septiembre es el control: no tiene una sola infografía vectorial, y con este
 * número no devuelve ninguna zona en sus ocho páginas.
 */
const TRAZOS_MINIMOS = 100;

/**
 * Cuán chica puede ser una zona, en puntos cuadrados.
 *
 * Acá vivía `PARTE_MINIMA_DE_LA_PAGINA = 0,25`, y era ese cuarto de página el
 * que dejaba afuera la línea de tiempo (5,4% de la hoja) y la tira de mapas
 * (13,2%). Ya no decide nada: quedó el mismo piso con el que los dos
 * extractores descartan una imagen —«debajo de esto no es una figura: es un
 * logo, una viñeta o un filete»— y está sólo para que una mancha densa y
 * minúscula no termine publicada. La zona más chica que se rescata es la línea
 * de tiempo, 757×71 = 53.897 pt²: casi siete veces esto.
 */
const AREA_MINIMA_DE_UNA_FIGURA = 8000;

/**
 * Cuán angosta puede ser una zona, en puntos.
 *
 * Reemplaza a la proporción entre los lados, que tampoco separaba: la línea de
 * tiempo es 757×71 y da 0,094, o sea **más apaisada** que la bandera de la tapa
 * (757×108, 0,143), así que cualquier proporción que dejara pasar la una dejaba
 * pasar la otra.
 *
 * **Este número no separa contenido de mueblería, y conviene no creer que sí.**
 * Hay mueblería bastante más alta que 40 puntos —la bandera del cabezal mide
 * 757×108 y el logotipo del pie 350×89, medidos en las dos ediciones— y a esas
 * dos las mata el conteo de trazos, que es el criterio de verdad. Lo único que
 * hace este piso es descartar rayas: algo de menos de dos líneas de texto de
 * alto no es una figura por más trazos que tenga. La zona real más angosta, la
 * línea de tiempo, mide 71 puntos y pasa con holgura.
 */
const LADO_CORTO_MINIMO = 40;

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
 *
 * La misma mitad, medida sobre **un lado** en vez de sobre el área, es la que
 * reconoce al panel de al lado; está explicado donde se absorbe, más abajo.
 */
const PARTE_ABSORBIDA_DE_LA_IMAGEN = 0.5;

/**
 * Cuánto tiene que cubrir la zona a una imagen para que deje de publicarse.
 *
 * **Crecer y tragarse no son lo mismo**, y confundirlos costó un defecto. Una
 * imagen deja de publicarse por su cuenta sólo si la zona la contiene casi
 * entera; si la alcanza a medias, la zona igual crece para que el dibujo se vea
 * completo, pero la imagen sigue siendo una figura de la nota.
 *
 * El número sale de los dos casos reales, medidos **antes** de que la zona
 * crezca, que es cuando hay que decidir: la ilustración de fondo de las
 * infografías de las páginas 6 y 7 cae adentro en un 86% —ésa se traga— y el
 * mapa «Hoy» de la tira de la página 2, en un 72,5% —ése no—. Ochenta queda en
 * el medio.
 *
 * El margen es angosto y conviene saberlo: son catorce puntos entre un caso y
 * el otro. Si aparece una edición donde una capa de fondo caiga por debajo del
 * 80%, el síntoma va a ser una ilustración publicada dos veces —entera dentro
 * de la infografía y desvaída al lado—, y el número a mirar es éste. Bajarlo
 * hasta la mitad, como estaba, es lo que hacía que el mapa de la página 2 se
 * publicara cortado y sin quedar entero en ningún lado.
 */
const PARTE_PARA_TRAGARSELA = 0.8;

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
 * texto en una foto ilegible. Las cinco zonas de agosto tienen 0, 0, 0, 14 y 75
 * caracteres, y la que más se le acerca sin ser zona —el marco de prosa de la
 * página 2 de septiembre— tiene 2.687.
 */
const CARACTERES_MAXIMOS = 400;

/**
 * El espesor que se le presta a una recta.
 *
 * Un trazo recto —el eje de una línea de tiempo, un filete, la línea de llamada
 * de un rótulo— llega de `constructPath` con la caja del *camino*, y el camino
 * de una recta no tiene grosor: el eje de la línea de tiempo mide **743×0**.
 * `cajaDelTrazo` devolvía `null` para esas cajas y la recta se perdía. No es un
 * caso raro: son 51 de los 947 trazos de agosto y 54 de los 193 de septiembre.
 *
 * Lo que se perdía no era el filete —ése no importa— sino lo que el filete
 * **une**. Sin su eje, la línea de tiempo de la página 2 no es un dibujo: son
 * dos manchas sueltas, 108 trazos a la derecha y 39 a la izquierda, cada una
 * demasiado chica para pasar por ningún lado. Con el eje es una sola mancha de
 * 757×71 y 148 trazos. Mientras esto estuviera roto, ningún umbral iba a juntar
 * la línea de tiempo: no era una cuestión de umbrales, era geometría.
 *
 * Medio punto porque tiene que ser más fino que cualquier trazo de verdad —el
 * más fino de las dos ediciones mide 0,636 pt— y veintiocho veces menor que los
 * 14 puntos de `HUECO_ENTRE_TRAZOS`, para que prestarle grosor a una recta no
 * pueda cambiar qué se junta con qué.
 */
const ESPESOR_DE_UNA_RECTA = 0.5;

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

/** El rectángulo donde se pisan dos cajas, medido de lado y no de área. Hace
 *  falta suelto porque una imagen puede ser parte del dibujo por cruzarlo a lo
 *  largo de un lado sin taparle casi nada de superficie. */
function cruce(a: Rect, b: Rect): { ancho: number; alto: number } {
  return {
    ancho: Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)),
    alto: Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)),
  };
}

/** Cuánto se pisan dos cajas, en puntos cuadrados. */
function interseccion(a: Rect, b: Rect): number {
  const c = cruce(a, b);
  return c.ancho * c.alto;
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
 *
 * Y una recta no se tira. Un camino recto mide cero de alto o cero de ancho, y
 * la caja vacía que sale de ahí se descartaba: ver `ESPESOR_DE_UNA_RECTA`, que
 * es lo que se perdía y por qué importa.
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
  // Lo único que se tira es lo que el recorte dejó del todo afuera: ahí el
  // borde de llegada quedó ANTES que el de salida, que es lo que no puede pasar
  // con una caja que toca el papel.
  if (caja.x1 < caja.x0 || caja.y1 < caja.y0) return null;

  // Una recta es una caja de espesor cero: se le presta el mínimo para que
  // exista y pueda unir lo que une. Va después del recorte, así que una recta
  // pegada al borde del papel también queda.
  if (caja.x1 - caja.x0 < ESPESOR_DE_UNA_RECTA) {
    const medio = (caja.x0 + caja.x1) / 2;
    caja.x0 = medio - ESPESOR_DE_UNA_RECTA / 2;
    caja.x1 = medio + ESPESOR_DE_UNA_RECTA / 2;
  }
  if (caja.y1 - caja.y0 < ESPESOR_DE_UNA_RECTA) {
    const medio = (caja.y0 + caja.y1) / 2;
    caja.y0 = medio - ESPESOR_DE_UNA_RECTA / 2;
    caja.y1 = medio + ESPESOR_DE_UNA_RECTA / 2;
  }
  return caja;
}

/**
 * Junta los trazos sueltos en manchas.
 *
 * Une de a dos y vuelve a empezar hasta que no queda nada por unir. Es
 * cuadrático y no importa: la página más cargada de las dieciséis de agosto y
 * septiembre trae 450 trazos —la 2 de agosto, con sus tres piezas vectoriales—
 * y el conversor entero tarda menos de cuatro segundos por edición.
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
 * las que pasan el filtro. Casi siempre no devuelve ninguna: de las dieciséis
 * páginas de las dos ediciones medidas devuelve cinco zonas, todas en agosto, y
 * las ocho de septiembre —que no tiene una sola infografía vectorial— salen
 * vacías.
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

  const zonas: ZonaVectorial[] = [];

  for (const mancha of agruparEnManchas(trazos)) {
    const w = mancha.x1 - mancha.x0;
    const h = mancha.y1 - mancha.y0;

    // Muchos trazos: un dibujo y no un filete, un marco, un borde ni un
    // subrayado. Éste es el que decide; los dos de abajo sólo evitan que una
    // mancha de cien trazos que sea una raya o una miniatura llegue a figura.
    if (mancha.trazos < TRAZOS_MINIMOS) continue;
    if (Math.min(w, h) < LADO_CORTO_MINIMO) continue;
    if (w * h < AREA_MINIMA_DE_UNA_FIGURA) continue;

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
     * La zona se estira para tragarse las imágenes que son parte del dibujo.
     *
     * Hay dos maneras de serlo, y no se tratan igual.
     *
     * **La capa de fondo.** La ilustración de la plaza es un mapa de bits que
     * ocupa toda la franja y el vector está dibujado encima. Sin esto se
     * publicaban las dos cosas: la infografía completa y, aparte, el mismo
     * dibujo desvaído y sin sus cifras. A una capa se la traga **entera**,
     * porque el dibujo está sobre ella y termina donde termina la última letra,
     * unos puntos antes que la ilustración.
     *
     * **El panel de al lado.** La tira de tres mapas de la página 2 son tres
     * paneles: 1816 y 1916 son vectores y «Hoy» es un mapa de bits. La
     * envolvente del vector llega a x=541 y ese tercer panel empieza en x=504,
     * así que la zona le pisa apenas el 9% del área —lejos de la mitad— y el
     * recorte cortaba la tira dejando una tirita del último panel; encima ese
     * mapa se seguía publicando suelto, como si fuera una foto de la nota. Se
     * lo reconoce por el lado y no por el área: el cruce le tapa 245 de sus 338
     * puntos de alto —más de la mitad— y se le mete 37 puntos de ancho, más que
     * los 14 con los que dos trazos ya son el mismo dibujo.
     *
     * A un panel se lo alcanza **sólo de costado**. Estirar la zona también
     * hacia arriba, hasta donde empieza ese mapa, le metía adentro 510
     * caracteres: las seis últimas líneas de las tres columnas de la nota,
     * medido sobre la página. Rasterizar prosa es justamente lo que este módulo
     * no puede hacer.
     */
    const absorbidas: string[] = [];
    /** Las que la zona toca pero NO se traga: crecen el rectángulo y se siguen
     *  publicando por su cuenta. Se anotan sólo para no volver a mirarlas en
     *  cada vuelta del bucle. */
    const alcanzadas: string[] = [];
    const zona: Rect = { ...mancha };
    for (let hubo = true; hubo; ) {
      hubo = false;
      for (const im of imagenes) {
        if (absorbidas.includes(im.id) || alcanzadas.includes(im.id)) continue;
        const caja = comoRect(im);
        const pisa = cruce(zona, caja);

        /*
         * CRECER y ABSORBER son dos cosas distintas, y confundirlas fue el
         * defecto que encontró la verificación.
         *
         * Crecer es cuánto rectángulo se rasteriza. Absorber es que la imagen
         * deje de publicarse por su cuenta. Cuando iban juntas, el mapa «Hoy»
         * de la tira quedaba marcado como absorbido —o sea, ya no se publicaba
         * suelto— mientras la zona lo cubría sólo en un 72,5%: el lector lo
         * perdía cortado y no le quedaba entero por ningún lado.
         *
         * Y la página 2 muestra por qué no se pueden juntar. Ese mapa cumple
         * DOS papeles a la vez: es la figura «Distribución de las 246 plazas»,
         * con su propio título arriba, y es el tercer panel de la tira 1816 /
         * 1916 / Hoy, que le pasa por encima del borde inferior. Tragárselo
         * entero exigiría subir la zona hasta su título y meter adentro 510
         * caracteres de las tres columnas de la nota; dejarlo afuera corta la
         * tira y le deja un pedazo de mapa asomando.
         *
         * Por eso: la zona CRECE hasta que la tira se vea entera, y el mapa
         * SIGUE publicándose como la figura que es.
         */
        const cubierta = (pisa.ancho * pisa.alto) / areaDe(caja);

        /* Una capa de fondo está casi toda debajo del dibujo: la ilustración de
           las infografías de las páginas 6 y 7 queda cubierta al 99,9%. A ésa
           sí se la traga entera y deja de publicarse, que es lo que evita el
           mismo dibujo dos veces —uno completo y otro desvaído—. */
        const capaDeFondo = cubierta >= PARTE_PARA_TRAGARSELA;
        const panelAlLado =
          pisa.alto >= (caja.y1 - caja.y0) * PARTE_ABSORBIDA_DE_LA_IMAGEN &&
          pisa.ancho >= HUECO_ENTRE_TRAZOS;
        const panelDebajo =
          pisa.ancho >= (caja.x1 - caja.x0) * PARTE_ABSORBIDA_DE_LA_IMAGEN &&
          pisa.alto >= HUECO_ENTRE_TRAZOS;
        if (!capaDeFondo && !panelAlLado && !panelDebajo) continue;

        /* La capa de fondo se traga entera; a un panel se lo alcanza sólo por
           su eje, porque crecer por el otro es lo que mete prosa adentro. */
        const crecida: Rect = {
          x0:
            capaDeFondo || panelAlLado ? Math.min(zona.x0, caja.x0) : zona.x0,
          x1:
            capaDeFondo || panelAlLado ? Math.max(zona.x1, caja.x1) : zona.x1,
          y0:
            capaDeFondo || panelDebajo ? Math.min(zona.y0, caja.y0) : zona.y0,
          y1:
            capaDeFondo || panelDebajo ? Math.max(zona.y1, caja.y1) : zona.y1,
        };

        /*
         * El texto se vuelve a contar sobre la zona YA CRECIDA, y no sobre la
         * mancha original.
         *
         * Es el mismo criterio de más arriba —no rasterizar prosa— aplicado
         * donde de verdad hace falta: la mancha de la tira de mapas mide 499
         * puntos de ancho y la zona publicada 759, así que 260 puntos de página
         * entraban a la imagen sin que nadie les hubiera mirado el texto.
         */
        const caracteresCrecida = textos.reduce(
          (total, t) =>
            t.x >= crecida.x0 - 4 &&
            t.x <= crecida.x1 + 4 &&
            t.y >= crecida.y0 - 4 &&
            t.y <= crecida.y1 + 12
              ? total + t.texto.trim().length
              : total,
          0,
        );
        if (caracteresCrecida > CARACTERES_MAXIMOS) continue;

        zona.x0 = crecida.x0;
        zona.y0 = crecida.y0;
        zona.x1 = crecida.x1;
        zona.y1 = crecida.y1;
        /* Deja de publicarse SÓLO la que queda de verdad adentro. A la que la
           zona apenas alcanza de costado se la sigue publicando: es una figura
           por derecho propio —el mapa de las 246 plazas tiene su propio
           título— y la tira sólo la muestra de paso. */
        if (capaDeFondo) absorbidas.push(im.id);
        else alcanzadas.push(im.id);
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
