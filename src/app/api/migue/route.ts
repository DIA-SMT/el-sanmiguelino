import { NextResponse, type NextRequest } from "next/server";
import { getUsuario } from "@/lib/auth/session";
import {
  getCompletas,
  getIndice,
  getProximaEdicion,
  getPublicadas,
  getResumenEdicion,
} from "@/lib/repos/edicion";
import { fechaHablada } from "@/lib/fecha-edicion";
import type { NotaCompleta } from "@/lib/types";
import { textoDeBloque } from "@/lib/derivar";
import { registrarConsulta, type ResultadoConsulta } from "@/lib/repos/migue";
import {
  migueTieneModelo,
  preguntarAlModelo,
  type NotaParaElModelo,
  type SobreElDiario,
} from "@/lib/migue/openrouter";
import {
  contarConsultaAlModelo,
  limpiarVentanasViejas,
} from "@/lib/migue/tope";

/**
 * Migue.
 *
 * Tres caminos, en este orden:
 *
 * 1. **Saludo e índice** se responden acá, sin modelo. Son deterministas —la
 *    lista de notas es exacta— y así no se paga una llamada por cada "hola".
 * 2. **Todo lo demás va al modelo** (OpenRouter), con las notas de la edición
 *    en el prompt y la orden de no salir de ahí.
 * 3. **Si el modelo no está** —sin clave, caído, lento— se cae al buscador por
 *    palabras clave de siempre. Que Migue conteste peor es mejor que Migue no
 *    conteste.
 *
 * El contrato hacia afuera no cambió nunca: POST { pregunta, notaSlug? } →
 * { respuesta, notaSlug? }.
 */

/**
 * Cuánto texto de la edición se le manda al modelo.
 *
 * Con ocho notas entran todas y Migue puede contestar sobre cualquiera, que es
 * lo que se quiere. El tope existe para el día que la edición crezca: se
 * mandan primero las que más puntaje sacaron, así lo que se recorta es siempre
 * lo menos relacionado con la pregunta.
 */
