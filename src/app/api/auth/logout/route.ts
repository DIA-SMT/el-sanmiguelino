import { NextResponse } from "next/server";
import { salidaCidituc } from "@/lib/auth/config";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { COOKIE_EDICION } from "@/lib/auth/vista-previa";

/**
 * Cierra la sesión del diario y dice a dónde ir para cerrar también la de
 * Ciudad Digital (`salida`, o `null` si no hay integración). La navegación la
 * hace el cliente: tiene que ser de verdad, porque el token que hay que borrar
 * vive en el `localStorage` de otro sitio.
 */
export async function POST() {
  const res = NextResponse.json({ ok: true, salida: salidaCidituc() });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  // También la vista previa de una edición: sin sesión no sirve, y si quedara,
  // la próxima vez que ese administrador ingrese aparecería en una edición que
  // no eligió en esa visita.
  res.cookies.set(COOKIE_EDICION, "", { path: "/", maxAge: 0 });
  return res;
}
