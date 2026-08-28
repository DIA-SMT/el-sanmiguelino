/**
 * Cómo Migue entiende lo que le escriben, y cómo lee lo que el modelo contesta.
 *
 * Vive aparte de `openrouter.ts` por una razón concreta: acá no hay red, no
 * hay base y no hay `server-only`, así que **se puede verificar contra un
 * corpus de preguntas de verdad** con `npm run verificar:migue`.
 *
 * Ese corpus existe porque un cambio en el patrón del índice —que parecía más
 * angosto y resultó mucho más ancho— hizo que "¿qué horario tiene el Registro
 * Civil?" recibiera de vuelta la lista de notas de agosto, en producción. Lo
 * que decide caminos tiene que poder probarse con lo que la gente escribe.
 */

/**
 * La pregunta en su forma más simple: minúsculas y sin tildes.
 *
 * Todo lo que decide un camino mira **esta** versión y no el texto crudo. No es
 * cosmético: `\b` es ASCII, así que en "¿Qué notas trae?" la `é` no cuenta como
 * letra y `\bqué\b` no matchea. El atajo del índice fallaba exactamente ahí —
 * andaba con "que notas trae" y no con "¿Qué notas trae?", que es la misma
 * pregunta bien escrita.
 *
 * Y es lo que corresponde igual: la gente escribe sin tildes y en minúscula.
 */
export function simplificar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Un saludo **y nada más**.
 *
 * Anclado a propósito. Antes alcanzaba con que la palabra apareciera en algún
 * lado, así que "hola, ¿cuándo sale la próxima edición?" se comía la pregunta y
 * devolvía un saludo. Saludar es lo único que este atajo sabe hacer: si el
 * saludo viene pegado a otra cosa, no es su turno.
 */
export const ES_SOLO_UN_SALUDO =
  /^[\s¡!¿?,.]*(hola|buenas|buen dia|buenas tardes|buenas noches|holis|hey|ey)([\s,!¡.]*(migue|como estas|como andas|que tal|todo bien))?[\s!¡.?]*$/;

/**
 * Pide el sumario de la edición. **Sin ambigüedad, o no dispara.**
 *
 * La versión anterior fue `que|cuales` + hasta 24 caracteres + `notas|temas|
 * trae|tiene|hay`, y eso resultó ser la forma de las preguntas normales de un
 * vecino, no la del pedido de sumario: "¿qué horario tiene el Registro Civil?",
 * "qué trámites hay para el carnet", "qué teléfono tiene Defensa Civil". Las
 * tres recibían la lista de notas de agosto y ni siquiera llegaban al modelo.
 * El patrón viejo —el de antes de ese cambio— las contestaba bien.
 *
 * Por eso ahora se exige que la pregunta nombre a la edición o pida el índice
 * con esa palabra. Errar de menos no cuesta nada: lo que no matchea va al
 * modelo, que tiene la lista de notas en el prompt y contesta bien igual. Errar
 * de más le come la pregunta al vecino y encima la anota como respondida.
 */
export const PIDE_EL_INDICE = [
  /\b(indice|sumario)\b/,
  /\b(notas|temas|noticias|articulos)\b[^?]{0,20}\bedicion\b/,
  /\bedicion\b[^?]{0,20}\b(notas|temas|noticias|articulos)\b/,
  /\bque (trae|tiene) (la|esta) edicion\b/,
  /\bde que (trata|va) (la|esta) edicion\b/,
];

/**
 * Habla de otra edición, no de la que está en la calle.
 *
 * Los plurales van explícitos: `\b` corta antes de la "s", así que `anterior`
 * no matchea "anteriores" —que es como se pregunta de verdad—.
 */
export const HABLA_DE_OTRA =
  /\b(proxim[ao]s?|siguiente|que viene|anterior(es)?|pasad[ao]s?|archivo)\b/;

export interface RespuestaMigue {
  texto: string;
  /** El slug que el modelo dice haber usado, si dijo alguno. */
  notaSlug?: string;
  /** true cuando el modelo declaró que la respuesta no está en la edición.
   *  Es lo que alimenta "Lo que no supimos contestar". */
  sinRespuesta: boolean;
  /** true cuando el mensaje era sólo charla. No cuenta como pregunta: sin
   *  esto, cada "gracias" inflaba la cobertura del tablero. */
  charla: boolean;
}

/**
 * La marca con la que el modelo avisa que no encontró la respuesta.
 *
 * Se le pide una marca literal en vez de interpretar el texto: adivinar por
 * frases ("no encontré", "no tengo información") es frágil y el tablero de
 * Migue depende de este dato. Se saca antes de mostrar la respuesta.
 */