const TOPE_CONTEXTO = 24_000;

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
function simplificar(texto: string): string {
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
const ES_SOLO_UN_SALUDO =
  /^[\s¡!¿?,.]*(hola|buenas|buen dia|buenas tardes|buenas noches|holis|hey|ey)([\s,!¡.]*(migue|como estas|como andas|que tal|todo bien))?[\s!¡.?]*$/;

/**
 * Pide la lista de notas de ESTA edición.
 *
 * Antes bastaba con nombrar la palabra "edición", y por eso "cuándo sale la
 * próxima edición" recibía de vuelta el índice de agosto: la pregunta era por
 * una fecha y la respuesta era una lista de notas. Ahora se exige la forma de
 * la pregunta —qué notas, qué trae, índice— y no una palabra suelta.
 *
 * Errar de menos no cuesta nada: lo que no matchea va al modelo, que contesta
 * bien igual. Errar de más sí cuesta, porque el atajo saltea al modelo.
 */
const PIDE_EL_INDICE =
  /(\b(que|cuales)\b[^?]{0,24}\b(notas?|temas?|trae|tiene|hay)\b)|\b(indice|sumario)\b|\bde que (trata|va)\b/;

/** Habla de otra edición, no de la que está en la calle: no es el índice de
 *  hoy lo que están pidiendo. */
const HABLA_DE_OTRA =
  /\b(proxim[ao]|siguiente|que viene|anterior|pasad[ao]|archivo)\b/;

const STOPWORDS = new Set(
  "el la los las un una unos unas de del al a en y o que se su sus por para con sobre es son fue como mas más hay este esta estos estas donde cuando quien cual cuales qué cómo dónde cuándo quién cuál me te le nos".split(
    " ",
  ),
);

function tokenizar(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/[^a-zñ0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function textoDeNota(nota: NotaCompleta): string {
  return [
    nota.titulo,
    nota.bajada,
    ...nota.cuerpo.map(textoDeBloque),
    nota.imagen?.epigrafe ?? "",
  ].join(" ");
}

function mejorParrafo(nota: NotaCompleta, tokens: string[]): string {
  const parrafos = nota.cuerpo.filter((b) => b.tipo === "parrafo");
  let mejor = parrafos[0]?.texto ?? nota.bajada;
  let mejorPuntaje = 0;
  for (const p of parrafos) {
    const propios = new Set(tokenizar(p.texto));
    const puntaje = tokens.filter((t) => propios.has(t)).length;
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = p.texto;
    }
  }
  return mejor;
}

/**
 * Preguntas sobre el diario mismo, contestadas **sin modelo**.
 *
 * Es el camino de emergencia: cuando OpenRouter no está o se llenó el cupo de
 * la hora, Migue cae al buscador por palabras clave, y ahí "¿cuándo sale la
 * próxima?" vuelve a recibir "no encontré nada en la edición de agosto" —justo
 * la respuesta que hubo que arreglar—.
 *
 * Cada caso exige que la pregunta **nombre al diario**. Sin esa condición,
 * "¿cuándo sale la obra del parque?" recibiría la fecha de la próxima edición:
 * una respuesta segura de sí misma y sobre otra cosa, que es peor que no
 * contestar.
 */
function respuestaSobreElDiario(
  /** Ya simplificada: minúsculas y sin tildes. Ver simplificar(). */
  p: string,
  d: SobreElDiario,
): string | null {
  const nombraElDiario =
    /\b(edicion|ediciones|diario|periodico|sanmiguelino|numero)\b/.test(p);

  if (
    nombraElDiario &&
    /\b(proxim[ao]|siguiente|que viene|nuev[ao]|cuando|que dia|para cuando)\b/.test(
      p,
    )
  ) {
    return d.proxima
      ? `La próxima es la edición de ${d.proxima.mes} y sale el ${d.proxima.fecha}. Mientras tanto tenés la de ${d.mes}.`
      : `Todavía no hay fecha para la próxima. El Sanmiguelino sale una vez por mes, así que la que viene es la del mes próximo; la que está en la calle es la de ${d.mes}.`;
  }

  if (nombraElDiario && /\b(cada cuanto|frecuencia|seguido)\b/.test(p)) {
    return `El Sanmiguelino sale una vez por mes. La edición que está en la calle es la de ${d.mes}.`;
  }

  if (
    /\b(ediciones|numeros) (anteriores|viejas|viejos|pasados|pasadas)\b|\barchivo\b/.test(
      p,
    )
  ) {
    return d.archivo.length
      ? `En el archivo están las ediciones anteriores: ${d.archivo.join(", ")}. La de ahora es la de ${d.mes}.`
      : `Todavía no hay archivo: la de ${d.mes} es la primera edición.`;
  }

  return null;
}

/**
 * Responde y **anota**, en un solo lugar.
 *
 * Antes había cuatro `return NextResponse.json(...)` sueltos. Con el registro,
 * cuatro salidas serían cuatro oportunidades de olvidarse de anotar una, y la
 * que se olvidaría es justo la que importa: el caso "no supe contestar" es el
 * último y el más fácil de pasar por alto.
 */
async function responder(
  resultado: ResultadoConsulta,
  respuesta: string,
  datos: { pregunta: string; notaSlug?: string; contextoSlug?: string },
) {
  await registrarConsulta({ ...datos, resultado });
  return NextResponse.json({ respuesta, notaSlug: datos.notaSlug });
}

export async function POST(request: NextRequest) {
  const usuario = await getUsuario();
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: {
    pregunta?: string;
    notaSlug?: string;
    /** Los turnos anteriores del chat, que manda el cliente. */
    historial?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const pregunta = (body.pregunta ?? "").trim();

  /**
   * El hilo de la conversación, saneado.
   *
   * Llega del cliente, así que no se confía: se valida la forma, se descartan
   * los turnos que no la cumplen y se recorta el largo. Es texto que va a
   * entrar en el prompt del modelo, y lo que entra en un prompt tiene que
   * llegar acotado.
   *
   * No se guarda en ningún lado: viaja en el pedido y muere ahí. El registro
   * de consultas sigue siendo una pregunta suelta y anónima.
   */
  const historial = (Array.isArray(body.historial) ? body.historial : [])
    .filter(
      (t): t is { rol: "usuario" | "migue"; texto: string } =>
        typeof t === "object" &&
        t !== null &&
        ((t as { rol?: unknown }).rol === "usuario" ||
          (t as { rol?: unknown }).rol === "migue") &&
        typeof (t as { texto?: unknown }).texto === "string" &&
        (t as { texto: string }).texto.trim() !== "",
    )
    .slice(-12)
    .map((t) => ({ rol: t.rol, texto: t.texto.slice(0, 800) }));
  if (!pregunta) {
    return NextResponse.json({ error: "Falta la pregunta" }, { status: 400 });
  }

  const [edicion, indice, proxima, publicadas] = await Promise.all([
    getResumenEdicion(),
    getIndice(),
    getProximaEdicion(),
    getPublicadas(),
  ]);

  /**
   * Los hechos del diario en sí.
   *
   * Todo sale de la base. Es la regla de siempre —Migue no habla de memoria—
   * aplicada a un tema del que hasta ahora no le pasábamos nada, y por eso a
   * "¿cuándo sale la próxima edición?" contestaba que eso no estaba en la
   * edición de agosto: cierto, y completamente inútil.
   */
  const diario: SobreElDiario = {
    mes: edicion.mes,
    numero: edicion.numero,
    proxima: proxima
      ? { mes: proxima.mes, fecha: fechaHablada(proxima.publicaEn) }
      : undefined,
    archivo: publicadas.filter((e) => e.slug !== edicion.slug).map((e) => e.mes),
  };
  const tokens = tokenizar(pregunta);
  // Lo que miran los atajos: sin tildes y en minúscula. Ver simplificar().
  const simple = simplificar(pregunta);

  /**
   * Los atajos deterministas sólo valen para el PRIMER mensaje.
   *
   * Saltean el modelo, así que por definición no ven la conversación: son la
   * forma más directa de perder el hilo. Y el atajo del índice es de gatillo
   * ancho —"notas", "temas", "trae"—, así que en medio de una charla se comía
   * preguntas que pedían otra cosa y contestaba la lista de siempre.
   *
   * Con un mensaje solo ahorran una llamada y responden mejor que el modelo,
   * porque la lista de notas es exacta. Con conversación encima, todo va al
   * modelo, que es el único que puede saber a qué se refiere un "decime".
   */
  const empezandoDeCero = historial.length === 0;

  // Saludo / smalltalk
  if (empezandoDeCero && ES_SOLO_UN_SALUDO.test(simple)) {
    return responder(
      "saludo",
      `¡Hola, ${usuario.nombre.split(" ")[0]}! Soy Migue 👋. Puedo contarte qué trae la edición de ${edicion.mes} o responder preguntas sobre cualquiera de sus notas. ¿Qué te interesa?`,
      { pregunta, contextoSlug: body.notaSlug },
    );
  }

  // Índice de la edición
  if (
    empezandoDeCero &&
    PIDE_EL_INDICE.test(simple) &&
    !HABLA_DE_OTRA.test(simple)
  ) {
    const lista = indice.map((n) => `• ${n.titulo} (${n.seccion})`).join("\n");
    return responder(
      "indice",
      `La edición de ${edicion.mes} trae estas notas:\n${lista}\n\nPreguntame por cualquiera y te cuento más.`,
      { pregunta, contextoSlug: body.notaSlug },
    );
  }

  // Recuperación por puntaje sobre todas las notas (con leve sesgo a la nota abierta)
  // Migue busca sobre el cuerpo de todas: acá sí hace falta la edición entera.
  const completas = await getCompletas(indice.map((n) => n.slug));
  const notaAbierta = body.notaSlug
    ? (completas.find((n) => n.slug === body.notaSlug) ?? null)
    : null;
  let mejorNota: NotaCompleta | null = null;
  let mejorPuntaje = 0;
  for (const nota of completas) {
    const propios = new Set(tokenizar(textoDeNota(nota)));
    let puntaje = tokens.filter((t) => propios.has(t)).length;
    if (notaAbierta && nota.slug === notaAbierta.slug) puntaje += 1;
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejorNota = nota;
    }
  }

  // --- El modelo -----------------------------------------------------------
  //
  // El tope se cuenta ANTES de armar el contexto: si ya se pasó, no tiene
  // sentido recorrer la edición entera para un prompt que no se va a mandar.
  const tope = migueTieneModelo()
    ? await contarConsultaAlModelo(usuario.id)
    : { permitido: false };

  if (migueTieneModelo() && tope.permitido) {
    // Se ordenan por puntaje y se manda todo lo que entre en el tope: el
    // modelo elige mejor que nuestro puntaje, pero el puntaje sirve para
    // decidir QUÉ recortar si no entra todo.
    const puntuadas = completas
      .map((n) => {
        const propios = new Set(tokenizar(textoDeNota(n)));
        return { nota: n, puntaje: tokens.filter((t) => propios.has(t)).length };
      })
      .sort((a, b) => b.puntaje - a.puntaje);

    const paraElModelo: NotaParaElModelo[] = [];
    let usado = 0;
    for (const { nota } of puntuadas) {
      const texto = textoDeNota(nota);
      if (usado + texto.length > TOPE_CONTEXTO && paraElModelo.length >= 3) break;
      usado += texto.length;
      paraElModelo.push({
        slug: nota.slug,
        titulo: nota.titulo,
        seccion: nota.seccion,
        texto,
      });
    }

    const delModelo = await preguntarAlModelo({
      pregunta,
      notas: paraElModelo,
      diario,
      nombreUsuario: usuario.nombre.split(" ")[0],
      historial,
    });

    if (delModelo) {
      // El slug que dice el modelo se verifica contra la edición: si se lo
      // inventó o citó uno viejo, se descarta. Un enlace a una nota que no
      // existe es peor que no enlazar.
      const slugValido =
        delModelo.notaSlug &&
        indice.some((n) => n.slug === delModelo.notaSlug)
          ? delModelo.notaSlug
          : undefined;

      return responder(
        delModelo.sinRespuesta ? "sin_respuesta" : "nota",
        delModelo.texto,
        { pregunta, notaSlug: slugValido, contextoSlug: body.notaSlug },
      );
    }
    // Si devolvió null seguimos al buscador de abajo, a propósito.
  }

  // Llegar acá con el modelo configurado significa una de dos: OpenRouter no
  // respondió, o se alcanzó el tope de la hora. En los dos casos Migue sigue
  // contestando con el buscador: un asistente que se planta y dice "no puedo
  // atenderte" es peor que uno que contesta un poco peor, y el vecino no tiene
  // por qué enterarse de nuestros costos.
  void limpiarVentanasViejas();

  // --- Sin modelo: el buscador por palabras clave ---------------------------
  //
  // Las preguntas sobre el diario mismo se contestan igual acá. Sin esto, el
  // día que se llene el cupo de la hora "¿cuándo sale la próxima?" vuelve a
  // recibir "no encontré nada en la edición de agosto", que es justo la
  // respuesta que hubo que arreglar.
  const sobreElDiario = respuestaSobreElDiario(simple, diario);
  if (sobreElDiario) {
    return responder("diario", sobreElDiario, {
      pregunta,
      contextoSlug: body.notaSlug,
    });
  }

  if (!mejorNota || mejorPuntaje < 2) {
    // La salida que le da sentido al registro entero: cada una de estas es
    // un tema que los vecinos buscan y el diario no cubre.
    return responder(
      "sin_respuesta",
      `Sobre eso no encontré nada en la edición de ${edicion.mes}. Puedo ayudarte con lo que sí está publicado: preguntame, por ejemplo, "¿qué notas trae esta edición?".`,
      { pregunta, contextoSlug: body.notaSlug },
    );
  }

  const extracto = mejorParrafo(mejorNota, tokens);
  return responder(
    "nota",
    `Según la nota “${mejorNota.titulo}” (${mejorNota.seccion}):\n\n${extracto}`,
    { pregunta, notaSlug: mejorNota.slug, contextoSlug: body.notaSlug },
  );
}
