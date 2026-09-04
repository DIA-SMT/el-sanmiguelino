/**
 * De una página de PDF a los bloques de una nota.
 *
 * Este módulo es el corazón de la digitalización del impreso, y es **puro**: no
 * sabe de pdf.js, ni de Node, ni del DOM. Entran las palabras de una página con
 * su posición y su tipografía, y salen `titulo`, `bajada` y `BloqueNota[]`. Eso
 * es a propósito y no una manía: hoy lo llama un script de Node contra el
 * archivo del mes, y mañana lo va a llamar el navegador del panel al subir un
 * PDF —que es el único lugar que tiene los bytes, porque en Vercel un request
 * no puede pesar más de 4,5 MB—. La misma función tiene que dar el mismo
 * resultado en los dos lados.
 *
 * **De acá no sale una sola palabra que no esté en el PDF.** El texto se
 * reordena, se une y se corta, pero nunca se escribe. Es una publicación
 * oficial de un municipio: lo que dice la página tiene que ser lo que dice el
 * papel.
 *
 * ---
 *
 * Las tres cosas que hacen que esto funcione, y que costaron un prototipo
 * descartado cada una:
 *
 * 1. **Primero la grilla, después las líneas.** La calle entre columnas del
 *    diario mide 11 pt y la tipografía del cuerpo también. Agrupar palabras en
 *    líneas "por la misma altura" pega el final de una columna con el principio
 *    de la de al lado, y el resultado es texto perfectamente legible que dice
 *    cualquier cosa: «se juega, se camina, se hace dan sombra, verde y ayudan a
 *    bajar la temperatura». Por eso las columnas se detectan ANTES, con el
 *    histograma de dónde empieza cada palabra, y las líneas se arman dentro de
 *    cada una.
 *
 * 2. **Se clasifican grupos, no líneas.** La cita de la intendenta en la tapa
 *    de agosto son cuatro líneas y sólo la primera tiene la comilla de
 *    apertura. Mirar línea por línea la parte en una cita y tres destacados.
 *
 * 3. **La posición desambigua lo que el tamaño no.** En la página 3 hay
 *    Poppins-Bold de 10 pt en las columnas del cuerpo, que son subtítulos, y
 *    Poppins-Bold de 9 pt dentro del recuadro, que son encabezados de ficha.
 *    Por tamaño son casi lo mismo; lo que los separa es en qué columna caen.
 *
 * Y una decisión de fondo: **los umbrales se derivan de la propia página**, no
 * del PDF de agosto de 2026. El cuerpo es la tipografía que más se usa y todo
 * lo demás se mide en relación a ella. Si el año que viene rediseñan el
 * impreso y el titular pasa de 44 a 52 puntos, esto sigue andando; con números
 * absolutos habría dejado de reconocer el titular sin decir nada.
 */

import type { BloqueNota, ImagenNota } from "@/lib/types";

/* ------------------------------------- de página digitalizada a nota ------ */

/**
 * El título y la bajada con los que se guarda una página.
 *
 * Vive acá, y no en quien escribe en la base, porque tiene **dos** llamadores
 * que obligatoriamente tienen que coincidir: la acción del panel, que
 * digitaliza al subir el PDF, y el script `cargar:digitalizacion`, que hace lo
 * mismo desde la línea de comandos. Con una copia en cada lado, un número
 * cargado desde el panel y el mismo número cargado desde la consola salían con
 * bajadas distintas — y nadie lo iba a notar hasta que a Migue se le escapara
 * la diferencia.
 *
 * **No inventa nada.** Todo lo que devuelve es texto del propio impreso; lo
 * único que hace es elegir de dónde sacarlo cuando la página no trae lo obvio.
 */
export function camposDePagina(
  pagina: PaginaDigitalizada,
  contexto: {
    mes: string;
    /** El título de la página anterior, para las galerías que continúan. */
    tituloPrevio?: string;
  },
): { titulo: string; bajada: string } {
  /*
   * Una página sin título propio hereda el de la anterior, con
   * "(continuación)".
   *
   * Pasa con las galerías: la página 7 de agosto son seis fotos más de las
   * plazas que empezó a mostrar la 6, y en el papel no lleva título porque se
   * lee como una doble página. En la web cada página es una nota y necesita un
   * nombre: aparece en el índice, en el buscador, en las flechas de paso de
   * página y en lo que contesta Migue. Dejarla como "Página 7" sería poner ahí
   * justamente el cartel que la digitalización vino a sacar.
   */
  const titulo =
    pagina.titulo ||
    (contexto.tituloPrevio
      ? `${contexto.tituloPrevio.replace(/ \(continuación\)$/, "")} (continuación)`
      : `Página ${pagina.pagina}`);

  /*
   * Una nota necesita bajada: es lo que se lee en el índice, en el buscador y
   * en la voz.
   *
   * El orden importa y la última opción es un último recurso de verdad. Antes
   * era la única alternativa y decía «Página 7 de Agosto de 2026, tal como
   * salió impresa», y esa cadena hizo dos daños a la vez: en voz alta Migue le
   * leía eso a un vecino que había pedido un resumen, y —peor— la palabra
   * "Página" quedaba indexada, así que **cualquier** pregunta que dijera
   * "página" puntuaba contra esa nota y le ganaba a todas las demás.
   * Preguntar por la página 3 devolvía la 7.
   *
   * Una galería sí tiene qué decir de sí misma: los epígrafes de sus fotos son
   * los nombres de las plazas que muestra.
   */
  const primerParrafo =
    pagina.cuerpo.find((b) => b.tipo === "parrafo")?.texto ?? "";
  // Sin repetir: una galería puede traer dos fotos de la misma plaza, y
  // "Plaza 1º de Mayo, Plaza 1º de Mayo" leído en voz alta suena a error.
  const epigrafes = [
    ...new Set(
      pagina.cuerpo
        .filter((b) => b.tipo === "foto")
        .map((b) => (b.tipo === "foto" ? (b.epigrafe ?? "") : ""))
        .filter(Boolean),
    ),
  ];

  const bajada =
    pagina.bajada ||
    primerParrafo.split(/(?<=\.)\s/)[0]?.slice(0, 240) ||
    (epigrafes.length > 0 ? `${epigrafes.join(", ")}.` : "") ||
    `${contexto.mes}, tal como salió impresa.`;

  return { titulo, bajada };
}

/* ------------------------------------------------------------------ entrada */

