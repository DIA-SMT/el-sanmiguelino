import { NextResponse, type NextRequest } from "next/server";
import { getUsuario } from "@/lib/auth/session";
import {
  getCompletas,
  getIndice,
  getResumenEdicion,
} from "@/lib/repos/edicion";
import type { NotaCompleta } from "@/lib/types";
import { textoDeBloque } from "@/lib/derivar";

/**
 * Backend mock de Migue: recuperación naive por palabras clave sobre las notas
 * de la edición.
 *
 * PENDIENTE DE CONFIRMAR: endpoint/modelo del Migue existente para reusar el
 * mismo motor. Cuando esté, este handler pasa a proxyear esa API (o a una
 * instancia nueva con RAG sobre las notas) manteniendo el mismo contrato:
 * POST { pregunta, notaSlug? } → { respuesta }.
 */

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
    return NextResponse.json({
      respuesta: `¡Hola, ${usuario.nombre.split(" ")[0]}! Soy Migue 👋. Puedo contarte qué trae la edición de ${edicion.mes} o responder preguntas sobre cualquiera de sus notas. ¿Qué te interesa?`,
    });
  }

  // Índice de la edición
  if (
    /\b(edicion|ediciones|notas|temas|indice|índice|resumen|trae)\b/i.test(
      pregunta,
    )
  ) {
    const lista = indice.map((n) => `• ${n.titulo} (${n.seccion})`).join("\n");
    return NextResponse.json({
      respuesta: `La edición de ${edicion.mes} trae estas notas:\n${lista}\n\nPreguntame por cualquiera y te cuento más.`,
    });
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

  if (!mejorNota || mejorPuntaje < 2) {
    return NextResponse.json({
      respuesta: `Sobre eso no encontré nada en la edición de ${edicion.mes}. Puedo ayudarte con lo que sí está publicado: preguntame, por ejemplo, "¿qué notas trae esta edición?".`,
    });
  }

  const extracto = mejorParrafo(mejorNota, tokens);
  return NextResponse.json({
    respuesta: `Según la nota “${mejorNota.titulo}” (${mejorNota.seccion}):\n\n${extracto}`,
    notaSlug: mejorNota.slug,
  });
}
