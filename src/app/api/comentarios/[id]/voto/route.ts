import { NextResponse, type NextRequest } from "next/server";
import { sesionParaParticipar } from "@/lib/auth/dal";
import { aPublico } from "@/lib/comentarios-publicos";
import { comentariosRepo } from "@/lib/repos/comentarios";

/** POST { valor: 1 | -1 | null } — fija o quita el voto del usuario. */
export async function POST(
  request: NextRequest,
  { params }: RouteContext<"/api/comentarios/[id]/voto">,
) {
  const sesion = await sesionParaParticipar();
  if (!sesion.ok) {
    return NextResponse.json(
      {
        error:
          sesion.motivo === "bloqueado" ? "Cuenta bloqueada" : "No autenticado",
      },
      { status: sesion.motivo === "bloqueado" ? 403 : 401 },
    );
  }
  const usuario = sesion.usuario;

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

  // Sólo lo publicado se vota: un comentario en revisión o dado de baja da 404
  // igual que uno que no existe, y no devuelve su texto ni su autor.
  const comentario = await comentariosRepo.votar(id, usuario.id, valor, true);
  if (!comentario) {
    return NextResponse.json({ error: "Comentario inexistente" }, { status: 404 });
  }
  return NextResponse.json(
    { comentario: aPublico(comentario) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
