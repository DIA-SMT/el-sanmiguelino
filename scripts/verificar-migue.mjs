/**
 * El corpus de Migue: qué camino toma cada cosa que le escriben.
 *
 * Se corre con `npm run verificar:migue`. Existe por un error concreto y caro:
 * un cambio en el patrón del índice se escribió pensando que lo hacía más
 * angosto, se probó con diecisiete casos elegidos a mano —todos sobre el
 * diario— y salió a producción. El patrón matcheaba `que <algo> tiene/hay`, o
 * sea la forma de casi cualquier pregunta de un vecino: "¿qué horario tiene el
 * Registro Civil?" recibía de vuelta la lista de notas de agosto, sin pasar por
 * el modelo y anotada como respondida.
 *
 * De ahí las dos reglas de este archivo:
 *
 * 1. **La mayoría de los casos son preguntas de vecinos**, no preguntas sobre
 *    el diario. Son las que tienen que pasar de largo, y son las que nadie
 *    piensa en probar cuando está tocando un patrón "del diario".
 * 2. **Los atajos saltean al modelo.** Un falso negativo cuesta una llamada;
 *    un falso positivo le cambia la respuesta al vecino. Por eso todo lo que
 *    no sea inequívoco tiene que pasar de largo.
 *
 * Importa el `.ts` directo, como los verificadores de comentarios. Se apoya en
 * que `interpretacion.ts` no tiene ningún import de valor.
 */
const {
  ES_SOLO_UN_SALUDO,
  PIDE_AUDIO_DE_OTRA_NOTA,
  PIDE_QUE_LE_LEA,
  HABLA_DE_OTRA,
  PIDE_EL_INDICE,
  interpretar,
  respuestaSobreElDiario,
  simplificar,
  paginaPedida,
  ES_PEDIDO_DE_CONTINUACION,
} = await import(
  new URL("../src/lib/migue/interpretacion.ts", import.meta.url).href
);

const DIARIO = {
  mes: "Agosto de 2026",
  numero: 8,
  proxima: { mes: "Septiembre de 2026", fecha: "1 de septiembre de 2026" },
  archivo: ["Julio de 2026", "Junio de 2026"],
};

/**
 * El camino que toma una pregunta, **en el mismo orden que la ruta**.
 *
 * El orden importa y por eso se copia: saludo, índice, leer la página, audio de
 * otra nota, y recién al final el diario. Una frase puede matchear dos atajos y
 * lo que decide es cuál corre primero; si este archivo los evaluara en otro
 * orden, verificaría un sistema que no existe.
 *
 * Lo que NO se puede reproducir acá es si el pedido de audio de otra nota
 * encuentra a cuál se refería: eso necesita el índice de la edición. Este
 * archivo verifica que la INTENCIÓN se reconozca —que es donde están los falsos
 * positivos que duelen—; que resuelva la nota correcta se prueba con la
 * edición cargada.
 */
function camino(pregunta) {
  const s = simplificar(pregunta);
  if (ES_SOLO_UN_SALUDO.test(s)) return "saludo";
  if (PIDE_EL_INDICE.some((p) => p.test(s)) && !HABLA_DE_OTRA.test(s)) {
    return "indice";
  }
  // Los dos atajos de la voz. A diferencia del saludo y del índice, valen
  // también en medio de una charla: el referente no sale de la conversación.
  if (PIDE_QUE_LE_LEA(s)) return "leer";
  if (PIDE_AUDIO_DE_OTRA_NOTA(s)) return "audio-de-otra";
  // En la ruta esto corre al final, sólo si el buscador no encontró nada.
  if (respuestaSobreElDiario(s, DIARIO)) return "diario";
  return "modelo";
}

let fallas = 0;
function grupo(titulo, esperado, frases) {
  const malas = frases.filter((f) => camino(f) !== esperado);
  fallas += malas.length;
  console.log(
    `  ${malas.length === 0 ? "ok " : "MAL"} ${titulo}: ${frases.length - malas.length}/${frases.length}`,
  );
  for (const m of malas) console.log(`        "${m}"  ->  ${camino(m)} (debía ser ${esperado})`);
}

console.log("\nQUÉ CAMINO TOMA CADA COSA\n");

