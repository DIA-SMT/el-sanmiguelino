import { NextResponse, type NextRequest } from "next/server";
import { getUsuario } from "@/lib/auth/session";
import { suscribir } from "@/lib/repos/suscripciones";

/**
 * Anotarse para recibir El Sanmiguelino en papel.
 *
 * Pide sesión, como todo lo que escribe: el diario entero está detrás del gate
 * de Cidituc, así que esto no es un formulario abierto a internet. Cuando el
 * SSO real esté, `nombre` y `edad` van a venir de ahí y el formulario va a
 * pedir sólo correo y domicilio.
 *
 * Las validaciones son del servidor, no del formulario: lo que valida el
 * navegador es una comodidad para quien escribe, no una defensa.
 */

const LARGOS = { nombre: 120, email: 160, direccion: 240 };

/** Suficiente para descartar lo que claramente no es un correo. No intenta
 *  más: el único validador honesto de un correo es mandarle un mensaje. */
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: NextRequest) {
  const usuario = await getUsuario();
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

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
  return NextResponse.json(r, { status: r.yaEstaba ? 200 : 201 });
}