/** Una palabra —o un pedazo de línea— tal como la entrega el PDF. */
export interface ItemTexto {
  /** Puntos desde el borde izquierdo. */
  x: number;
  /** Puntos desde el borde **superior**. El PDF mide desde abajo; quien llama
   *  ya lo dio vuelta, porque leer de arriba hacia abajo es lo natural acá. */
  y: number;
  ancho: number;
  /** Cuerpo tipográfico en puntos. */
  tam: number;
  /** Nombre real de la tipografía, sin el prefijo de subconjunto que le pone
   *  el PDF (`RPMMEK+Poppins-Bold` llega como `Poppins-Bold`). */
  fuente: string;
  texto: string;
  /** Girada. En el impreso lo está el crédito del fotógrafo, contra el borde. */
  rotado: boolean;
}

/** Una figura ya recortada de la página: foto, infografía o aviso. */
export interface FiguraPagina {
  /** Dirección final de la imagen, ya subida o ya escrita a disco. */
  src: string;
  /** Caja donde estaba impresa, en puntos desde arriba a la izquierda. */
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

export interface PaginaPdfCruda {
  pagina: number;
  ancho: number;
  alto: number;
  items: ItemTexto[];
  figuras: FiguraPagina[];
}

/* ------------------------------------------------------------------- salida */

export interface PaginaDigitalizada {
  pagina: number;
  /**
   * `grafica` = la página no es prosa.
   *
   * Las páginas 6 y 7 del número de agosto son galerías de seis fotos con su
   * epígrafe y nada más; la 4 es una infografía a página casi completa.
   * Reflowear eso a párrafos sería mentir sobre lo que dice el impreso, así que
   * se arman con las figuras y sus epígrafes, en el orden en que estaban.
   */
  clase: "prosa" | "grafica";
  titulo: string;
  bajada: string;
  imagen?: ImagenNota;
  cuerpo: BloqueNota[];
  /** Lo que se tiró: la mueblería del impreso. Se devuelve para poder
   *  auditarlo, porque un descarte silencioso es indistinguible de un bug. */
  descartado: string[];
  /** Lo que el conversor no supo resolver. Es lo que hay que mirar primero en
   *  la revisión del panel. */
  avisos: string[];
  /** Cómo quedó clasificado cada grupo de texto de la página. No lo usa el
   *  diario: existe para poder ver POR QUÉ una página salió como salió, que es
   *  la única forma de corregir el conversor sin adivinar. */
  depuracion: {
    rol: Rol;
    texto: string;
    columna: number;
    x: number;
    y: number;
    tam: number;
    fuente: string;
  }[];
}

/* ------------------------------------------------------------- la mueblería */

/**
 * Lo que está impreso en cada página pero no es la nota: la bandera, el folio,
 * la fecha y el pie legal.
 *
 * Va como lista explícita y no como heurística de posición porque es
 * exactamente eso: una lista corta y conocida del diseño de este diario. La
 * web ya pone su propio `Masthead`, su propio foliado y su propio pie, así que
 * dejar pasar cualquiera de estas líneas las muestra dos veces.
 */
const MUEBLERIA: RegExp[] = [
  /^el\s*sanmiguelino$/i,
  /^p[áa]g\.?\s*\d+$/i,
  /^san miguel de tucum[áa]n,\s*\w+\s+de\s+20\d\d\.?$/i,
  /a[ñn]o\s+[ivxl]+\s*[–-]\s*n/i,
  /^municipalidad de san miguel de tucum[áa]n,/i,
  /^no arrojar en la v[íi]a p[úu]blica/i,
  /^publicaci[óo]n gratuita/i,
];

function esMueble(texto: string): boolean {
  const limpio = texto.trim();
  return MUEBLERIA.some((r) => r.test(limpio));
}

/**
 * Marca la mueblería mirando renglones COMPLETOS, a lo ancho de toda la página.
 *
 * Hace falta porque el PDF parte una línea en varios pedazos y la mueblería no
 * es la excepción: en la tapa, «San Miguel de Tucumán, agosto de 2026 – Año I –
 * N» viaja separada del «o» volado y del «2», y esos dos pedazos caen a 250
 * puntos de distancia, del otro lado de la página. Sueltos no coinciden con
 * ningún patrón, así que sobrevivían al filtro y aterrizaban en el medio de la
 * cuarta columna.
 *
 * Lo que hacían ahí no era inofensivo: al no ser cuerpo, CERRABAN el párrafo
 * abierto, y la última oración de la tapa quedaba partida en dos —«La
 * recuperación de estos espacios que está haciendo la» / «Municipalidad de San
 * Miguel de Tucumán es, por lo tanto…»—.
 *
 * Acá se agrupa por altura sin mirar columnas, que es justamente lo que NO hay
 * que hacer para leer el texto, y está bien porque el resultado sólo decide qué
 * se tira. Si un renglón de cuerpo comparte altura con uno de mueblería, lo que
 * pasa es que el patrón deja de coincidir y no se descarta nada: falla hacia el
 * lado seguro.
 */
function mueblesDe(items: ItemTexto[]): Set<ItemTexto> {
  const fuera = new Set<ItemTexto>();
  const porAltura = [...items].sort((a, b) => a.y - b.y || a.x - b.x);

  let renglon: ItemTexto[] = [];
  const cerrar = () => {
    if (renglon.length === 0) return;
    const texto = renglon
      .map((i) => i.texto)
      .join("")
      .replace(/\s+/g, " ");
    if (esMueble(texto)) for (const i of renglon) fuera.add(i);
    renglon = [];
  };

  for (const i of porAltura) {
    if (esMueble(i.texto)) {
      fuera.add(i);
      continue;
    }
    if (renglon.length > 0 && Math.abs(renglon[0].y - i.y) <= 3) renglon.push(i);
    else {
      cerrar();
      renglon = [i];
    }
  }
  cerrar();
  return fuera;
}

/* ------------------------------------------------------- tipografía y peso */

/** La familia, sin el corte: `Poppins-SemiBold` → `poppins`. */
function familiaDe(fuente: string): string {
  return fuente.split("-")[0].toLowerCase();
}

/**
 * El diario usa DOS pesos fuertes y no significan lo mismo.
 *
 * La semi-negrita es la voz levantada: los destacados y las citas van en
 * Poppins-SemiBold. La negrita plena es jerarquía: titulares, títulos de
 * sección y encabezados de ficha van en Poppins-Bold. Por tamaño se confunden
 * —un título de sección de 21 puntos y una cita de 14 están los dos "más
 * grandes que el cuerpo"—, y por peso no.
 *
 * El orden importa: "SemiBold" contiene "Bold", así que primero hay que
 * preguntar por la semi.
 */
function esSemiNegrita(fuente: string): boolean {
  return /semib|demib|medium/i.test(fuente);
}

function esNegrita(fuente: string): boolean {
  return !esSemiNegrita(fuente) && /bold|black|heavy/i.test(fuente);
}

const clave = (i: { fuente: string; tam: number }) => `${i.fuente}|${i.tam}`;

/* ------------------------------------------------------------------ líneas */

interface Linea {
  x: number;
  y: number;
  ancho: number;
  tam: number;
  fuente: string;
  texto: string;
  columna: number;
}

/**
 * Dónde empieza cada columna de la página.
 *
 * El truco es que en un texto justificado **cada palabra es un ítem con su
 * propia x**, así que el histograma de esas x tiene picos altos justo en el
 * borde de cada columna —donde arranca cada línea— y ruido disperso en el
 * medio. Con pedir tres coincidencias alcanza para separar una cosa de la otra.
 *
 * Los picos que quedan a menos de 40 pt del anterior son la SANGRÍA de párrafo,
 * no una columna nueva: en este diario está a 17 pt, y la separación real entre
 * columnas es de 153. Cualquier número entre esos dos sirve; 40 está lejos de
 * los dos bordes.
 */
function columnasDe(items: ItemTexto[]): number[] {
  const histograma = new Map<number, number>();
  for (const i of items) {
    const x = Math.round(i.x);
    histograma.set(x, (histograma.get(x) ?? 0) + 1);
  }
  const picos = [...histograma.entries()]
    .filter(([, cuenta]) => cuenta >= 3)
    .map(([x]) => x)
    .sort((a, b) => a - b);

  const columnas: number[] = [];
  for (const x of picos) {
    if (columnas.length === 0 || x - columnas[columnas.length - 1] > 40) {
      columnas.push(x);
    }
  }
  return columnas.length > 0 ? columnas : [0];
}

/**
 * Cuánto puede empezar un texto ANTES del borde de su columna y seguir siendo
 * de esa columna.
 *
 * Tiene que ser mayor que el desajuste real —el destacado de la página 3
 * arranca en 502 y el borde detectado para esa columna es 508, porque lo fijó
 * el recuadro de datos que está debajo— y menor que la sangría de párrafo, que
 * en este diario es de 17 puntos. Si fuera mayor que la sangría, la primera
 * línea de cada párrafo se iría a la columna siguiente.
 *
 * Con 4 puntos, que era el valor original, ese destacado caía en la columna
 * anterior y quedaba intercalado con el texto de esa columna: el bloque se
 * partía en dos mitades separadas por un párrafo.
 */
const TOLERANCIA_DE_COLUMNA = 12;

/** En qué columna cae una x. */
function columnaDe(columnas: number[], x: number): number {
  let cual = 0;
  for (let i = 0; i < columnas.length; i++) {
    if (columnas[i] <= x + TOLERANCIA_DE_COLUMNA) cual = i;
  }
  return cual;
}

/**
 * Junta las palabras en líneas, **dentro de una misma columna y un mismo
 * estilo**.
 *
 * Las dos condiciones importan. La columna, por la calle de 11 pt explicada
 * arriba. El estilo, porque en la página 3 el encabezado de una ficha y el
 * texto de la ficha de al lado comparten altura, y sin esto se pegaban en una
 * sola línea que mezclaba las dos entradas del recuadro.
 *
 * El espacio entre palabras se repone por el hueco: el PDF no guarda espacios,
 * guarda posiciones.
 */
function lineasDe(items: ItemTexto[], columnas: number[]): Linea[] {
  const cubos = new Map<string, ItemTexto[]>();
  for (const i of items) {
    const k = `${columnaDe(columnas, i.x)}|${clave(i)}`;
    const cubo = cubos.get(k);
    if (cubo) cubo.push(i);
    else cubos.set(k, [i]);
  }

  const lineas: Linea[] = [];
  for (const [k, cubo] of cubos) {
    const columna = Number(k.split("|")[0]);
    cubo.sort((a, b) => a.y - b.y || a.x - b.x);
    let actual: Linea | null = null;
    for (const i of cubo) {
      const hueco = actual ? i.x - (actual.x + actual.ancho) : 0;
      /*
       * Misma altura, sí, pero además CONTIGUO y hacia la derecha.
       *
       * Sin esto, en una página de galería —donde no hay grilla de columnas que
       * detectar y todo cae en una sola— dos rótulos de fotos distintas que
       * están a la misma altura se pegaban en uno solo, y encima sin espacio en
       * el medio porque el segundo quedaba a la IZQUIERDA del primero y el
       * hueco daba negativo: «Plaza ConvivenciaPlaza Sortheix».
       *
       * El tope de ocho cuerpos deja pasar lo que sí es una línea —dos
       * fragmentos separados por una palabra en negrita— y corta lo que no.
       */
      if (
        actual &&
        Math.abs(actual.y - i.y) <= 2 &&
        hueco >= -1 &&
        hueco < i.tam * 8
      ) {
        actual.texto += (hueco > i.tam * 0.12 ? " " : "") + i.texto;
        actual.ancho = i.x + i.ancho - actual.x;
      } else {
        actual = {
          x: i.x,
          y: i.y,
          ancho: i.ancho,
          tam: i.tam,
          fuente: i.fuente,
          texto: i.texto,
          columna,
        };
        lineas.push(actual);
      }
    }
  }
  return lineas;
}

/* ------------------------------------------------------------------- roles */

type Rol =
  | "titular"
  | "bajada"
  /** Texto compuesto como bajada pero que no está debajo del titular: el
   *  epígrafe largo de una infografía, un pie de página. Es texto de la nota y
   *  va al cuerpo, pero como párrafo suelto y no como parte del flujo. */
  | "cuerpo-suelto"
  | "cuerpo"
  | "subtitulo"
  | "cita"
  | "destacado"
  | "epigrafe"
  | "ficha-titulo"
  | "ficha-lead"
  | "ficha-texto"
  | "suelto";

/** Cuánto de la página tiene que ocupar un estilo para poder ser el cuerpo.
 *  Por debajo de esto es una bajada, un epígrafe o un titular: cosas que en una
 *  página pesan poco por definición. */
const PARTE_MINIMA_DEL_CUERPO = 0.15;

/**
 * El estilo del cuerpo: **el más GRANDE entre los que cargan buena parte del
 * texto de la página**.
 *
 * "El estilo con más caracteres" parece la respuesta obvia y está mal en dos de
 * las ocho páginas de agosto. En la 4 y en la 5, los rótulos de la infografía y
 * las fichas —Poppins de 8 puntos— suman más caracteres que el texto corrido en
 * Sabon de 11: 1.490 contra 1.030 y 2.136 contra 1.583. Eligiéndolos como
 * cuerpo, todo lo demás se mide contra el tamaño equivocado y la página sale
 * dada vuelta: el texto de verdad pasa a ser "bajada" y los títulos de sección,
 * "destacados".
 *
 * Se probaron dos desempates antes de éste y los dos se cayeron contra el
 * archivo real. La forma del bloque —cuántas líneas seguidas comparten
 * interlineado— la tiró abajo la página 4, cuya infografía es una lista de
 * SETENTA nombres de plaza en una columna perfecta: por regularidad le gana a
 * cualquier texto de lectura. La justificación —que el cuerpo mide siempre el
 * ancho de la columna— la tiró abajo la página 5, donde las fichas también
 * están justificadas dentro de su recuadro.
 *
 * Lo que queda en pie es una regla de tipografía, no de geometría: **el texto
 * secundario se compone más chico que el cuerpo. Siempre.** Fichas, epígrafes,
 * rótulos y pies existen para no competir con la lectura principal. Entonces,
 * entre los estilos que aportan una parte apreciable de la página —lo que deja
 * afuera al titular y a la bajada, que son grandes pero cortos—, el cuerpo es
 * el de mayor cuerpo tipográfico.
 *
 * Sale bien en las ocho páginas, y no depende de esta maqueta: depende de que
 * el diario componga lo accesorio más chico que lo principal, que es lo que
 * hace cualquier publicación.
 */
function estiloDelCuerpo(lineas: Linea[]): string | null {
  const porEstilo = new Map<string, Linea[]>();
  for (const l of lineas) {
    const grupo = porEstilo.get(clave(l));
    if (grupo) grupo.push(l);
    else porEstilo.set(clave(l), [l]);
  }

  const total = lineas.reduce((t, l) => t + l.texto.length, 0);
  if (total === 0) return null;

  let mejor: string | null = null;
  let mejorTam = 0;
  let mejorCaracteres = 0;

  for (const [k, grupo] of porEstilo) {
    // Cuatro líneas: menos que eso no es un cuerpo de texto ni con la página
    // más corta.
    if (grupo.length < 4) continue;
    const caracteres = grupo.reduce((t, l) => t + l.texto.length, 0);
    if (caracteres / total < PARTE_MINIMA_DEL_CUERPO) continue;

    const tam = grupo[0].tam;
    if (tam > mejorTam || (tam === mejorTam && caracteres > mejorCaracteres)) {
      mejor = k;
      mejorTam = tam;
      mejorCaracteres = caracteres;
    }
  }
  return mejor;
}

/**
 * Un grupo de líneas seguidas del mismo estilo y la misma columna.
 *
 * **Se clasifican grupos y no líneas**, y esto es la tercera vez que el
 * prototipo lo tuvo que aprender. La cita de la página 4 son cinco líneas y
 * sólo la primera abre comillas y sólo la última las cierra; mirándolas de a
 * una salían cinco subtítulos. El texto entero es lo único que permite
 * preguntarle a una cita si es una cita.
 */
interface Grupo {
  lineas: Linea[];
  texto: string;
  columna: number;
  tam: number;
  fuente: string;
  x: number;
  y: number;
  ancho: number;
}

/** El orden en que se lee una página del impreso: columna por columna, y
 *  dentro de cada una de arriba hacia abajo. Verificado contra el PDF de
 *  agosto: las frases empalman exactamente donde el papel las corta.
 *
 *  La x del final no es decorativa. Cuando una línea trae dos tipografías —una
 *  palabra en negrita en medio de un párrafo— quedan dos fragmentos a la misma
 *  altura, y sin ordenarlos por posición horizontal el párrafo se arma con las
 *  palabras cambiadas de lugar. */
function enLectura(a: Linea, b: Linea): number {
  return a.columna - b.columna || a.y - b.y || a.x - b.x;
}

function agrupar(lineas: Linea[]): Grupo[] {
  const grupos: Grupo[] = [];
  for (const l of [...lineas].sort(enLectura)) {
    const ultimo = grupos[grupos.length - 1];
    const previa = ultimo?.lineas[ultimo.lineas.length - 1];
    const sigue =
      ultimo &&
      previa &&
      ultimo.columna === l.columna &&
      clave(ultimo) === clave(l) &&
      l.y - previa.y < l.tam * 2.4;
    if (sigue) {
      ultimo.lineas.push(l);
      ultimo.texto = pegar(ultimo.texto, l.texto);
      ultimo.x = Math.min(ultimo.x, l.x);
      ultimo.ancho = Math.max(ultimo.ancho, l.x + l.ancho - ultimo.x);
    } else {
      grupos.push({
        lineas: [l],
        texto: l.texto.trim(),
        columna: l.columna,
        tam: l.tam,
        fuente: l.fuente,
        x: l.x,
        y: l.y,
        ancho: l.ancho,
      });
    }
  }
  return grupos;
}

function rolDe(
  linea: Grupo,
  cuerpoTam: number,
  cuerpoFamilia: string,
  estiloCuerpo: string,
  columnasDeCuerpo: Set<number>,
): Rol {
  if (clave(linea) === estiloCuerpo) return "cuerpo";

  const razon = linea.tam / cuerpoTam;
  const negrita = esNegrita(linea.fuente);
  const semi = esSemiNegrita(linea.fuente);
  const mismaFamilia = familiaDe(linea.fuente) === cuerpoFamilia;
  const enCuerpo = columnasDeCuerpo.has(linea.columna);

  if (razon >= 2.2) return "titular";

  /*
   * Negrita del MISMO tipo y tamaño que el cuerpo: es énfasis dentro de un
   * párrafo, no un título.
   *
   * En la página 5, «Esta repetición funciona como una identidad urbana
   * compartida. Los vecinos pueden reconocer…» lleva tres palabras en
   * Sabon-Bold. Tratarlas como subtítulo partía el párrafo en tres pedazos y
   * dejaba un bloque suelto que decía «. Los vecinos pue-».
   *
   * Se devuelve "cuerpo" y el énfasis se pierde: el diario no tiene un bloque
   * para negrita dentro de un párrafo, y perder el resalte es infinitamente
   * mejor que perder la frase.
   */
  if (mismaFamilia && razon >= 0.95 && razon < 1.15) return "cuerpo";

  // Las comillas del impreso mandan sobre todo lo demás. En la página 4 lo que
  // dice una vecina va en Poppins-Bold de 13 —el mismo peso y casi el mismo
  // cuerpo que un título de sección—, y lo único que lo delata es que está
  // entrecomillado. Se pregunta sobre el grupo entero, porque la comilla de
  // apertura está sólo en la primera de sus cinco líneas.
  if (razon >= 1.05 && /[“”«»]/.test(linea.texto)) return "destacado";

  // Una cita o un destacado, en cualquier tamaño por encima del cuerpo: es la
  // semi-negrita la que los marca, no el cuerpo tipográfico.
  if (semi && razon >= 0.95) return "destacado";

  if (razon >= 1.15) {
    // Más grande que el cuerpo y no es una cita. En negrita plena es un título
    // de sección —el segundo titular de una página que trae dos notas—; en
    // redonda es la bajada.
    return negrita ? "subtitulo" : "bajada";
  }

  if (negrita) {
    // Acá manda la POSICIÓN, que es lo único que separa un subtítulo de un
    // encabezado de ficha: en la página 3 los dos son Poppins-Bold de 10 y 9
    // puntos, y lo que los distingue es que uno cae en una columna de texto y
    // el otro dentro del recuadro.
    if (enCuerpo) return "subtitulo";
    return razon >= 0.95 ? "ficha-titulo" : "ficha-lead";
  }

  if (razon < 0.95) {
    // Más chico que el cuerpo y sin peso. En la familia del cuerpo —la serif
    // del diario— es el epígrafe de una foto; en la otra, el interior de un
    // recuadro de datos.
    return mismaFamilia ? "epigrafe" : "ficha-texto";
  }

  // Del tamaño del cuerpo, en otra tipografía y sin peso: la atribución de una
  // cita cae acá.
  return "suelto";
}

/* -------------------------------------------------------------- párrafos */

/** Corta el guión de fin de línea y pega las dos mitades de la palabra.
 *
 *  La regla es "termina en guión y lo que sigue empieza en minúscula". Se le
 *  escapa un compuesto real cortado justo ahí —«político-institucional»— y por
 *  eso el resultado pasa por revisión antes de publicarse; pero sin esto, cada
 *  página queda sembrada de «se char- la con el vecino». */
function pegar(acumulado: string, siguiente: string): string {
  const cola = acumulado.trimEnd();
  const cabeza = siguiente.trim();
  if (/-$/.test(cola) && /^[a-záéíóúüñ]/.test(cabeza)) {
    return cola.slice(0, -1) + cabeza;
  }
  // Sin espacio delante de un signo de puntuación. Pasa cuando una línea trae
  // dos tipografías —una palabra en negrita y el resto en redonda— y el pedazo
  // que sigue arranca con el punto: «compartida . Los vecinos».
  if (/^[.,;:!?)»”]/.test(cabeza)) return cola + cabeza;
  return `${cola} ${cabeza}`;
}

