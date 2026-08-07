import { NextResponse, type NextRequest } from "next/server";
import { getUsuario } from "@/lib/auth/session";
import { comentariosRepo } from "@/lib/repos/comentarios";

/** POST { valor: 1 | -1 | null } — fija o quita el voto del usuario. */
export async function POST(
  request: NextRequest,
  { params }: RouteContext<"/api/comentarios/[id]/voto">,
) {
  const usuario = await getUsuario();
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

  let body: { valor?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const valor = body.valor;
  if (valor !== 1 && valor !== -1 && valor !== null) {
    return NextResponse.json({ error: "valor debe ser 1, -1 o null" }, { status: 400 });
  }

  const comentario = await comentariosRepo.votar(id, usuario.id, valor);
  if (!comentario) {
    return NextResponse.json({ error: "Comentario inexistente" }, { status: 404 });
  }
  return NextResponse.json({ comentario });
}
