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
    process.env.OPENROUTER_URL ?? "https://openrouter.ai/api/v1/chat/completions"
  );
}

export function migueTieneModelo(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function modeloDeMigue(): string {
  return process.env.OPENROUTER_MODEL || MODELO_POR_DEFECTO;
}

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
    `Cuando la respuesta SÍ está, terminá con una línea aparte que diga: FUENTE: <slug-de-la-nota>`,
    `Usá el slug tal cual aparece en la nota.`,
    ``,
    `Respondé en pocas oraciones. Si la pregunta es un saludo, saludá y contá brevemente qué podés hacer.`,
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
}: {
  pregunta: string;
  notas: NotaParaElModelo[];
  mes: string;
  nombreUsuario: string;
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
          { role: "user", content: pregunta },
        ],
      }),
    });

    if (!res.ok) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[migue] OpenRouter respondió", res.status, (await res.text()).slice(0, 200));
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

  let notaSlug: string | undefined;
  const fuente = texto.match(/^\s*FUENTE:\s*([a-z0-9-]+)\s*$/im);
  if (fuente) {
    notaSlug = fuente[1];
    texto = texto.replace(fuente[0], "").trim();
  }

  return { texto, notaSlug, sinRespuesta };
}
