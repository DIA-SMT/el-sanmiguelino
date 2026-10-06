import { NextResponse, type NextRequest } from "next/server";
import { sesionParaParticipar } from "@/lib/auth/dal";
import { suscribir } from "@/lib/repos/suscripciones";

/**
 * Anotarse para recibir El Sanmiguelino en papel.
 *
 * Pide sesión, como todo lo que escribe. Leer el diario es libre, pero esto
 * guarda un domicilio: sin identidad, cualquiera podría anotar a otro, así que
 * no es un formulario abierto a internet. El nombre llega prellenado de
 * Cidituc; la edad y el domicilio Cidituc no los tiene, y el correo queda a
 * mano por decisión.
 *
 * Las validaciones son del servidor, no del formulario: lo que valida el
 * navegador es una comodidad para quien escribe, no una defensa.
 */

const LARGOS = { nombre: 120, email: 160, direccion: 240 };

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

  let body: {
    nombre?: unknown;
    edad?: unknown;
    email?: unknown;
    direccion?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const nombre = texto(body.nombre);
  const email = texto(body.email);
  const direccion = texto(body.direccion);

  if (!nombre) {
    return NextResponse.json({ error: "Falta tu nombre." }, { status: 400 });
  }
  if (!CORREO.test(email)) {
    return NextResponse.json(
      { error: "Ese correo no parece un correo." },
      { status: 400 },
    );
  }
  if (!direccion) {
    return NextResponse.json(
      { error: "Falta la dirección: es a dónde se lleva el diario." },
      { status: 400 },
    );
  }
  for (const [campo, largo] of Object.entries(LARGOS)) {
    const valor = { nombre, email, direccion }[campo as keyof typeof LARGOS];
    if (valor.length > largo) {
      return NextResponse.json(
        { error: `El campo ${campo} supera los ${largo} caracteres.` },
        { status: 400 },
      );
    }
  }

  // La edad es opcional y se acota: no se exige para recibir un diario, pero
  // si viene tiene que ser una edad.
  let edad: number | null = null;
  if (body.edad !== undefined && body.edad !== null && body.edad !== "") {
    const n = Number(body.edad);
    if (!Number.isInteger(n) || n < 1 || n > 120) {
      return NextResponse.json(
        { error: "La edad tiene que ser un número entre 1 y 120." },
        { status: 400 },
      );
    }
    edad = n;
  }

  const r = await suscribir({
    nombre,
    edad,
    email,
    direccion,
    usuarioId: usuario.id,
  });
  if (!r.ok) {
    // 409: el correo ya tiene una suscripción de otra cuenta. El mensaje ayuda
    // al caso legítimo —la misma persona con otra cuenta— sin decir de quién
    // es ni qué dirección tiene cargada.
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
