import { NextResponse, type NextRequest } from "next/server";
import { sesionParaParticipar } from "@/lib/auth/dal";
import { suscribir } from "@/lib/repos/suscripciones";

/**
 * Anotarse al newsletter de El Sanmiguelino: las novedades del diario, por
 * correo. Hasta el 2026-10-30 era la suscripción al papel y pedía domicilio y
 * edad; el municipio no reparte ejemplares, así que ahora son nombre y correo.
 *
 * Pide sesión, como todo lo que escribe. Leer el diario es libre, pero esto
 * guarda un correo: sin identidad, cualquiera podría anotar el de otra
 * persona, así que no es un formulario abierto a internet. El nombre llega
 * prellenado de Cidituc; el correo queda a mano por decisión.
 *
 * Las validaciones son del servidor, no del formulario: lo que valida el
 * navegador es una comodidad para quien escribe, no una defensa.
 */

const LARGOS = { nombre: 120, email: 160 };

/** Suficiente para descartar lo que claramente no es un correo. No intenta
 *  más: el único validador honesto de un correo es mandarle un mensaje. */
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

  let body: { nombre?: unknown; email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const nombre = texto(body.nombre);
  const email = texto(body.email);

  if (!nombre) {
    return NextResponse.json({ error: "Falta tu nombre." }, { status: 400 });
  }
  if (!CORREO.test(email)) {
    return NextResponse.json(
      { error: "Ese correo no parece un correo." },
      { status: 400 },
    );
  }
  for (const [campo, largo] of Object.entries(LARGOS)) {
    const valor = { nombre, email }[campo as keyof typeof LARGOS];
    if (valor.length > largo) {
      return NextResponse.json(
        { error: `El campo ${campo} supera los ${largo} caracteres.` },
        { status: 400 },
      );
    }
  }

  const r = await suscribir({ nombre, email, usuarioId: usuario.id });
  if (!r.ok) {
    // 409: el correo ya tiene una suscripción de otra cuenta. El mensaje ayuda
    // al caso legítimo —la misma persona con otra cuenta— sin decir de quién
    // es.
    return NextResponse.json(
      {
        error:
          "No pudimos anotar ese correo. Si ya te habías anotado, ingresá con " +
          "la misma cuenta de Ciudadano Digital que usaste esa vez.",
      },
      { status: 409 },
    );
  }
  return NextResponse.json(r, { status: r.yaEstaba ? 200 : 201 });
}
