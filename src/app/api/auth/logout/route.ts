import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { COOKIE_EDICION } from "@/lib/auth/vista-previa";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  // También la vista previa de una edición: sin sesión no sirve, y si quedara,
  // la próxima vez que ese administrador ingrese aparecería en una edición que
  // no eligió en esa visita.
  res.cookies.set(COOKIE_EDICION, "", { path: "/", maxAge: 0 });
  return res;
}