export const MARCA_SIN_RESPUESTA = "[SIN_RESPUESTA]";

/**
 * Lo que Migue sabe **sobre el diario mismo**.
 *
 * Existe por una respuesta concreta: a "¿cuándo sale la próxima edición?"
 * contestaba "no hay información sobre eso en la edición de Agosto". Cierto y
 * completamente inútil — el asistente de un mensual tiene que saber cuándo
 * sale el mensual. El dato estaba en la base todo el tiempo; nadie se lo pasaba.
 *
 * Son hechos que salen de la base, no conocimiento del modelo: la misma regla
 * de siempre, aplicada a un tema del que antes no teníamos ficha.
 */
export interface SobreElDiario {
  mes: string;
  numero: number;
  /** La que viene, si ya está cargada y con fecha. */
  proxima?: { mes: string; fecha: string };
  /** Los meses del archivo, del más nuevo al más viejo. */
  archivo: string[];
}

export function fichaDelDiario(d: SobreElDiario): string {
  return [
    `- El Sanmiguelino es el diario digital de la Municipalidad de San Miguel de Tucumán. Sale una vez por mes.`,
    `- La edición que está en la calle es la de ${d.mes}, número ${d.numero}.`,
    d.proxima
      ? `- La próxima es la de ${d.proxima.mes} y sale el ${d.proxima.fecha}.`
      : `- La próxima todavía no tiene fecha cargada. El diario es mensual, así que sale el mes que viene, pero no prometas un día concreto.`,
    d.archivo.length
      ? `- En el archivo se pueden leer las ediciones anteriores: ${d.archivo.join(", ")}.`
      : `- Esta es la primera edición: todavía no hay archivo.`,
    `- El sitio tiene buscador, las notas están agrupadas en secciones, y los lectores pueden comentar las notas: los comentarios se publican al instante.`,
  ].join("\n");
}

/**
 * Preguntas sobre el diario mismo, contestadas **sin modelo**.
 *
 * Es el camino de emergencia: cuando OpenRouter no está o se llenó el cupo de
 * la hora, Migue cae al buscador por palabras clave, y ahí "¿cuándo sale la
 * próxima?" recibiría "no encontré nada en la edición de agosto".
 *
 * Corre **después** del buscador y sólo cuando el buscador no encontró nada.
 * Antes corría primero, y eso le robaba preguntas que la edición sí contestaba:
 * "cuándo abre la edición 2026 del Septiembre Musical" tiene la nota escrita, y
 * recibía la fecha de publicación del diario. Puesta al final, un falso
 * positivo de acá sólo puede reemplazar un "no encontré nada", que es el peor
 * resultado posible de todos modos.
 *
 * Los tres casos exigen que la pregunta nombre al diario —el del archivo
 * también, que antes se disparaba con la palabra "archivo" suelta y le
 * contestaba la lista de meses a quien preguntaba por el Archivo Histórico
 * Municipal—. Y "diario" y "número" sueltos no alcanzan: son el abono diario y
 * el número de teléfono antes que este diario.
 */
export function respuestaSobreElDiario(
  /** Ya simplificada: minúsculas y sin tildes. Ver simplificar(). */
  p: string,
  d: SobreElDiario,
): string | null {
  const nombraElDiario =
    /\b(edicion|ediciones|sanmiguelino|periodico)\b/.test(p) ||
    (/\b(numero|diario)\b/.test(p) &&
      /\b(sale|salen|sacan|publica|publican|proxim[ao])\b/.test(p));
  if (!nombraElDiario) return null;

  if (/\b(proxim[ao]|siguiente|que viene|nuev[ao]|cuando|que dia|para cuando)\b/.test(p)) {
    return d.proxima
      ? `La próxima es la edición de ${d.proxima.mes} y sale el ${d.proxima.fecha}. Mientras tanto tenés la de ${d.mes}.`
      : `Todavía no hay fecha para la próxima. El Sanmiguelino sale una vez por mes, así que la que viene es la del mes próximo; la que está en la calle es la de ${d.mes}.`;
  }

  if (/\b(cada cuanto|frecuencia|seguido)\b/.test(p)) {
    return `El Sanmiguelino sale una vez por mes. La edición que está en la calle es la de ${d.mes}.`;
  }

  if (/\b(anteriores|viejas|viejos|pasados|pasadas|archivo)\b/.test(p)) {
    return d.archivo.length
      ? `En el archivo están las ediciones anteriores: ${d.archivo.join(", ")}. La de ahora es la de ${d.mes}.`
      : `Todavía no hay archivo: la de ${d.mes} es la primera edición.`;
  }

  return null;
}