/* ---------------------------------------------------------- ensamblado */

function limpiarCita(texto: string): string {
  // El diario pone las comillas al maquetar: guardarlas acá las duplicaría.
  //
  // El punto final va DESPUÉS de la comilla de cierre en el impreso —«…las
  // quiere y las cuida”.»— así que hay que sacar los dos, y en ese orden. Sólo
  // quitar comillas al final dejaba la cita terminada en «cuida”.».
  return texto
    .replace(/^[“"«\s]+/, "")
    .replace(/[”"»]\s*\.?\s*$/, "")
    .trim();
}

/** «Rossana Chahla, intendente.» → autor y cargo. Si no hay coma, todo es
 *  autor: el bloque `cita` exige autor y el cargo es opcional. */
function partirAtribucion(texto: string): { autor: string; cargo?: string } {
  const limpio = texto.trim().replace(/\.$/, "");
  const coma = limpio.indexOf(",");
  if (coma === -1) return { autor: limpio };
  return {
    autor: limpio.slice(0, coma).trim(),
    cargo: limpio.slice(coma + 1).trim() || undefined,
  };
}

/** El epígrafe que corresponde a una figura: el que está justo debajo y
 *  solapado horizontalmente. En el impreso el epígrafe se apoya en el pie de la
 *  foto, así que "debajo y alineado" alcanza para atarlos sin ambigüedad. */
function epigrafeDe(figura: FiguraPagina, epigrafes: Grupo[]): Grupo | null {
  const pie = figura.y + figura.alto;
  let mejor: Grupo | null = null;
  for (const e of epigrafes) {
    const distancia = e.y - pie;
    if (distancia < -2 || distancia > 30) continue;
    const solapa =
      e.x < figura.x + figura.ancho + 10 && e.x + e.ancho > figura.x - 10;
    if (!solapa) continue;
    if (!mejor || e.y < mejor.y) mejor = e;
  }
  return mejor;
}

/**
 * Convierte una página del impreso en los bloques de una nota.
 */
export function digitalizarPagina(cruda: PaginaPdfCruda): PaginaDigitalizada {
  const descartado: string[] = [];
  const avisos: string[] = [];

  // El crédito del fotógrafo va girado contra el borde: se aparta acá, porque
  // una línea vertical no tiene ni columna ni interlineado y ensucia todo lo
  // que viene después.
  const creditos = cruda.items
    .filter((i) => i.rotado && i.texto.trim())
    .map((i) => i.texto.trim());

  const conTexto = cruda.items.filter((i) => !i.rotado && i.texto.trim());
  const muebles = mueblesDe(conTexto);
  const utiles: ItemTexto[] = [];
  for (const i of conTexto) {
    if (muebles.has(i)) descartado.push(i.texto.trim());
    else utiles.push(i);
  }

  const columnas = columnasDe(utiles);
  const lineas = lineasDe(utiles, columnas).filter((l) => !esMueble(l.texto));

  const estiloCuerpo = estiloDelCuerpo(lineas);
  const lineasCuerpo = lineas.filter((l) => clave(l) === estiloCuerpo);
  const caracteresCuerpo = lineasCuerpo.reduce(
    (t, l) => t + l.texto.length,
    0,
  );

  /*
   * ¿Es una página de prosa o una página gráfica?
   *
   * 400 caracteres son unas seis líneas de columna: por debajo de eso no hay
   * un texto que leer, hay rótulos. Las páginas 6 y 7 de agosto —galerías de
   * seis fotos— tienen 306 y 102, y la tapa tiene 1.450.
   */
  const clase: "prosa" | "grafica" =
    !estiloCuerpo || caracteresCuerpo < 400 ? "grafica" : "prosa";

  if (clase === "grafica") {
    return paginaGrafica(cruda, lineas, creditos, descartado, avisos);
  }

  const [fuenteCuerpo, tamTexto] = estiloCuerpo!.split("|");
  const cuerpoTam = Number(tamTexto);
  const cuerpoFamilia = familiaDe(fuenteCuerpo);
  const columnasDeCuerpo = new Set(lineasCuerpo.map((l) => l.columna));

  /*
   * El margen real de cada columna: la x que más se repite entre sus líneas de
   * cuerpo.
   *
   * NO sirve el borde de la grilla que devolvió `columnasDe`, y esto rompió la
   * página 5 entera. Esa grilla se calcula sobre toda la página, así que un
   * rótulo suelto unos puntos más a la izquierda le corre el borde a la
   * columna; entonces TODAS las líneas de esa columna quedan "más a la derecha
   * que el margen", cada una parece sangrada y cada línea se convierte en un
   * párrafo de una sola línea. El texto quedaba picado en tiras.
   *
   * La x más frecuente es, por definición, la del margen: la sangría aparece
   * una vez por párrafo y el margen, en todas las demás líneas.
   */
  const margenDeColumna = new Map<number, number>();
  for (const columna of columnasDeCuerpo) {
    const cuenta = new Map<number, number>();
    for (const l of lineasCuerpo) {
      if (l.columna !== columna) continue;
      const x = Math.round(l.x);
      cuenta.set(x, (cuenta.get(x) ?? 0) + 1);
    }
    const frecuente = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0];
    if (frecuente) margenDeColumna.set(columna, frecuente[0]);
  }

  // Dónde empieza cada renglón, para poder distinguir una sangría de párrafo de
  // un fragmento que arranca en el medio de la línea.
  const claveDeRenglon = (l: Linea) => `${l.columna}|${Math.round(l.y)}`;
  const primerFragmento = new Map<string, number>();
  for (const l of lineas) {
    const k = claveDeRenglon(l);
    const previo = primerFragmento.get(k);
    if (previo === undefined || l.x < previo) primerFragmento.set(k, l.x);
  }

  const conRol = agrupar(lineas).map((g) => ({
    grupo: g,
    rol: rolDe(g, cuerpoTam, cuerpoFamilia, estiloCuerpo!, columnasDeCuerpo),
  }));

  const titulo = conRol
    .filter((c) => c.rol === "titular")
    .map((c) => c.grupo.texto)
    .join(" ");

  /*
   * La bajada es SÓLO el bloque que va debajo del titular.
   *
   * Antes se unían todos los grupos que tuvieran ese tamaño y esa redonda, y en
   * la página 8 eso pegaba tres textos que no tienen nada que ver: la bajada de
   * verdad, el epígrafe de la infografía y el pie de la consulta pública,
   * todos compuestos en el mismo cuerpo pero en otro lugar de la página. El
   * resultado era una bajada que cambiaba de tema dos veces en tres renglones.
   *
   * Los demás no se tiran: son texto que el diario publicó, así que bajan a
   * párrafo y entran en el cuerpo por donde les toca.
   */
  const bajadas = conRol.filter((c) => c.rol === "bajada");
  const laBajada = bajadas[0];
  const bajada = laBajada?.grupo.texto ?? "";
  for (const otra of bajadas.slice(1)) otra.rol = "cuerpo-suelto";

  if (!titulo) avisos.push("La página no tiene un titular reconocible.");

  const epigrafes = conRol
    .filter((c) => c.rol === "epigrafe")
    .map((c) => c.grupo);

  /* ------------------------------------------------------------- figuras */

  const figuras = [...cruda.figuras].sort(
    (a, b) => b.ancho * b.alto - a.ancho * a.alto,
  );
  const usadas = new Set<FiguraPagina>();

  /*
   * Qué epígrafe le toca a cada figura, resuelto ANTES de recorrer el texto.
   *
   * El orden importa: durante el recorrido hay que saber si un epígrafe
   * encontró figura, porque el que no la encontró tiene que salvarse como
   * párrafo en lugar de evaporarse. Resolverlo después —que era como estaba—
   * dejaba al recorrido sin esa información.
   */
  const epigrafeDeFigura = new Map<FiguraPagina, Grupo>();
  const epigrafesUsados = new Set<Grupo>();
  for (const figura of figuras) {
    const epi = epigrafeDe(figura, epigrafes);
    // Un epígrafe es de una sola figura: si dos se lo disputan, se lo queda la
    // primera, que por el orden es la más grande.
    if (epi && !epigrafesUsados.has(epi)) {
      epigrafeDeFigura.set(figura, epi);
      epigrafesUsados.add(epi);
    }
  }

  // La foto de apertura: la más grande de la página. Es la que el impreso pone
  // arriba del texto y la que el diario web sabe mostrar a todo el ancho.
  let imagen: ImagenNota | undefined;
  const principal = figuras[0];
  if (principal) {
    usadas.add(principal);
    const epi = epigrafeDeFigura.get(principal);
    imagen = {
      src: principal.src,
      epigrafe: epi?.texto ?? "",
      alt:
        epi?.texto ||
        `Fotografía de la página ${cruda.pagina} de la edición impresa`,
      // La firma del fotógrafo va impresa una sola vez por página, girada
      // contra el borde, y vale para todas sus fotos.
      ...(creditos[0] ? { credito: creditos[0] } : {}),
    };
  }

  /*
   * El retrato de la cita.
   *
   * En la tapa de agosto, al lado de lo que dijo la intendenta hay un retrato
   * redondo de 145×145. El bloque `cita` ya tiene un campo `retrato` para
   * exactamente eso, y ponerlo ahí es la diferencia entre reproducir la página
   * y aproximarla. Se reconoce por ser chico y casi cuadrado.
   */
  const retrato = figuras.find(
    (f) =>
      !usadas.has(f) &&
      f.ancho <= 200 &&
      f.alto / f.ancho > 0.85 &&
      f.alto / f.ancho < 1.18,
  );
  if (retrato) usadas.add(retrato);

  /* ------------------------------------------------------------- el cuerpo */

  const cuerpo: BloqueNota[] = [];
  const fichaEntradas: { lead: string; texto: string }[] = [];
  let fichaTitulo = "";

  // Lo que queda para recorrer. `agrupar` ya lo dejó en orden de lectura.
  const enOrden = conRol.filter(
    (c) => c.rol !== "titular" && c.rol !== "bajada",
  );

  let parrafo = "";
  let leadPendiente = "";
  let textoPendiente = "";

  /*
   * Todo lo que no es cuerpo espera a que cierre el párrafo abierto.
   *
   * **El cuerpo de un diario es UN SOLO texto que corre por todas las
   * columnas**, y lo único que lo corta es la sangría. Todo lo demás —una cita,
   * un destacado, un título de sección, el rótulo de una infografía— está
   * apoyado encima de ese flujo, no intercalado en él.
   *
   * Tratarlos como interrupciones era lo que picaba el texto: en orden de
   * lectura, la cita de la intendenta aparece antes que el cuerpo de su propia
   * columna, y los rótulos de la línea de tiempo de la página 2 caen entre el
   * final de una columna y el principio de la siguiente. El resultado eran
   * oraciones partidas al medio: «La recuperación de estos espacios que está
   * haciendo la» / «Municipalidad de San Miguel de Tucumán es, por lo tanto…».
   *
   * Esperando, cada uno cae en el primer corte de párrafo que viene, que es
   * donde un diario lo pondría. Un título de sección sigue quedando ANTES del
   * párrafo que presenta, porque el corte que lo libera es justamente el que
   * abre ese párrafo.
   */
  const flotantes: BloqueNota[] = [];

  const cerrarParrafo = () => {
    if (parrafo.trim()) cuerpo.push({ tipo: "parrafo", texto: parrafo.trim() });
    parrafo = "";
    cuerpo.push(...flotantes.splice(0));
  };
  const cerrarEntrada = () => {
    const lead = leadPendiente.trim().replace(/:$/, "");
    const texto = textoPendiente.trim();
    if (lead && texto) {
      fichaEntradas.push({ lead, texto });
    } else if (texto || lead) {
      /*
       * Texto de recuadro sin su encabezado —o al revés—: NO se tira.
       *
       * La página 4 lo encontró: su infografía es un mapa con los nombres de
       * las 67 plazas puestas en valor, compuestos en el cuerpo chico de las
       * fichas pero sin ningún encabezado que los agrupe. Como una entrada de
       * ficha necesita las dos mitades, esos setenta nombres no llegaban a
       * ninguna parte y desaparecían: 122 palabras del impreso, la mitad de la
       * página, perdidas en silencio.
       *
       * Van a párrafo. Es texto que el diario publicó, y encima es de lo más
       * buscable que tiene el número: alguien va a preguntar si renovaron la
       * plaza de su barrio.
       */
      flotantes.push({ tipo: "parrafo", texto: texto || lead });
    }
    leadPendiente = "";
    textoPendiente = "";
  };

  for (let i = 0; i < enOrden.length; i++) {
    const { grupo, rol } = enOrden[i];

    switch (rol) {
      case "cuerpo": {
        // La sangría marca párrafo nuevo, y se mira LÍNEA POR LÍNEA: es lo
        // único del grupo que no se decide a nivel de grupo. Es lo mismo que
        // hace el impreso —los párrafos no se separan con un blanco, se
        // sangran— y significa que el corte sale de la coordenada y no de
        // adivinar dónde termina una idea.
        //
        // `abreRenglon` es lo que evita el falso positivo: una palabra en
        // negrita en el medio de una línea es también un fragmento que empieza
        // "más a la derecha que el margen", y sin esta comprobación cada
        // resalte partía el párrafo en dos. Sólo sangra el fragmento que abre
        // el renglón.
        const margen =
          margenDeColumna.get(grupo.columna) ?? columnas[grupo.columna];
        for (const linea of grupo.lineas) {
          const abreRenglon =
            linea.x <= (primerFragmento.get(claveDeRenglon(linea)) ?? linea.x);
          if (abreRenglon && linea.x - margen > 8 && parrafo.trim()) {
            cerrarParrafo();
          }
          parrafo = parrafo ? pegar(parrafo, linea.texto) : linea.texto.trim();
        }
        break;
      }

      case "subtitulo":
        flotantes.push({ tipo: "subtitulo", texto: grupo.texto });
        break;

      case "cuerpo-suelto":
        flotantes.push({ tipo: "parrafo", texto: grupo.texto });
        break;

      case "destacado": {
        // ¿Es una cita o un destacado? Lo dicen las comillas del impreso.
        if (!/[“”"«»]/.test(grupo.texto)) {
          flotantes.push({ tipo: "destacado", texto: grupo.texto });
          break;
        }

        const citaTexto = limpiarCita(grupo.texto);
        // La atribución es el grupo que sigue en la misma columna, más chico y
        // en otra tipografía: «Rossana Chahla, intendente.». Sin ella el bloque
        // no se puede guardar, porque en una publicación oficial una cita sin
        // autor no se publica.
        const siguiente = enOrden[i + 1];
        const ultima = grupo.lineas[grupo.lineas.length - 1];
        const atribucion =
          siguiente &&
          siguiente.grupo.columna === grupo.columna &&
          siguiente.grupo.y - ultima.y < grupo.tam * 4 &&
          siguiente.grupo.tam < grupo.tam * 1.05 &&
          (siguiente.rol === "suelto" ||
            siguiente.rol === "ficha-texto" ||
            siguiente.rol === "epigrafe")
            ? siguiente
            : null;

        if (atribucion) {
          const { autor, cargo } = partirAtribucion(atribucion.grupo.texto);
          flotantes.push({
            tipo: "cita",
            texto: citaTexto,
            autor,
            ...(cargo ? { cargo } : {}),
            ...(retrato ? { retrato: retrato.src } : {}),
          });
          i++;
        } else {
          avisos.push(
            `Hay una cita sin quién la dijo: «${citaTexto.slice(0, 60)}…». ` +
              `Se guardó como destacado, que no lleva autor.`,
          );
          flotantes.push({ tipo: "destacado", texto: citaTexto });
        }
        break;
      }

      case "ficha-titulo":
        cerrarEntrada();
        if (fichaTitulo) {
          avisos.push(
            `La página trae más de un recuadro de datos; se unieron en uno solo.`,
          );
        }
        fichaTitulo ||= grupo.texto;
        break;

      case "ficha-lead":
        if (textoPendiente.trim()) cerrarEntrada();
        leadPendiente = leadPendiente
          ? pegar(leadPendiente, grupo.texto)
          : grupo.texto;
        break;

      case "ficha-texto":
        textoPendiente = textoPendiente
          ? pegar(textoPendiente, grupo.texto)
          : grupo.texto;
        break;

      case "epigrafe":
        // Los que encontraron figura ya viajan con ella. Los que no —los
        // rótulos sueltos de la línea de tiempo de la página 2, que es dibujo
        // vectorial y no una imagen que se pueda recortar— van a párrafo:
        // desaparecían en silencio, y eran diez palabras del impreso.
        if (!epigrafesUsados.has(grupo)) {
          flotantes.push({ tipo: "parrafo", texto: grupo.texto });
        }
        break;

      default:
        descartado.push(grupo.texto);
    }
  }
  cerrarParrafo();
  cerrarEntrada();
  // Un flotante que quedó al final —una cita al pie de la última columna— igual
  // se publica: `cerrarParrafo` sólo los vacía si había un párrafo abierto.
  cuerpo.push(...flotantes.splice(0));

  if (fichaTitulo && fichaEntradas.length > 0) {
    cuerpo.push({
      tipo: "ficha",
      titulo: fichaTitulo,
      entradas: fichaEntradas,
    });
  } else if (fichaEntradas.length > 0) {
    /*
     * Entradas sin ningún título que las encabece: **no se fuerza una ficha**.
     *
     * El primer intento fue ascender la primera entrada a título del recuadro,
     * y se comía su texto: en la página 5, «Los Plátanos: recuperar la
     * identidad del barrio» pasó a ser el título y su descripción entera
     * desapareció.
     *
     * Cada entrada sale como subtítulo más párrafo, que es exactamente lo que
     * la MISMA página hace con las otras cuatro plazas: las que caen en una
     * columna de texto se leen como sección y las que caen al costado se leían
     * como recuadro, por dónde están y no por lo que son. Así las ocho quedan
     * iguales, y no se pierde una palabra.
     */
    for (const entrada of fichaEntradas) {
      cuerpo.push({ tipo: "subtitulo", texto: entrada.lead });
      cuerpo.push({ tipo: "parrafo", texto: entrada.texto });
    }
  } else if (fichaTitulo) {
    // Un título de recuadro sin entradas es, casi siempre, el encabezado de una
    // ilustración: en la página 2, «Distribución de las 246 plazas y plazoletas
    // de la ciudad» titula el mapa. Como subtítulo queda donde va, y se dejaba
    // caer.
    cuerpo.push({ tipo: "subtitulo", texto: fichaTitulo });
  }

  /* ---------------------------------------------- las figuras que sobraron */

  for (const figura of figuras) {
    if (usadas.has(figura)) continue;
    const epi = epigrafeDeFigura.get(figura);
    cuerpo.push({
      tipo: "foto",
      src: figura.src,
      alt:
        epi?.texto ||
        `Imagen de la página ${cruda.pagina} de la edición impresa`,
      ...(epi ? { epigrafe: epi.texto } : {}),
      ...(creditos[0] ? { credito: creditos[0] } : {}),
    });
  }

  return {
    pagina: cruda.pagina,
    clase,
    titulo,
    bajada,
    imagen,
    cuerpo,
    descartado,
    avisos,
    depuracion: conRol.map((c) => ({
      rol: c.rol,
      texto: c.grupo.texto.slice(0, 90),
      columna: c.grupo.columna,
      x: Math.round(c.grupo.x),
      y: Math.round(c.grupo.y),
      tam: c.grupo.tam,
      fuente: c.grupo.fuente,
    })),
  };
}

/**
 * Una página que no es prosa: una galería o una infografía.
 *
 * Acá no se intenta armar un texto que no existe. Se toma la línea más grande
 * como título, lo que quede de texto como bajada, y las figuras se emiten en el
 * orden en que estaban impresas, cada una con el rótulo que tenía al lado.
 */
function paginaGrafica(
  cruda: PaginaPdfCruda,
  lineas: Linea[],
  creditos: string[],
  descartado: string[],
  avisos: string[],
): PaginaDigitalizada {
  /*
   * El título de una página gráfica, si es que tiene.
   *
   * "La línea más grande" no alcanza, y la página 7 lo demuestra: es la
   * continuación de la galería de la 6, no tiene ningún título, y sus seis
   * rótulos de foto —todos del mismo cuerpo— se juntaban en un titular que
   * decía «Plaza 1º de Mayo Plazoleta Azopardo Plaza 1º de Mayo Plaza
   * Convivencia…».
   *
   * Un título es una línea, o dos, ARRIBA. Seis líneas del mismo tamaño
   * desparramadas por toda la página son rótulos, y entonces la página no tiene
   * título y hay que decirlo en vez de inventar uno.
   */
  const mayor = [...lineas].sort((a, b) => b.tam - a.tam)[0];
  const candidatas = mayor
    ? lineas.filter((l) => l.tam === mayor.tam).sort((a, b) => a.y - b.y)
    : [];
  const esTitulo =
    candidatas.length > 0 &&
    candidatas.length <= 3 &&
    candidatas[0].y < cruda.alto * 0.3;

  const titulo = esTitulo
    ? candidatas.map((l) => l.texto.trim()).join(" ")
    : "";

  if (!mayor) {
    avisos.push("La página no tiene texto: quedó sólo con imágenes.");
  } else if (!esTitulo) {
    avisos.push(
      "La página no tiene un título propio: es una galería o la continuación " +
        "de la página anterior. Hay que ponerle uno a mano.",
    );
  }

  // Los rótulos de las fotos: todo lo que no se usó como título.
  const usadasEnTitulo = new Set(esTitulo ? candidatas : []);
  const rotulos = lineas.filter((l) => !usadasEnTitulo.has(l));

  /** El rótulo de una figura es el que cae DENTRO de su caja o justo debajo:
   *  en una galería el nombre de la plaza va sobre la foto misma. */
  const rotuloDe = (f: FiguraPagina): Linea | null => {
    let mejor: Linea | null = null;
    for (const r of rotulos) {
      const dentro =
        r.x >= f.x - 10 &&
        r.x <= f.x + f.ancho + 10 &&
        r.y >= f.y - 10 &&
        r.y <= f.y + f.alto + 30;
      if (!dentro) continue;
      if (!mejor || r.y > mejor.y) mejor = r;
    }
    return mejor;
  };

  const usados = new Set<Linea>();
  const cuerpo: BloqueNota[] = [];
  const enOrden = [...cruda.figuras].sort((a, b) => a.y - b.y || a.x - b.x);

  for (const figura of enOrden) {
    const rotulo = rotuloDe(figura);
    if (rotulo) usados.add(rotulo);
    cuerpo.push({
      tipo: "foto",
      src: figura.src,
      alt:
        rotulo?.texto.trim() ||
        `Imagen de la página ${cruda.pagina} de la edición impresa`,
      ...(rotulo ? { epigrafe: rotulo.texto.trim() } : {}),
      ...(creditos[0] ? { credito: creditos[0] } : {}),
    });
  }

  // El texto que no rotulaba ninguna foto es de la página: un copete, una
  // pregunta al pie. Va como párrafo, en el orden en que estaba.
  const sueltos = rotulos
    .filter((l) => !usados.has(l))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const bajada = sueltos.length > 0 ? sueltos[0].texto.trim() : "";
  for (const l of sueltos.slice(1)) {
    cuerpo.push({ tipo: "parrafo", texto: l.texto.trim() });
  }

  return {
    pagina: cruda.pagina,
    clase: "grafica",
    titulo,
    bajada,
    cuerpo,
    descartado,
    avisos,
    depuracion: lineas.map((l) => ({
      rol: usadasEnTitulo.has(l) ? ("titular" as Rol) : ("suelto" as Rol),
      texto: l.texto.slice(0, 90),
      columna: l.columna,
      x: Math.round(l.x),
      y: Math.round(l.y),
      tam: l.tam,
      fuente: l.fuente,
    })),
  };
}