/*
 * Leer en voz alta.
 *
 * El atajo exige DOS cosas a la vez —un verbo de escuchar Y una referencia a la
 * página en la que el lector está parado— y estos dos grupos existen para que
 * nadie afloje una de las dos. Aflojarlas convierte "dónde puedo escuchar
 * música en vivo" en una orden de audio, que es exactamente la misma clase de
 * error que ya cometió el atajo del índice con las preguntas de los vecinos.
 */
grupo("Piden que Migue les lea la página", "leer", [
  "resumime con un audio la pagina en la que estoy",
  "leeme esto",
  "leemelo",
  "leeme esta nota",
  "¿me lees esta nota en voz alta?",
  "quiero escuchar esta nota",
  "me lo pasas a audio? esto",
  "leeme la pagina en la que estoy",
]);

/*
 * Piden el audio de OTRA nota, no de la página donde están.
 *
 * Salió de un caso real en producción: "dame un resumen en audio de bacheo",
 * escrito desde la tapa. Acá la segunda condición no es la página actual sino
 * una unidad de contenido del diario —nota, noticia, resumen, tapa—, que es lo
 * que separa un pedido de audio del diario de la pregunta de un vecino.
 */
grupo("Piden el audio de otra nota", "audio-de-otra", [
  "dame un resumen en audio de bacheo",
  "leeme la nota del parque",
  "quiero escuchar la nota sobre el transporte",
  "pasame un audio de la nota de la peatonal",
  "me haces un resumen en audio de la agenda cultural",
  "escuchame la noticia del bacheo",
  // La forma mas corta y mas comun, y la que se escapaba: no dice "nota".
  "dame un audio de la peatonal",
  "y ahora dame un audio de la peatonal",
  "pasame el audio del transporte",
  "leeme lo del parque",
]);

/*
 * Tienen el verbo pero NO hablan de la página NI del diario: son preguntas de
 * vecinos y van al modelo.
 *
 * Las dos últimas son la razón por la que `leer` a secas quedó fuera de la lista
 * de verbos que piden audio: "quiero leer la nota del parque" tiene verbo Y
 * tiene unidad de contenido, y es alguien que quiere leerla con los ojos.
 * Convertirlo en audio sería el mismo error de siempre, con otra ropa.
 */
grupo("Hablan de escuchar o leer, pero no piden audio", "modelo", [
  "donde puedo escuchar musica en vivo",
  "cuando puedo escuchar la banda municipal",
  "donde escucho el recital de septiembre",
  "donde hay talleres de lectura",
  "quiero leer sobre el parque 9 de julio",
  "hay audioguias en el museo",
  "quiero leer la nota del parque",
  "donde leo la noticia del bacheo",
]);

/*
 * Preguntas de vecinos. **Ninguna** puede caer en un atajo: son para el modelo,
 * que tiene las notas de la edición delante. Éstas son las que se rompieron.
 */
grupo("Preguntas del municipio", "modelo", [
  "¿Qué horario tiene el Registro Civil?",
  "que horario tiene el registro civil",
  "que telefono tiene defensa civil",
  "¿Qué número de teléfono tiene Defensa Civil?",
  "que tramites hay que hacer para el carnet de sanidad",
  "que documentacion hay que llevar para la licencia de conducir",
  "que dias hay recoleccion de residuos en villa 9 de julio",
  "que costo tiene la habilitacion comercial",
  "cuales son los requisitos que hay que cumplir para habilitar un kiosco",
  "de que trata la ordenanza del estacionamiento medido",
  "de que va el plan de bacheo",
  "que actividades hay en el parque este finde",
  "que paso con el bacheo",
  "cuando abre el registro civil",
  "donde queda el archivo historico de la municipalidad?",
  "necesito el archivo de mi expediente, donde lo pido",
  "el abono diario del colectivo cuando aumenta?",
  "a que numero llamo cuando hay un bache?",
  "cual es el numero nuevo de la guardia?",
  "cuando arreglan la calle que salio en el diario",
  "cuando sale la obra del parque?",
  "che una consulta, hay poda en mi cuadra?",
  "quien hace el diario? le quiero mandar una carta de lector",
  "que hay que llevar para el carnet de conducir",
]);

/* Pedidos del sumario: nombran a la edición o piden el índice con esa palabra. */
grupo("Piden el índice", "indice", [
  "que notas trae esta edicion",
  "¿Qué notas trae esta edición?",
  "que temas hay en la edicion",
  "mostrame el indice",
  "el sumario",
  "que trae la edicion",
  "de que trata la edicion",
  "que noticias tiene la edicion de este mes",
]);