/**
 * Separa del texto que ve el lector las líneas de servicio: la marca de "no
 * está en la edición", la fuente y la de charla.
 *
 * Se hace **línea por línea y no con una expresión regular**, después de que el
 * patrón fallara dos veces seguidas en producción por lo mismo: pedía una forma
 * exacta y el modelo escribía otra. Primero fue `FUENTE: [slug](slug)`, un
 * enlace de markdown. Después, con el patrón ya "tolerante", seguían pasando
 * `**FUENTE:** slug`, `- FUENTE: slug` y `> FUENTE: slug` —poner el rótulo en
 * negrita o en viñeta es el hábito más común del modelo—, y además sólo se
 * sacaba la PRIMERA línea, así que una respuesta con dos notas le mostraba la
 * segunda al lector.
 *
 * Ahora se le saca a cada línea todo lo que sea puntuación de markdown y
 * espacio, y se mira si lo que queda EMPIEZA con la palabra de servicio. El
 * slug se rescata de la línea original. Ser estricto acá no protege de nada: lo
 * único que logra es dejar basura en pantalla, y el slug igual se verifica
 * después contra la edición.
 */
export function interpretar(crudo: string): RespuestaMigue {
  let texto = crudo.trim();

  const sinRespuesta = texto.includes(MARCA_SIN_RESPUESTA);
  texto = texto.replaceAll(MARCA_SIN_RESPUESTA, "").trim();

  let notaSlug: string | undefined;
  let charla = false;
  const quedan: string[] = [];

  for (const linea of texto.split("\n")) {
    // Se le saca la puntuación de markdown Y la del final. El modelo escribió
    // "CHARLA." con punto y la línea entera terminó a la vista del lector: es la
    // tercera marca que se filtra por pedir una forma exacta.
    const pelada = linea
      .replace(/[>*_#\-`~\s]/g, "")
      .replace(/[.,;:!¡?¿]+$/, "")
      .toUpperCase();
    if (pelada.startsWith("FUENTE:")) {
      // El primer slug de la primera línea de fuente. Si el modelo cita dos
      // notas, se enlaza una sola y las dos líneas se van igual.
      notaSlug ??= (linea.match(/[a-z0-9]+(?:-[a-z0-9]+)+/) ?? [])[0];
      continue;
    }
    /*
     * La marca de charla ya NO se pide —ver `instrucciones()`—, pero se sigue
     * barriendo: el modelo la venía escribiendo y una respuesta vieja en el
     * historial de alguien puede traerla.
     *
     * Se sacó de las instrucciones porque servía sólo para una métrica del
     * tablero —que un "gracias" no contara como pregunta— y a cambio le puso la
     * palabra CHARLA en la pantalla a un lector del diario oficial. Encima el
     * modelo la ponía también en respuestas de verdad, así que la métrica que
     * venía a arreglar tampoco quedaba bien.
     */
    if (pelada === "CHARLA") {
      charla = true;
      continue;
    }
    quedan.push(linea);
  }

  return { texto: quedan.join("\n").trim(), notaSlug, sinRespuesta, charla };
}


/**
 * Pide que Migue le LEA EN VOZ ALTA la página que está mirando.
 *
 * Exige **dos** cosas a la vez, y esa conjunción es todo el diseño: un verbo de
 * escuchar/leer en voz alta, Y una referencia a la página en la que el lector
 * está parado. Cualquiera de las dos sola es la pregunta de un vecino:
 *
 * - "¿dónde puedo escuchar música en vivo?" tiene el verbo y no es para Migue.
 * - "¿qué dice esta nota sobre el parque?" tiene la referencia y va al modelo.
 *
 * Sólo las dos juntas —"leeme esto", "resumime con un audio la página en la que
 * estoy"— son inequívocamente un pedido de audio. Es la lección que costó cara
 * con `PIDE_EL_INDICE`: errar de menos no cuesta nada, porque lo que no matchea
 * va al modelo y se contesta igual; errar de más le come la pregunta al vecino.
 *
 * A diferencia del índice y del saludo, este atajo **sí vale en medio de una
 * charla**. Los otros dos se limitaron al primer mensaje porque saltean al
 * modelo y por lo tanto pierden el hilo; acá no hay hilo que perder: el
 * referente no sale de la conversación, sale de la ruta.
 */
const VERBO_DE_ESCUCHAR =
  /\b(lee|leer|leeme|leelo|leela|leemelo|leemela|leermelo|escuchar|escucharlo|escucharla|escuchame|audio|en voz alta|dictame|narrame|leemel[oa])\b/;

const ESTA_PAGINA =
  /\b(esta (pagina|nota|noticia|publicacion)|este (articulo|texto)|esto|aca|la pagina en la que estoy|la nota en la que estoy|donde estoy|lo que estoy (leyendo|viendo)|la pagina actual)\b/;

/** Un pedido pelado, sin nada más: "leemelo", "leeme esto". */
const SOLO_UN_LEEME =
  /^[\s¡!¿?,.]*(leeme|leemelo|leemela|leelo|leela|leermelo)([\s,]*(esto|esta nota|esta pagina))?[\s!¡.?]*$/;

export function PIDE_QUE_LE_LEA(simple: string): boolean {
  if (SOLO_UN_LEEME.test(simple)) return true;
  return VERBO_DE_ESCUCHAR.test(simple) && ESTA_PAGINA.test(simple);
}

/**
 * Pide el audio de una nota que **no** es la que está mirando.
 *
 * El caso que lo hizo falta: "dame un resumen en audio de bacheo", escrito
 * desde la tapa. Tiene el pedido de audio pero ninguna referencia a la página
 * actual —"esta página" ahí habría sido la tapa, no bacheo—, así que
 * `PIDE_QUE_LE_LEA` no dispara y Migue contesta en texto que eso no lo tiene.
 *
 * La segunda condición no es una referencia a la página sino a **una unidad de
 * contenido del diario**: nota, noticia, resumen, tapa. Esa palabra es lo que
 * separa un pedido de audio del diario de la pregunta de un vecino: "¿dónde
 * puedo escuchar música en vivo?" tiene el verbo y no nombra ninguna, así que
 * sigue yendo al modelo, que es donde tiene que ir.
 *
 * **`leer` a secas quedó afuera de la lista de verbos, y es deliberado.**
 * "quiero leer la nota del parque" es alguien que quiere leerla con los ojos:
 * tiene verbo y tiene unidad de contenido, y convertirlo en audio sería
 * exactamente el error que este archivo viene evitando. Los que entran son los
 * que sólo se pueden querer escuchando: `audio`, `en voz alta`, `escuchar`, y
 * los imperativos `leeme`/`leemelo`, que son "leer A MÍ" y no "leer".
 *
 * Encontrar la nota es otro problema y vive en la ruta: acá sólo se reconoce la
 * intención. Si después no hay una nota claramente mejor que las demás, la ruta
 * deja pasar al modelo — leerle en voz alta la nota equivocada es peor que
 * contestarle bien por escrito.
 */
const PIDE_AUDIO_EXPLICITO =
  /\b(audio|en voz alta|escuchar|escucharla|escucharlo|escuchame|leeme|leemelo|leemela|leelo|leela|dictame|narrame)\b/;

const MENCIONA_CONTENIDO =
  /\b(nota|notas|noticia|noticias|articulo|articulos|resumen|resumenes|tapa|portada|edicion)\b/;

export function PIDE_AUDIO_DE_OTRA_NOTA(simple: string): boolean {
  // El pedido sobre la página actual ya lo cubre `PIDE_QUE_LE_LEA`, y ese sabe
  // exactamente qué leer sin adivinar nada. Este es sólo para lo que aquél no
  // atrapa.
  if (PIDE_QUE_LE_LEA(simple)) return false;
  return PIDE_AUDIO_EXPLICITO.test(simple) && MENCIONA_CONTENIDO.test(simple);
}

/**
 * Las palabras que describen el PEDIDO y no el tema.
 *
 * Se sacan antes de buscar la nota: en "dame un resumen en audio de bacheo" lo
 * único que dice de qué nota hablamos es "bacheo". Sin quitarlas, "resumen" y
 * "audio" puntúan contra cualquier nota que las mencione —y hay una sobre
 * Migue que las menciona— y el desempate se lo lleva la nota equivocada.
 */
export const PALABRAS_DEL_PEDIDO = new Set([
  "dame", "damelo", "pasame", "quiero", "podes", "puedes", "necesito",
  "hacer", "haceme", "hace", "decime", "contame", "mandame", "ponme", "poneme",
  "audio", "voz", "alta", "escuchar", "escucharla", "escucharlo", "escuchame",
  "leeme", "leemelo", "leemela", "leelo", "leela", "leer", "lee", "lectura",
  "dictame", "narrame", "resumen", "resumenes", "resumime", "resumir",
  "nota", "notas", "noticia", "noticias", "articulo", "articulos",
  "tapa", "portada", "edicion", "sobre", "acerca", "por", "favor",
]);
