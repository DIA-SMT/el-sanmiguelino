import { NextResponse, type NextRequest } from "next/server";
import { sesionParaParticipar, usuarioActual } from "@/lib/auth/dal";
import { aPublico } from "@/lib/comentarios-publicos";
import { comentariosRepo } from "@/lib/repos/comentarios";
import { notaExiste } from "@/lib/repos/edicion";

/**
 * Leer los comentarios de una nota es LIBRE, como leer la nota: sin sesión no
 * hay "mi voto" y nada más cambia. Por eso el GET usa `usuarioActual()` —sólo
 * para saber de quién es el voto— y no `sesionParaParticipar()`. A alguien
 * bloqueado tampoco se le esconde lo publicado: se le impide escribir. El POST
 * de acá abajo y los votos sí piden sesión, que es donde tiene que morder.
 *
 * Lo que sale es `aPublico()`: sin el id de Cidituc del autor y con la firma
 * abreviada. `notaExiste` respeta qué ediciones se pueden leer: una nota de
 * una edición que todavía no salió da 404, salvo en la vista previa de un
 * administrador.
 *
 * `no-store`: la respuesta lleva el voto de quien pregunta. Una caché
 * compartida le serviría el voto de uno a todos.
 */
const PRIVADA = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  const notaSlug = request.nextUrl.searchParams.get("nota");
  if (!notaSlug || !(await notaExiste(notaSlug))) {
    return NextResponse.json(
      { error: "Nota inexistente" },
      { status: 404, headers: PRIVADA },
    );
  }
  const usuario = await usuarioActual();
  const comentarios = await comentariosRepo.listar(notaSlug, usuario?.id ?? null);
  return NextResponse.json(
    { comentarios: comentarios.map(aPublico) },
    { headers: PRIVADA },
  );
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

  // Se guarda el nombre completo —lo necesita la moderación— y sale la firma
  // pública.
  const comentario = await comentariosRepo.crear({
    notaSlug: body.notaSlug,
    usuarioId: usuario.id,
    usuarioNombre: usuario.nombre,
    texto,
  });
  return NextResponse.json(
    { comentario: aPublico(comentario) },
    { status: 201, headers: PRIVADA },
  );
}
