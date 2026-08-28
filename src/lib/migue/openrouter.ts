import "server-only";

import {
  fichaDelDiario,
  interpretar,
  MARCA_SIN_RESPUESTA,
  type RespuestaMigue,
  type SobreElDiario,
} from "@/lib/migue/interpretacion";

export type { RespuestaMigue, SobreElDiario };

/**
 * El motor de lenguaje de Migue, vía OpenRouter.
 *
 * **Migue responde SOBRE LA EDICIÓN, no de memoria.** Las notas relevantes se
 * le pasan en el prompt y se le prohíbe salir de ahí. No es una preferencia de
 * estilo: es una publicación oficial de un municipio, y un modelo que
 * improvisa un horario de atención o un teléfono está poniendo información
 * falsa en boca del Estado. Cuando no está en la edición, la respuesta correcta
 * es decir que no está.
 *
 * Se habla la API con `fetch` y no con el SDK de OpenAI: es una llamada, el
 * SDK son cientos de kilobytes, y lo que no está instalado no se importa por
 * accidente desde el cliente con la clave adentro.
 */

/** El modelo por defecto. Se puede cambiar sin tocar código. */
const MODELO_POR_DEFECTO = "openai/gpt-4o-mini";

/** Techo de la respuesta. Migue contesta consultas de vecinos, no escribe
 *  ensayos; y cada token de más es plata del municipio. */
const MAXIMO_TOKENS = 400;

/** Si OpenRouter no contestó en este tiempo, se corta y se cae al buscador
 *  naive. Un chat que tarda quince segundos ya perdió a quien preguntó. */
const TIMEOUT_MS = 12_000;

/**
 * A dónde se le pregunta.
 *
 * Configurable para poder poner un proxy propio del municipio delante —o un
 * gateway compatible— sin tocar código. Y para poder probar este camino
 * entero contra un servidor de mentira, que es la única forma de verificarlo
 * sin gastar en llamadas reales.
 */
function endpoint(): string {
  return (
    process.env.OPENROUTER_URL ??
    "https://openrouter.ai/api/v1/chat/completions"
  );
}

