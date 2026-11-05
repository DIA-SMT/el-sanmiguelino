import "server-only";
import { db } from "@/lib/db";
import { migueTieneModelo, pedirAlModelo } from "@/lib/migue/openrouter";
import { TOPES } from "@/lib/repos/boletines";
import {
  datosSinRespaldo,
  leerJson,
  limpiarTexto,
} from "@/lib/newsletter/verificar-ia";

/**
 * El borrador del newsletter escrito con IA: elige las notas de una edición y
 * escribe asunto, línea de vista previa, introducción, el texto de cada nota y
 * el cierre.
 *
 * **Dos reglas que no se negocian:**
 *
 * 1. **No inventa.** El modelo sólo ve las notas y se le prohíbe salir de
 *    ellas; además, todo lo que devuelve pasa por `datosSinRespaldo()`. Un
 *    texto con un número o un nombre que no está en las notas se descarta (la
 *    nota vuelve a su bajada) y el editor lo avisa.
 * 2. **No guarda ni manda.** Esto devuelve texto; el editor lo pone en
 *    pantalla y una persona lo revisa, lo guarda y decide si se envía.
 *
 * **Por qué en dos pasos y en paralelo:** Vercel corta cada función a los 10
 * segundos. Elegir notas mira sólo títulos y bajadas (rápido). Escribir hace
 * una consulta por nota —cada una ve sólo su nota— más una para el asunto y la
 * introducción, todas a la vez. Un único pedido con el texto de toda la
 * edición tardaría más de lo que hay.
 */

/** Por defecto, el mismo modelo de Migue. Se puede usar otro sin tocar código. */
function modelo(): string | undefined {
  return process.env.NEWSLETTER_IA_MODELO || undefined;
}

export function iaDisponible(): boolean {
  return migueTieneModelo();
}

const MINIMO_NOTAS = 3;
const MAXIMO_NOTAS = 6;
/** Lo que se le pasa de cada nota para escribir su texto. El principio de una
 *  nota es lo que la resume; el resto alarga la espera y el costo. */
const LARGO_NOTA = 3500;
const TIEMPO_MS = 8000;

const REGLAS = [
  `Escribís para El Sanmiguelino, el diario digital mensual de la Municipalidad de San Miguel de Tucumán.`,
  `Español rioplatense, tuteando, cordial y claro, sin marketing, sin exclamaciones de más y sin emojis.`,
  `REGLA PRINCIPAL: usá SOLAMENTE lo que dicen las notas que te paso. No agregues fechas, años, horarios, cifras, lugares, nombres de personas ni de instituciones que no estén escritos en esas notas. No uses conocimiento propio.`,
  `Si un dato no está en las notas, no lo pongas. Es una publicación oficial: un dato inventado es información falsa del Estado.`,
].join("\n");

interface NotaFuente {
  slug: string;
  seccion: string;
  titulo: string;
  bajada: string;
  texto: string;
}

async function leerNotas(slugs: string[]): Promise<NotaFuente[]> {
  const filas = await db().nota.findMany({
    where: { slug: { in: slugs }, textoPlano: { not: "" } },
    select: {
      slug: true,
      seccion: true,
      titulo: true,
      bajada: true,
      textoPlano: true,
    },
  });
  const porSlug = new Map(filas.map((f) => [f.slug, f]));
  return slugs.flatMap((s) => {
    const f = porSlug.get(s);
    return f
      ? [
          {
            slug: f.slug,
            seccion: f.seccion,
            titulo: f.titulo,
            bajada: f.bajada,
            texto: f.textoPlano,
          },
        ]
      : [];
  });
}

/* ---------------------------------------------------------------- paso 1 */

export type ResultadoNotas =
  | { ok: true; slugs: string[] }
  | { ok: false; error: string };

/**
 * Las notas que propone para el newsletter, de las que se le ofrecen (las de
 * una edición). Mira sólo título, sección y bajada.
 */
export async function proponerNotas(ofrecidas: string[]): Promise<ResultadoNotas> {
  const notas = await leerNotas(ofrecidas);
  if (notas.length === 0) {
    return { ok: false, error: "Esa edición no tiene notas con texto para elegir." };
  }
  if (notas.length <= MINIMO_NOTAS) {
    // Con tan pocas, elegir no tiene sentido: van todas.
    return { ok: true, slugs: notas.map((n) => n.slug) };
  }
  const lista = notas
    .map((n) => `- ${n.slug} | ${n.seccion} | ${n.titulo} | ${n.bajada}`)
    .join("\n");
  const crudo = await pedirAlModelo({
    modelo: modelo(),
    maximoTokens: 300,
    timeoutMs: TIEMPO_MS,
    sinRazonar: true,
    sistema: [
      REGLAS,
      `Tenés que elegir entre ${MINIMO_NOTAS + 1} y ${MAXIMO_NOTAS} notas de esta lista para el newsletter del mes: las que más le sirvan o interesen a un vecino, variadas entre sí, sin dos que cuenten lo mismo. Ponelas en el orden en que conviene leerlas, la más importante primero.`,
      `Contestá SOLAMENTE con un JSON así: {"notas": ["slug-1", "slug-2"]}. Usá los slugs tal cual están en la lista.`,
    ],
    pregunta: `Las notas de la edición (slug | sección | título | bajada):\n${lista}`,
  });
  if (crudo === null) {
    return { ok: false, error: "No se pudo armar la propuesta ahora. Probá de nuevo en un rato." };
  }
  const datos = leerJson(crudo) as { notas?: unknown } | null;
  const validas = new Set(notas.map((n) => n.slug));
  const elegidas = [
    ...new Set(
      (Array.isArray(datos?.notas) ? datos.notas : []).filter(
        (s): s is string => typeof s === "string" && validas.has(s),
      ),
    ),
  ].slice(0, MAXIMO_NOTAS);
  if (elegidas.length === 0) {
    return { ok: false, error: "La propuesta no vino bien. Probá de nuevo." };
  }
  return { ok: true, slugs: elegidas };
}