/* Saludo y nada más. Pegado a una pregunta, ya no es su turno. */
grupo("Saludos solos", "saludo", [
  "hola",
  "Hola!",
  "¡Hola, Migue!",
  "buenas",
  "buenas, como estas?",
  "Buen día",
  "buenas tardes",
  "hey",
]);

/* Sobre el diario mismo. En la ruta esto contesta sólo si el buscador falló. */
grupo("Sobre el diario", "diario", [
  "cuando sale la proxima edicion?",
  "¿Cuándo sale la próxima edición?",
  "para cuando el proximo numero",
  "cada cuanto sale la edicion",
  "hay ediciones anteriores?",
  "que ediciones pasadas hay del diario",
  "cuando sale el proximo numero",
  // Pegada a un saludo: el saludo ya no se come la pregunta.
  "hola, cuando sale la proxima edicion?",
]);

/*
 * Gustos y recomendaciones. Van al modelo: son sobre las notas de la edición,
 * pero la respuesta es una elección, no un dato. Ningún atajo puede contestarlas
 * —el del índice devolvería la lista entera, que es lo mismo que no contestar—.
 */
grupo("Gustos y recomendaciones", "modelo", [
  "y cual es la mas divertida?",
  "¿cuál me recomendás?",
  "que me recomendas leer",
  "cual leo primero",
  "cual es la mas importante",
  "hay algo interesante",
  "que onda, algo copado para el finde",
  // Resumir lo que se esta leyendo: va al modelo, que es el unico que sabe en
  // que pagina esta parado el lector.
  "resumime esta pagina",
  "de que va esta nota",
  "haceme un resumen de lo que estoy leyendo",
  "cual esta buena",
]);

/* Charla: ni atajo ni ficha. Va al modelo, que sabe seguir el hilo. */
grupo("Charla", "modelo", [
  "escuchame",
  "decime",
  "dale",
  "gracias!",
  "che",
  "una consulta",
  "mira",
]);

/*
 * El parser. Cada entrada de acá es una forma que el modelo escribió de verdad
 * o que escribe habitualmente; las dos primeras salieron a pantalla.
 */
/*
 * Nombrar una página por su número.
 *
 * **Las tres primeras frases salieron del registro de consultas de
 * producción**, tal como las escribió un lector, y son el motivo de que esta
 * función exista: de las tres veces que alguien pidió una página por número,
 * DOS escribió el ordinal antes del sustantivo. La primera versión del arreglo
 * sólo miraba después —"la pag 3"— y dejaba afuera al caso mayoritario, así que
 * el bug seguía vivo con el arreglo puesto.
 *
 * Y las dos últimas son las que NO tienen que disparar: una frase que menciona
 * cuántas páginas hay no está pidiendo ninguna.
 */
console.log("\nNOMBRAR UNA PÁGINA POR SU NÚMERO\n");
const PAGINAS = [
  ["resumime en audio la 3ra pagina", 3],
  ["resumime la 2da pagina", 2],
  ["resumime en audio la pag 3", 3],
  ["leeme la pagina 3", 3],
  ["leeme la tercera pagina", 3],
  ["que dice la hoja 5", 5],
  ["contame de la página 8", 8],
  ["pag. 4", 4],
  ["la edicion tiene 8 paginas", null],
  ["cuantas paginas tiene", null],
  ["que plazas se renovaron", null],
];
for (const [frase, esperado] of PAGINAS) {
  const dio = paginaPedida(simplificar(frase));
  const mal = dio !== esperado;
  fallas += mal ? 1 : 0;
  console.log(
    `  ${mal ? "MAL" : "ok "} ${JSON.stringify(frase)} -> ${dio}` +
      (mal ? `  (esperado ${esperado})` : ""),
  );
}

/*
 * Pedidos de continuación: no traen tema, el tema quedó en el mensaje anterior.
 *
 * "de nuevo" salió del mismo registro. Sin reconocerlo, quedaba el token
 * `nuevo`, que puntúa contra la nota "Pensar de nuevo los espacios públicos" y
 * se la llevaba puesta: Migue cambiaba de nota en mitad de la conversación.
 */
