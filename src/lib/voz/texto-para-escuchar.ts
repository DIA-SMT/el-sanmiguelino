/**
 * El texto que se escucha, y cómo se corta para poder decirlo.
 *
 * **No lo redacta un modelo.** Lo que se lee en voz alta es la `bajada`, que ya
 * es el resumen: es obligatoria (`String` NOT NULL en el esquema), el panel la
 * pide con el texto "Las dos o tres líneas que resumen la nota", y sobre todo
 * **la aprobó un editor**. El Sanmiguelino es una publicación oficial del
 * municipio: una voz que le lee a un vecino un horario, una dirección o un
 * monto que un modelo completó es un riesgo que ningún ahorro de trabajo
 * justifica. Pedirle a un modelo que resuma un texto que ya viene resumido por
 * una persona es pagar plata, latencia y riesgo de invento para empeorar.
 *
 * El único import es de TIPO, igual que en `derivar.ts` y por la misma razón:
 * `import type` se borra al quitar los tipos, así que el alias `@/` nunca se
 * resuelve en tiempo de ejecución y `scripts/verificar-voz.mjs` puede importar
 * este archivo con Node suelto, sin Next y sin base. Es la única parte de la
 * lectura en voz alta que se puede verificar sin un navegador de verdad, así
 * que conviene que sea la que tiene toda la lógica.
 */
import type { EdicionResumen, NotaResumen } from "@/lib/types";

/**
 * Lo que hace falta para armar el resumen hablado de una nota.
 *
 * Se pide la forma mínima y no `NotaResumen` entera para que la función sirva
 * igual desde la tapa, desde la nota y desde una prueba, sin fabricar objetos
 * con campos que no se usan.
 */
export type NotaEscuchable = Pick<
  NotaResumen,
  "seccion" | "titulo" | "bajada"
>;

/**
 * Cuántos caracteres puede tener un pedazo antes de que haya que partirlo.
 *
 * El número sale de medirlo contra el corte de Chrome, no de que quede lindo.
 * Una voz en español dice unos 14 caracteres por segundo, y Chrome mata cada
 * utterance cerca de los 15 segundos: 140 caracteres son unos 10 segundos, con
 * un tercio de margen. Estuvo en 180 y las bajadas de la edición daban pedazos
 * de 165 —doce segundos— que es demasiado cerca del filo para algo que falla
 * dejando el botón trabado.
 */
export const MAXIMO_POR_PEDAZO = 140;

/**
 * Abreviaturas que terminan en punto y NO terminan una oración.
 *
 * Sin esto "Av. Sarmiento" se parte en dos utterances y la voz hace una pausa
 * larga en el medio de un nombre de calle, que es exactamente el tipo de
 * detalle por el que una lectura sintética suena rota.
 */
const ABREVIATURAS = new Set([
  "av",
  "avda",
  "dr",
  "dra",
  "sr",
  "sra",
  "srta",
  "lic",
  "ing",
  "arq",
  "prof",
  "gral",
  "cnel",
  "pte",
  "esq",
  "depto",
  "pje",
  "hs",
  "aprox",
  "ej",
  "etc",
  "pág",
  "pag",
  "nº",
  "n",
]);

/** Signos que pueden terminar una oración. */
const CIERRES = new Set([".", "…", "!", "?", ":", ";"]);

/**
 * ¿El signo en `i` termina de verdad una oración?
 *
 * Tres casos dicen que no, y los tres aparecen en el diario:
 * - un punto entre dígitos es un separador de miles ("15.000 vecinos");
 * - un punto detrás de una abreviatura conocida ("Av. Sarmiento", "n.º 8");
 * - un punto detrás de una sola letra es una inicial ("J. B. Alberdi").
 */
function terminaOracion(texto: string, i: number): boolean {
  if (texto[i] !== "." && texto[i] !== "…") return true;

  const anterior = texto[i - 1] ?? "";
  const siguiente = texto[i + 1] ?? "";
  if (/\d/.test(anterior) && /\d/.test(siguiente)) return false;

  const palabra = texto.slice(0, i).match(/([\p{L}º]+)$/u)?.[1]?.toLowerCase();
  if (!palabra) return true;
  if (ABREVIATURAS.has(palabra)) return false;
  // Una sola letra: inicial de un nombre.
  if (palabra.length === 1) return false;

  return true;
}

/**
 * Parte un texto en pedazos que se puedan decir de un saque.
 *
 * **No es una prolijidad: es lo que evita el corte de Chrome.** Chrome mata
 * cada `SpeechSynthesisUtterance` cerca de los 15 segundos, y lo peor no es que
 * corte, es que después del corte `onend` no dispara nunca — el botón se queda
 * clavado en "Detener" para siempre. Con un pedazo por oración cada utterance
 * dura entre cinco y ocho segundos y nunca se acerca al límite.
 *
 * Que nadie lo "simplifique" a un solo utterance: se ve más limpio en el diff y
 * está roto en el navegador que usa la mayoría.
 *
 * Un pedazo que igual queda largo —una oración de sesenta palabras— se vuelve a
 * partir, primero por coma y después por espacio. Nunca por el medio de una
 * palabra: cortar "Tucu" / "mán" suena a error de la máquina, no a pausa.
 */
