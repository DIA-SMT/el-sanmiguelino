import "server-only";

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

export interface RespuestaMigue {
  texto: string;
  /** El slug que el modelo dice haber usado, si dijo alguno. */
  notaSlug?: string;
  /** true cuando el modelo declaró que la respuesta no está en la edición.
   *  Es lo que alimenta "Lo que no supimos contestar". */
  sinRespuesta: boolean;
}

/**
 * La marca con la que el modelo avisa que no encontró la respuesta.
 *
 * Se le pide una marca literal en vez de interpretar el texto: adivinar por
 * frases ("no encontré", "no tengo información") es frágil y el tablero de
 * Migue depende de este dato. Se saca antes de mostrar la respuesta.
 */
const MARCA_SIN_RESPUESTA = "[SIN_RESPUESTA]";

function instrucciones(mes: string, nombre: string): string {
  return [
    `Sos Migue, el asistente de El Sanmiguelino, el diario digital mensual de la Municipalidad de San Miguel de Tucumán.`,
    `Estás hablando con ${nombre}. Tuteá, en español rioplatense, con la voz de alguien del municipio: cordial y directo, sin solemnidad y sin marketing.`,
    ``,
    `REGLA PRINCIPAL, POR ENCIMA DE TODO:`,
    `Respondé ÚNICAMENTE con lo que dicen las notas de la edición de ${mes} que te paso abajo.`,
    `No uses conocimiento propio sobre Tucumán, la ciudad, el municipio ni ningún otro tema.`,
    `Nunca inventes ni completes datos: horarios, direcciones, teléfonos, montos, fechas, nombres o requisitos de trámites. Si un dato no está escrito en las notas, no existe para vos.`,
    `Sos la voz de una publicación oficial: un dato inventado es información falsa puesta en boca del Estado.`,
    ``,
    `Si la respuesta no está en las notas, respondé exactamente con la marca ${MARCA_SIN_RESPUESTA} seguida de una frase breve que diga que eso no está en la edición de ${mes} y que ofrezca contar qué notas trae. No inventes una respuesta aproximada.`,
    ``,
    `Cuando la respuesta SÍ está, terminá con una línea aparte con la palabra FUENTE, dos puntos y el slug pelado de la nota. Así:`,
    `FUENTE: plan-bacheo-integral`,
    `Sin corchetes, sin paréntesis, sin comillas y sin enlaces. Esa línea la borra el diario antes de mostrar la respuesta; si la decorás, se le muestra al lector.`,
    ``,
    `Respondé en pocas oraciones. Si la pregunta es un saludo, saludá y contá brevemente qué podés hacer.`,
    ``,
    `CÓMO SEGUIR UNA CONVERSACIÓN:`,
    `Te llegan los mensajes anteriores. Usalos.`,
    `Cuando alguien te dice "decime", "dale", "contame", "y eso?" o "cuál?", se está refiriendo a lo último que dijiste vos. Hacé eso, no vuelvas a presentarte.`,
    `No saludes ni te presentes si ya venías conversando: se saluda una vez.`,
    `Si ofreciste contar algo y te dicen que sí, contalo de una.`,
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
  mes,
  nombreUsuario,
  historial = [],
}: {
  pregunta: string;
  notas: NotaParaElModelo[];
  mes: string;
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
          { role: "system", content: instrucciones(mes, nombreUsuario) },
          {
            role: "system",
            content: `NOTAS DE LA EDICIÓN DE ${mes.toUpperCase()}:\n\n${contexto(notas)}`,
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

/** Separa la marca y la fuente del texto que ve el lector. */
function interpretar(crudo: string): RespuestaMigue {
  let texto = crudo.trim();

  const sinRespuesta = texto.includes(MARCA_SIN_RESPUESTA);
  texto = texto.replaceAll(MARCA_SIN_RESPUESTA, "").trim();

  // La línea de fuente se saca aunque el modelo la haya decorado. Pasó en
  // producción: escribió
  //   FUENTE: [peatonal-luminarias-led](peatonal-luminarias-led)
  // —un enlace de markdown—, y como el patrón exigía el slug pelado no
  // matcheó: la línea entera terminó a la vista del lector.
  //
  // Ahora se toma TODA la línea que empieza con FUENTE y se rescata de adentro
  // lo primero que tenga forma de slug. Un patrón estricto acá no protege de
  // nada; lo único que logra es dejar pasar basura a la pantalla. Y el slug
  // igual se verifica después contra la edición, así que tolerar de más al
  // leerlo no abre ningún riesgo.
  let notaSlug: string | undefined;
  const linea = texto.match(/^[^\S\n]*FUENTE\s*:.*$/im);
  if (linea) {
    notaSlug = (linea[0].match(/[a-z0-9]+(?:-[a-z0-9]+)+/) ?? [])[0];
    texto = texto.replace(linea[0], "").trim();
  }

  return { texto, notaSlug, sinRespuesta };
}
