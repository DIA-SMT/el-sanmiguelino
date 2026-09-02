import { NextResponse, type NextRequest } from "next/server";
import { getUsuario } from "@/lib/auth/session";
import { sesionParaParticipar } from "@/lib/auth/dal";
import { comentariosRepo } from "@/lib/repos/comentarios";
import { notaExiste } from "@/lib/repos/edicion";

/**
 * El GET se queda con  y NO pasa por .
 *
 * Leer los comentarios de una nota no es participar: son públicos para
 * cualquiera que tenga sesión, y a alguien bloqueado no se le esconde lo que ya
 * está publicado — se le impide escribir. El POST de acá abajo y la fila de
 * votos sí lo chequean, que es donde el bloqueo tiene que morder.
 */
export async function GET(request: NextRequest) {
  const usuario = await getUsuario();
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const notaSlug = request.nextUrl.searchParams.get("nota");
  if (!notaSlug || !(await notaExiste(notaSlug))) {
    return NextResponse.json({ error: "Nota inexistente" }, { status: 404 });
  }
  const comentarios = await comentariosRepo.listar(notaSlug, usuario.id);
  return NextResponse.json({ comentarios });
}

export async function POST(request: NextRequest) {
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

  let body: { notaSlug?: string; texto?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const texto = (body.texto ?? "").trim();
  if (!body.notaSlug || !(await notaExiste(body.notaSlug))) {
    return NextResponse.json({ error: "Nota inexistente" }, { status: 404 });
  }
  if (!texto) {
    return NextResponse.json(
      { error: "El comentario no puede estar vacío" },
      { status: 400 },
    );
  }
  if (texto.length > 1000) {
    return NextResponse.json(
      { error: "El comentario supera los 1000 caracteres" },
      { status: 400 },
    );
  }

  const comentario = await comentariosRepo.crear({
    notaSlug: body.notaSlug,
    usuarioId: usuario.id,
    usuarioNombre: usuario.nombre,
    texto,
  });
  return NextResponse.json({ comentario }, { status: 201 });
}