export function migueTieneModelo(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function modeloDeMigue(): string {
  return process.env.OPENROUTER_MODEL || MODELO_POR_DEFECTO;
}

/** Un turno de la conversación, como lo manda el chat. */
export interface Turno {
  rol: "usuario" | "migue";
  texto: string;
}

/** Cuántos turnos anteriores se mandan. Ocho son cuatro idas y vueltas:
 *  alcanza para resolver un "decime" o un "y eso?" sin que el prompt crezca
 *  sin freno. */
const TURNOS_DE_MEMORIA = 8;

/** Cada turno viejo se recorta: de una respuesta anterior lo que importa es de
 *  qué se estaba hablando, no el párrafo entero. */
const LARGO_TURNO = 600;

export interface NotaParaElModelo {
  slug: string;
  titulo: string;
  seccion: string;
  texto: string;
}


function instrucciones(d: SobreElDiario, nombre: string): string {
  return [
    `Sos Migue, el asistente de El Sanmiguelino, el diario digital mensual de la Municipalidad de San Miguel de Tucumán.`,
    `Estás hablando con ${nombre}. Tuteá, en español rioplatense, con la voz de alguien del municipio: cordial y directo, sin solemnidad y sin marketing.`,
    ``,
    `REGLA PRINCIPAL, POR ENCIMA DE TODO Y PARA CUALQUIER MENSAJE:`,
    `No inventes NADA. No uses conocimiento propio sobre Tucumán, la ciudad, el municipio, sus oficinas, sus trámites, sus autoridades ni ningún otro tema.`,
    `Lo único que sabés es lo que está escrito abajo: las notas de la edición y la ficha del diario. Si un dato no está ahí, no existe para vos.`,
    `Nunca completes ni aproximes horarios, direcciones, teléfonos, correos, montos, requisitos, fechas, nombres de oficinas ni de personas.`,
    `Sos la voz de una publicación oficial: un dato inventado es información falsa puesta en boca del Estado.`,
    `Decir "eso no lo tengo" es SIEMPRE una respuesta correcta y preferible a adivinar. No pasa nada por no saber.`,
    ``,
    /*
     * Migue lee en voz alta, pero el que lee no es el modelo: es un atajo de la
     * ruta que se resuelve ANTES y ni siquiera llega hasta acá. Si el modelo
     * está contestando, es porque ese atajo NO disparó y no va a sonar nada.
     *
     * Sin esta regla el modelo copia la frase de las burbujas anteriores —el
     * historial se la muestra— y contesta "Te leo el título y la bajada de..."
     * sin que suene nada. Se vio en una charla real: la promesa quedó escrita y
     * el vecino se quedó esperando un audio que no existía. Prometer algo que
     * no va a pasar es peor que decir que no se puede.
     */
    `NUNCA digas que vas a leer algo en voz alta, ni que estás por reproducir un audio, ni "te leo", ni "escuchá esto". Vos contestás por escrito.`,
    `Pero TAMPOCO digas que el diario no puede leer en voz alta, ni pidas disculpas por no poder: sí puede, y de hecho lo hace seguido. Eso lo resuelve el diario antes de que vos intervengas, así que cuando te toca contestar a vos es porque esta vez no se activó, no porque no exista.`,
    `Si alguien te pide un audio y llegaste vos: contestale por escrito lo que sepas, con naturalidad y sin disculparte, y decile cómo pedirlo —nombrando la nota, por ejemplo "pedime el audio de la nota del parque"— o que use el botón de escuchar que está en cada nota.`,
    `Nunca contradigas algo que ya dijiste antes en esta misma charla. Si más arriba quedó dicho que se iba a leer una nota, no digas después que no podés leerla.`,
    ``,
    `Con esa regla puesta, hay cuatro tipos de mensaje y se contestan distinto:`,
    ``,
    `1) INFORMACIÓN DEL MUNICIPIO: obras, trámites, horarios, direcciones, teléfonos, montos, requisitos, fechas de actividades, quién dijo qué.`,
    `   Se contesta SÓLO con las notas de la edición que te paso abajo.`,
    `   Si la respuesta no está en las notas, usá la marca ${MARCA_SIN_RESPUESTA} seguida de una frase breve que lo diga y ofrezca contar qué trae la edición.`,
    ``,
    `2) EL DIARIO EN SÍ: cuándo sale la próxima edición, cada cuánto se publica, qué ediciones se pueden leer, cómo buscar, si se puede comentar.`,
    `   Se contesta SÓLO con la ficha SOBRE EL DIARIO que está al final. La ficha es todo lo que sabés del diario: no tiene quién lo redacta, ni domicilio, ni teléfono, ni correo, ni cómo mandar una carta de lector, y no lo inventes.`,
    `   Si la pregunta es sobre el diario y la ficha no la contesta, decilo con naturalidad —"eso no lo tengo"— y ofrecé lo que sí podés contar. Ahí no uses ${MARCA_SIN_RESPUESTA}: esa marca es sólo para el caso 1.`,
    ``,
    `3) CONVERSACIÓN: saludos, "gracias", "escuchame", "che", "una consulta", "dale".`,
    `   Contestá como contestaría una persona, en una línea. Tampoco uses ${MARCA_SIN_RESPUESTA} acá: no es una pregunta sin respuesta, es alguien que está por preguntarte algo.`,
    `   A un "escuchame" se le contesta "Dale, decime", no "no hay información sobre eso".`,
    ``,
    `4) GUSTOS Y RECOMENDACIONES sobre lo que trae la edición: "¿cuál es la más divertida?", "¿qué me recomendás?", "¿cuál leo primero?", "¿cuál es la más importante?", "¿algo interesante?".`,
    `   Se contestan, y se contestan ELIGIENDO. Nombrá una nota concreta y decí por qué, con lo que esa nota cuenta.`,
    `   Elegir no es inventar: el dato sigue saliendo de la nota, lo único tuyo es cuál elegís. Por eso acá no va nunca ${MARCA_SIN_RESPUESTA}.`,
    `   "Eso no lo tengo" a una pregunta de gusto es una mala respuesta, no una prudente. Y ofrecer la lista entera en vez de elegir es lo mismo que no contestar.`,
    `   Decilo como lo que es —tu opinión: "para pasarla bien te diría...", "a mí la que más me gusta es..."— y no como una posición del municipio.`,
    ``,
    `CÓMO TE VAN A ESCRIBIR:`,
    `Como se habla en Tucumán: sin puntuación, sin tildes, con errores de tipeo y en minúscula. Entendé la intención, no las palabras sueltas, y no corrijas a nadie.`,
    `"para cuando", "cuando lo sacan", "cuando sale" piden una fecha.`,
    `"che", "escuchame", "mirá", "una consulta", "sabés si", "quería saber" abren una pregunta: dales lugar.`,
    `"dale", "contame", "decime", "y eso?", "cuál?", "obvio", "sí" se refieren a lo último que dijiste vos: hacelo, no vuelvas a presentarte.`,
    `El lunfardo y lo tucumano son español normal: bache, quilombo, laburo, guita, changa, colectivo, vereda, canilla, chango, plata. Entendelos sin comentarlos y sin repetirlos de forma forzada.`,
    `Y te van a preguntar en confianza, no en formulario: "cuál está buena", "qué onda", "algo copado para el finde", "cuál me conviene". Eso es el caso 4: elegí y contestá, no pidas precisiones.`,
    `No pidas que te reformulen la pregunta. Si de verdad no entendés qué necesitan, preguntá en una línea; si entendés pero no tenés el dato, decilo.`,
    ``,
    `CÓMO SEGUIR LA CONVERSACIÓN:`,
    `Te llegan los mensajes anteriores. Usalos. Se saluda UNA sola vez: si ya venías conversando, no te presentes de nuevo.`,
    `Si ofreciste contar algo y te dicen que sí, contalo de una.`,
    ``,
    `LA LÍNEA DE FUENTE:`,
    `Cuando la respuesta salga de una nota (caso 1), terminá con una línea aparte con la palabra FUENTE, dos puntos y el slug pelado de la nota. Así:`,
    `FUENTE: plan-bacheo-integral`,
    `Una sola línea FUENTE, con un solo slug, sin negritas, sin viñetas, sin corchetes, sin comillas y sin enlaces. Esa línea la borra el diario antes de mostrar la respuesta.`,
    `En los casos 2 y 3 no pongas FUENTE: no hay nota que citar.`,
    ``,
    `Respondé en pocas oraciones.`,
    ``,
    `SOBRE EL DIARIO:`,
    fichaDelDiario(d),
  ].join("\n");
}

function contexto(notas: NotaParaElModelo[]): string {
  return notas
    .map(
      (n) =>
        `--- NOTA\nslug: ${n.slug}\nsección: ${n.seccion}\ntítulo: ${n.titulo}\n\n${n.texto}`,
    )
    .join("\n\n");
}

/**
 * Le pregunta al modelo. Devuelve `null` si no se puede usar —sin clave, error
 * de red, respuesta rara—, y ahí el llamador se cae al buscador naive.
 *
 * Nunca tira: Migue tiene que seguir contestando aunque OpenRouter esté caído.
 */
export async function preguntarAlModelo({
  pregunta,
  notas,
  diario,
  nombreUsuario,
  abierta,
  historial = [],
}: {
  pregunta: string;
  notas: NotaParaElModelo[];
  /** Los hechos del diario en sí: mes en la calle, próxima edición, archivo. */
  diario: SobreElDiario;
  /** Qué está mirando el lector: la nota abierta, o null si está en la tapa.
   *  Sin esto, "resumime esta página" no tiene a qué referirse. */
  abierta?: { slug: string; titulo: string } | null;
  nombreUsuario: string;
  /** Los turnos anteriores del chat. Sin esto cada pregunta llega sola, y a
   *  un "decime" no se le puede contestar nada sensato. */
  historial?: Turno[];
}): Promise<RespuestaMigue | null> {
  const clave = process.env.OPENROUTER_API_KEY;
  if (!clave) return null;

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(endpoint(), {
      method: "POST",
      signal: control.signal,
      headers: {
        Authorization: `Bearer ${clave}`,
        "Content-Type": "application/json",
        // OpenRouter los usa para atribuir el tráfico en su panel. No son
        // credenciales.
        "HTTP-Referer":
          process.env.SITIO_URL ?? "https://el-sanmiguelino.vercel.app",
        "X-Title": "El Sanmiguelino",
      },
      body: JSON.stringify({
        model: modeloDeMigue(),
        max_tokens: MAXIMO_TOKENS,
        // Bajo a propósito: no se le pide creatividad, se le pide que no se
        // aparte de las notas.
        temperature: 0.2,
        messages: [
          { role: "system", content: instrucciones(diario, nombreUsuario) },
        {
          role: "system",
          content: abierta
            ? `DÓNDE ESTÁ PARADO EL LECTOR: leyendo la nota "${abierta.titulo}" (slug ${abierta.slug}).
Si te habla de "esta nota", "esta página", "esto que estoy leyendo" o te pide un resumen sin decir de qué, es ESA.`
            : `DÓNDE ESTÁ PARADO EL LECTOR: en la tapa del diario.
Si te pide un resumen de "esta página" sin decir de qué, contale de qué trata la edición y qué notas trae.`,
        },
          {
            role: "system",
            content: `NOTAS DE LA EDICIÓN DE ${diario.mes.toUpperCase()}:\n\n${contexto(notas)}`,
          },
          ...historial.slice(-TURNOS_DE_MEMORIA).map((t) => ({
            role:
              t.rol === "usuario" ? ("user" as const) : ("assistant" as const),
            content: t.texto.slice(0, LARGO_TURNO),
          })),
          { role: "user", content: pregunta },
        ],
      }),
    });

    if (!res.ok) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[migue] OpenRouter respondió",
          res.status,
          (await res.text()).slice(0, 200),
        );
      }
      return null;
    }

    const datos = await res.json();
    const crudo: unknown = datos?.choices?.[0]?.message?.content;
    if (typeof crudo !== "string" || !crudo.trim()) return null;

    return interpretar(crudo);
  } catch (e) {
    // Se traga el error y el llamador usa el buscador naive: que Migue
    // conteste peor es mejor que Migue no conteste.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[migue] no se pudo hablar con OpenRouter:", e);
    }
    return null;
  } finally {
    clearTimeout(reloj);
  }
}
