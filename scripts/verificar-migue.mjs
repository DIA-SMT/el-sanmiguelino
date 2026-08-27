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
  HABLA_DE_OTRA,
  PIDE_EL_INDICE,
  interpretar,
  respuestaSobreElDiario,
  simplificar,
} = await import(
  new URL("../src/lib/migue/interpretacion.ts", import.meta.url).href
);

const DIARIO = {
  mes: "Agosto de 2026",
  numero: 8,
  proxima: { mes: "Septiembre de 2026", fecha: "1 de septiembre de 2026" },
  archivo: ["Julio de 2026", "Junio de 2026"],
};

/** El camino que toma una pregunta, igual que en la ruta. */
function camino(pregunta) {
  const s = simplificar(pregunta);
  if (ES_SOLO_UN_SALUDO.test(s)) return "saludo";
  if (PIDE_EL_INDICE.some((p) => p.test(s)) && !HABLA_DE_OTRA.test(s)) {
    return "indice";
  }
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
