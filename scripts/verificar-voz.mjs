/**
 * Cómo se corta el texto que se lee en voz alta.
 *
 * Se corre con `npm run verificar:voz`. Es la única parte de la lectura hablada
 * que se puede verificar sin un navegador: todo lo demás —que la voz arranque
 * en iPhone, que Chrome no corte a los quince segundos, que el botón vuelva a
 * "Escuchar" al terminar— es comportamiento de `speechSynthesis` y hay que
 * probarlo en dispositivos de verdad. Por eso este archivo cubre la parte pura
 * hasta el fondo.
 *
 * Lo que se protege acá es lo que suena mal y no se ve mal: un corte en el medio
 * de "Av. Sarmiento" mete una pausa larga adentro de un nombre de calle, y un
 * corte en "15.000" hace que la voz diga "quince. Cero cero cero".
 *
 * Importa el `.ts` directo, igual que `verificar-migue.mjs`. Se apoya en que
 * `texto-para-escuchar.ts` no tiene ningún import de valor.
 */
const {
  MAXIMO_POR_PEDAZO,
  enOraciones,
  textoDeResumenDeNota,
  textoDeResumenDeTapa,
} = await import(
  new URL("../src/lib/voz/texto-para-escuchar.ts", import.meta.url).href
);

let fallas = 0;

function ok(nombre, condicion, detalle = "") {
  if (!condicion) fallas++;
  console.log(`  ${condicion ? "ok " : "MAL"} ${nombre}`);
  if (!condicion && detalle) console.log(`        ${detalle}`);
}

/* ------------------------------------------------------------------ cortes */

console.log("\nDónde NO se corta\n");

const noSeParte = [
  ["abreviatura de calle", "Se hará en Av. Sarmiento al 500. Y también en el parque."],
  ["separador de miles", "Asistieron 15.000 vecinos. Fue un récord."],
  ["número de edición", "Es la edición n.º 8. Sale en agosto."],
  ["iniciales de un nombre", "La obra de J. B. Alberdi sigue vigente. Hoy más que nunca."],
  ["doctor", "Habló el Dr. Pérez sobre la campaña. Después vino la intendenta."],
  ["decimal", "Sube 3.5 puntos este mes. El año pasado bajó."],
];

for (const [nombre, texto] of noSeParte) {
  const pedazos = enOraciones(texto);
  ok(
    `${nombre}: dos oraciones y no tres`,
    pedazos.length === 2,
    `dio ${pedazos.length}: ${JSON.stringify(pedazos)}`,
  );
}

console.log("\nDónde SÍ se corta\n");

ok(
  "punto, signo de pregunta y de exclamación",
  enOraciones("Una. ¿Dos? ¡Tres! Cuatro.").length === 4,
  JSON.stringify(enOraciones("Una. ¿Dos? ¡Tres! Cuatro.")),
);
ok(
  "dos puntos y punto y coma",
  enOraciones("Hay tres cosas: la primera; la segunda.").length === 3,
  JSON.stringify(enOraciones("Hay tres cosas: la primera; la segunda.")),
);

/* ------------------------------------------------------------ invariantes */

console.log("\nInvariantes de todo pedazo\n");

const LARGOS = [
  "El Ente Cultural de Tucumán, junto a la Municipalidad de San Miguel de Tucumán y a la Secretaría de Educación de la Provincia, anunció esta semana que el programa de talleres barriales, que el año pasado alcanzó a más de dos mil vecinos de distintos puntos de la ciudad, se amplía a los nueve municipios del área metropolitana durante el segundo semestre.",
  "Corto.",
  "Una oración sin ningún signo final",
  "   ",
  "",
  "SinEspaciosNiPuntosPeroMuyLargaUnaSolaPalabraQueNoSePuedePartirDeNingunaManeraRazonablePorqueEsUnaSolaPalabraDeVerdad",
];