export function enOraciones(
  texto: string,
  maximo: number = MAXIMO_POR_PEDAZO,
): string[] {
  const limpio = texto.replace(/\s+/g, " ").trim();
  if (!limpio) return [];

  const oraciones: string[] = [];
  let desde = 0;
  for (let i = 0; i < limpio.length; i++) {
    if (!CIERRES.has(limpio[i])) continue;
    // El corte va DESPUÉS del signo, y sólo si lo que sigue es un espacio o el
    // final: "3.5" o "www.smt.gob.ar" no se parten.
    const siguiente = limpio[i + 1];
    if (siguiente !== undefined && siguiente !== " ") continue;
    if (!terminaOracion(limpio, i)) continue;

    const pedazo = limpio.slice(desde, i + 1).trim();
    if (pedazo) oraciones.push(pedazo);
    desde = i + 1;
  }
  const resto = limpio.slice(desde).trim();
  if (resto) oraciones.push(resto);

  return oraciones.flatMap((o) => partirLargo(o, maximo));
}

/** Parte un pedazo demasiado largo por coma, y si no alcanza, por espacio. */
function partirLargo(pedazo: string, maximo: number): string[] {
  if (pedazo.length <= maximo) return [pedazo];

  const porComa = repartir(pedazo.split(/(?<=,)\s+/), maximo);
  if (porComa.every((p) => p.length <= maximo)) return porComa;

  return porComa.flatMap((p) =>
    p.length <= maximo ? [p] : repartir(p.split(" "), maximo),
  );
}

/**
 * Junta trozos en pedazos que no pasen del máximo.
 *
 * Un trozo que por sí solo ya pasa el máximo se devuelve entero: es una palabra
 * sola —una URL, un nombre larguísimo— y partirla sería peor que un pedazo
 * largo.
 */
function repartir(trozos: string[], maximo: number): string[] {
  const salida: string[] = [];
  let actual = "";
  for (const trozo of trozos) {
    if (!trozo) continue;
    const junto = actual ? `${actual} ${trozo}` : trozo;
    if (junto.length <= maximo || !actual) {
      actual = junto;
    } else {
      salida.push(actual);
      actual = trozo;
    }
  }
  if (actual) salida.push(actual);
  return salida;
}

/**
 * Le pone punto final a un fragmento que no lo tiene.
 *
 * Importa para la voz y no para la vista: sin el punto, el sintetizador encadena
 * el titular con la bajada sin bajar la entonación y suena a una sola oración
 * kilométrica. Si ya termina en signo —un titular que es una pregunta— se deja
 * como está, porque ese signo también dice cómo entonar.
 */
function conPunto(fragmento: string): string {
  const limpio = fragmento.trim();
  if (!limpio) return "";
  return CIERRES.has(limpio[limpio.length - 1]) ? limpio : `${limpio}.`;
}

/**
 * El resumen hablado de una nota: sección, titular y bajada.
 *
 * La sección va primero porque ubica antes de contar —es lo mismo que hace la
 * volanta arriba del titular en la pantalla— y porque quien está escuchando no
 * tiene la página delante para saber dónde está parado.
 */
export function textoDeResumenDeNota(nota: NotaEscuchable): string {
  return [nota.seccion, nota.titulo, nota.bajada]
    .map(conPunto)
    .filter(Boolean)
    .join(" ");
}

/**
 * El resumen hablado de la tapa: qué edición es, de qué se trata, y la nota
 * principal.
 *
 * No es el sumario de las ocho notas. Son unos treinta segundos, que es lo que
 * alguien banca parado en la tapa; el sumario completo son dos minutos y es
 * otra función, para otro control.
 *
 * `tema` es opcional en el tipo **y falta de verdad**: el repo mock nunca lo
 * proyecta, así que sin `DATABASE_URL` este camino corre siempre con el tema
 * ausente. Por eso se filtra y no se interpola: un "El tema de esta edición es
 * undefined" es exactamente la clase de cosa que sólo se descubre escuchándola.
 */
export function textoDeResumenDeTapa(
  edicion: Pick<EdicionResumen, "mes" | "numero" | "tema">,
  principal: NotaEscuchable,
): string {
  const cabecera = `El Sanmiguelino, edición número ${edicion.numero}, ${edicion.mes}`;
  const tema = edicion.tema ? `El tema de esta edición es ${edicion.tema}` : "";

  return [cabecera, tema, textoDeResumenDeNota(principal)]
    .filter(Boolean)
    .map((f) => conPunto(f))
    .join(" ");
}