console.log("\nPEDIDOS DE CONTINUACIÓN\n");
const CONTINUACIONES = [
  ["de nuevo", true],
  ["otra vez", true],
  ["repetilo", true],
  ["dale", true],
  ["de nuevo el resumen de la pag 3", false],
  ["contame de nuevo sobre las plazas", false],
];
for (const [frase, esperado] of CONTINUACIONES) {
  const dio = ES_PEDIDO_DE_CONTINUACION(simplificar(frase));
  const mal = dio !== esperado;
  fallas += mal ? 1 : 0;
  console.log(
    `  ${mal ? "MAL" : "ok "} ${JSON.stringify(frase)} -> ${dio}` +
      (mal ? `  (esperado ${esperado})` : ""),
  );
}

console.log("\nLO QUE EL MODELO CONTESTA\n");
const casos = [
  ["FUENTE pelado", "Hay obras.\nFUENTE: plan-bacheo", { texto: "Hay obras.", notaSlug: "plan-bacheo" }],
  ["FUENTE como enlace", "Hay obras.\nFUENTE: [plan-bacheo](plan-bacheo)", { texto: "Hay obras.", notaSlug: "plan-bacheo" }],
  ["FUENTE en negrita", "Hay obras.\n\n**FUENTE:** plan-bacheo", { texto: "Hay obras.", notaSlug: "plan-bacheo" }],
  ["FUENTE en viñeta", "Hay obras.\n- FUENTE: plan-bacheo", { texto: "Hay obras.", notaSlug: "plan-bacheo" }],
  ["FUENTE citada", "Hay obras.\n> FUENTE: plan-bacheo", { texto: "Hay obras.", notaSlug: "plan-bacheo" }],
  ["FUENTE en cursiva", "Hay obras.\n*FUENTE: plan-bacheo*", { texto: "Hay obras.", notaSlug: "plan-bacheo" }],
  ["dos FUENTE", "Hay obras.\nFUENTE: plan-bacheo\nFUENTE: peatonal-led", { texto: "Hay obras.", notaSlug: "plan-bacheo" }],
  ["sin respuesta", "[SIN_RESPUESTA] Eso no está en la edición.", { texto: "Eso no está en la edición.", sinRespuesta: true }],
  ["charla", "Dale, decime.\nCHARLA", { texto: "Dale, decime.", charla: true }],
  ["charla en negrita", "Dale, decime.\n**CHARLA**", { texto: "Dale, decime.", charla: true }],
  // Con punto: así la escribió el modelo en producción, y así llegó a la
  // pantalla de un lector.
  ["charla con punto", "Dale, decime.\nCHARLA.", { texto: "Dale, decime.", charla: true }],
  ["charla con punto y negrita", "Dale, decime.\n**CHARLA.**", { texto: "Dale, decime.", charla: true }],
  ["fuente con punto final", "Hay obras.\nFUENTE: plan-bacheo.", { texto: "Hay obras.", notaSlug: "plan-bacheo" }],
  ["respuesta normal", "Hola, soy Migue.", { texto: "Hola, soy Migue.", notaSlug: undefined, charla: false }],
];
for (const [nombre, crudo, esperado] of casos) {
  const r = interpretar(crudo);
  const mal = Object.entries(esperado).filter(([k, v]) => r[k] !== v);
  fallas += mal.length ? 1 : 0;
  console.log(`  ${mal.length ? "MAL" : "ok "} ${nombre}`);
  for (const [k, v] of mal) {
    console.log(`        ${k}: ${JSON.stringify(r[k])}  (esperado ${JSON.stringify(v)})`);
  }
}

/* Que la línea de servicio NUNCA quede a la vista es la propiedad que importa. */
const filtrados = casos.filter(([, crudo]) => {
  const t = interpretar(crudo).texto.toUpperCase();
  return t.includes("FUENTE") || t.includes("CHARLA") || t.includes("SIN_RESPUESTA");
});
if (filtrados.length) {
  fallas += filtrados.length;
  console.log(`\n  MAL: ${filtrados.length} caso(s) le muestran una línea de servicio al lector`);
} else {
  console.log("\n  ok  ninguna línea de servicio llega a la pantalla");
}

console.log(fallas === 0 ? "\nTODO OK\n" : `\n${fallas} FALLAS\n`);
process.exit(fallas === 0 ? 0 : 1);
