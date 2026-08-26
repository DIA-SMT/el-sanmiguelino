import { NextResponse, type NextRequest } from "next/server";
import { getUsuario } from "@/lib/auth/session";
import {
  getCompletas,
  getIndice,
  getResumenEdicion,
} from "@/lib/repos/edicion";
import type { NotaCompleta } from "@/lib/types";
import { textoDeBloque } from "@/lib/derivar";
import { registrarConsulta, type ResultadoConsulta } from "@/lib/repos/migue";
import {
  migueTieneModelo,
  preguntarAlModelo,
  type NotaParaElModelo,
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

  let body: { pregunta?: string; notaSlug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const pregunta = (body.pregunta ?? "").trim();
  if (!pregunta) {
    return NextResponse.json({ error: "Falta la pregunta" }, { status: 400 });
  }

  const [edicion, indice] = await Promise.all([
    getResumenEdicion(),
    getIndice(),
  ]);
  const tokens = tokenizar(pregunta);

  // Saludo / smalltalk
  if (
    /\b(hola|buenas|buen dia|buen día|como estas|cómo estás)\b/i.test(pregunta)
  ) {
    return responder(
      "saludo",
      `¡Hola, ${usuario.nombre.split(" ")[0]}! Soy Migue 👋. Puedo contarte qué trae la edición de ${edicion.mes} o responder preguntas sobre cualquiera de sus notas. ¿Qué te interesa?`,
      { pregunta, contextoSlug: body.notaSlug },
    );
  }

  // Índice de la edición
  if (
    /\b(edicion|ediciones|notas|temas|indice|índice|resumen|trae)\b/i.test(
      pregunta,
    )
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
      mes: edicion.mes,
      nombreUsuario: usuario.nombre.split(" ")[0],
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