/* ---------------------------------------------------------------- paso 2 */

export interface BorradorIA {
  asunto: string;
  preencabezado: string;
  introduccion: string;
  cierre: string;
  notas: { slug: string; resumen: string }[];
  /** Lo que se descartó por traer datos que no están en las notas. */
  descartes: string[];
}

export type ResultadoBorrador =
  | { ok: true; borrador: BorradorIA }
  | { ok: false; error: string };

async function resumenDe(nota: NotaFuente): Promise<string | null> {
  const crudo = await pedirAlModelo({
    modelo: modelo(),
    maximoTokens: 350,
    timeoutMs: TIEMPO_MS,
    sinRazonar: true,
    sistema: [
      REGLAS,
      `Escribí el texto que va debajo del título de esta nota en el newsletter: entre 25 y 45 palabras, una o dos oraciones, que cuenten de qué trata y den ganas de leerla. No repitas el título. Sin comillas, sin títulos y sin listas.`,
      `Contestá SOLAMENTE con el texto.`,
    ],
    pregunta: `Sección: ${nota.seccion}\nTítulo: ${nota.titulo}\nBajada: ${nota.bajada}\n\nTexto de la nota:\n${nota.texto.slice(0, LARGO_NOTA)}`,
  });
  return crudo === null ? null : limpiarTexto(crudo, TOPES.resumen);
}

async function marcoDe(
  notas: NotaFuente[],
  edicion: string,
): Promise<{ asunto: string; preencabezado: string; introduccion: string; cierre: string } | null> {
  const lista = notas
    .map((n, i) => `${i + 1}. ${n.titulo} — ${n.bajada}`)
    .join("\n");
  const crudo = await pedirAlModelo({
    modelo: modelo(),
    maximoTokens: 800,
    timeoutMs: TIEMPO_MS,
    sinRazonar: true,
    sistema: [
      REGLAS,
      `Escribí el marco del newsletter que trae estas notas:`,
      `- "asunto": hasta 70 caracteres, concreto, que nombre lo más atractivo. Sin la palabra "newsletter".`,
      `- "preencabezado": hasta 110 caracteres; la línea que se ve al lado del asunto en la bandeja. Que sume algo al asunto, no que lo repita.`,
      `- "introduccion": entre 30 y 60 palabras, que salude y cuente qué trae esta vez.`,
      `- "cierre": una o dos oraciones cortas que inviten a leer el diario.`,
      `Contestá SOLAMENTE con un JSON con esas cuatro claves.`,
    ],
    pregunta: `Edición: ${edicion}\nNotas (título — bajada):\n${lista}`,
  });
  const datos = crudo === null ? null : (leerJson(crudo) as Record<string, unknown> | null);
  if (!datos) return null;
  const t = (v: unknown, tope: number) =>
    typeof v === "string" ? limpiarTexto(v, tope) : "";
  return {
    asunto: t(datos.asunto, TOPES.asunto).replace(/\s*\n\s*/g, " "),
    preencabezado: t(datos.preencabezado, TOPES.preencabezado).replace(/\s*\n\s*/g, " "),
    introduccion: t(datos.introduccion, TOPES.texto),
    cierre: t(datos.cierre, TOPES.texto),
  };
}

/**
 * Escribe todos los textos para estas notas, en el orden dado. Lo que no pasa
 * el control queda vacío (y la nota usa su bajada), y se lista en `descartes`.
 */
export async function escribirBorrador(
  slugs: string[],
  edicion: string,
): Promise<ResultadoBorrador> {
  const notas = await leerNotas(slugs.slice(0, MAXIMO_NOTAS));
  if (notas.length === 0) {
    return { ok: false, error: "Esas notas ya no están en el diario." };
  }
  const [marco, ...resumenes] = await Promise.all([
    marcoDe(notas, edicion),
    ...notas.map(resumenDe),
  ]);
  if (!marco) {
    return { ok: false, error: "No se pudo escribir el borrador ahora. Probá de nuevo en un rato." };
  }

  const descartes: string[] = [];
  const todas = notas.map((n) => `${n.titulo}\n${n.bajada}\n${n.texto}`);
  const revisar = (texto: string, fuentes: string[], que: string): string => {
    if (!texto) return "";
    const faltan = datosSinRespaldo(texto, fuentes);
    if (faltan.length === 0) return texto;
    descartes.push(`${que} (traía «${faltan.slice(0, 3).join("», «")}», que no está en las notas)`);
    return "";
  };

  return {
    ok: true,
    borrador: {
      // El asunto no se descarta del todo: sin asunto no se puede guardar.
      asunto:
        revisar(marco.asunto, todas, "El asunto") ||
        `Novedades de El Sanmiguelino · ${edicion}`.slice(0, TOPES.asunto),
      preencabezado: revisar(marco.preencabezado, todas, "La línea de vista previa"),
      introduccion: revisar(marco.introduccion, todas, "La introducción"),
      cierre: revisar(marco.cierre, todas, "El cierre"),
      notas: notas.map((n, i) => ({
        slug: n.slug,
        // Cada texto se controla sólo contra SU nota: un dato de otra nota
        // puesto acá también sería falso.
        resumen: revisar(
          resumenes[i] ?? "",
          [`${n.titulo}\n${n.bajada}\n${n.texto}`],
          `El texto de «${n.titulo}»`,
        ),
      })),
      descartes,
    },
  };
}
