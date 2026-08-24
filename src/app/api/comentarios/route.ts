import { NextResponse, type NextRequest } from "next/server";
import { getUsuario } from "@/lib/auth/session";
import { comentariosRepo } from "@/lib/repos/comentarios";
import { notaExiste } from "@/lib/repos/edicion";

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
  const usuario = await getUsuario();
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

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
    return NextResponse.json({ error: "El comentario no puede estar vacío" }, { status: 400 });
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