for (const texto of LARGOS) {
  const pedazos = enOraciones(texto);
  const etiqueta = JSON.stringify(texto.slice(0, 34));
  ok(`${etiqueta}: ningún pedazo vacío`, pedazos.every((p) => p.trim().length > 0));
  ok(
    `${etiqueta}: ninguna palabra partida`,
    pedazos.join(" ").replace(/\s+/g, " ") ===
      texto.replace(/\s+/g, " ").trim(),
    `reconstruido: ${JSON.stringify(pedazos.join(" "))}`,
  );
}

const largo = enOraciones(LARGOS[0]);
ok(
  `una oración de 380 caracteres se parte en pedazos de menos de ${MAXIMO_POR_PEDAZO}`,
  largo.length > 1 && largo.every((p) => p.length <= MAXIMO_POR_PEDAZO),
  `largos: ${JSON.stringify(largo.map((p) => p.length))}`,
);
ok("un texto vacío no da pedazos", enOraciones("").length === 0);
ok("sólo espacios no da pedazos", enOraciones("   \n  ").length === 0);
ok(
  "una palabra sola larguísima se devuelve entera y no partida",
  enOraciones(LARGOS[5]).length === 1,
);

/* ------------------------------------------------------- los dos resúmenes */

console.log("\nEl texto que se arma\n");

const NOTA = {
  seccion: "Ciudad",
  titulo: "Nuevo sistema de transporte público",
  bajada:
    "La ciudad avanza hacia un sistema de transporte inteligente: a la tarjeta se suma el pago con código QR desde el celular, y una app mostrará en qué momento llega cada colectivo a la parada.",
};

const resumen = textoDeResumenDeNota(NOTA);
ok("el resumen empieza por la sección", resumen.startsWith("Ciudad."), resumen);
ok("contiene el titular", resumen.includes(NOTA.titulo));
ok("contiene la bajada entera", resumen.includes(NOTA.bajada));
ok("no hay puntos duplicados", !/\.\./.test(resumen), resumen);
ok(
  "no pasa de 450 caracteres",
  resumen.length <= 450,
  `mide ${resumen.length}`,
);

const pregunton = textoDeResumenDeNota({
  ...NOTA,
  titulo: "¿Cuándo abre el Parque 9 de Julio?",
});
ok(
  "un titular que ya termina en signo no recibe otro punto",
  pregunton.includes("Julio? La ciudad"),
  pregunton,
);

const tapaConTema = textoDeResumenDeTapa(
  { mes: "Agosto de 2026", numero: 8, tema: "Historia de San Miguel de Tucumán" },
  NOTA,
);
ok("la tapa nombra el número", tapaConTema.includes("edición número 8"));
ok("la tapa nombra el tema", tapaConTema.includes("Historia de San Miguel"));

/*
 * El repo mock NUNCA proyecta `tema`. O sea que sin DATABASE_URL este es el
 * único camino que corre, y es justo el que nadie prueba: un "El tema de esta
 * edición es undefined" sólo se descubre escuchándolo.
 */
const tapaSinTema = textoDeResumenDeTapa(
  { mes: "Agosto de 2026", numero: 8 },
  NOTA,
);
ok(
  "sin tema no dice 'undefined'",
  !/undefined/i.test(tapaSinTema),
  tapaSinTema,
);
ok("sin tema no deja el rótulo colgado", !tapaSinTema.includes("El tema"));

/* Que todo lo que se arma se pueda decir: cada pedazo dentro del límite. */
for (const [nombre, texto] of [
  ["resumen de nota", resumen],
  ["tapa con tema", tapaConTema],
  ["tapa sin tema", tapaSinTema],
]) {
  const pedazos = enOraciones(texto);
  ok(
    `${nombre}: se dice en pedazos de menos de ${MAXIMO_POR_PEDAZO}`,
    pedazos.length > 0 && pedazos.every((p) => p.length <= MAXIMO_POR_PEDAZO),
    `largos: ${JSON.stringify(pedazos.map((p) => p.length))}`,
  );
}

console.log(fallas === 0 ? "\nTODO OK\n" : `\n${fallas} FALLAS\n`);
process.exit(fallas === 0 ? 0 : 1);
