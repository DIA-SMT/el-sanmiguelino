import { NextResponse, type NextRequest } from "next/server";
import { ciditucAdapter } from "@/lib/auth/cidituc";
import { SESSION_COOKIE, TTL_SESION_SEG } from "@/lib/auth/cookie";
import { crearToken } from "@/lib/auth/session";

/**
 * Login vía Cidituc. Hoy usa el adapter mock; cuando se confirme el SSO real
 * este endpoint **se borra** y lo reemplaza el flujo OAuth2/OIDC
 * (GET /api/auth/cidituc → authorize → callback). No se deja "por las dudas":
 * un POST sin credenciales que devuelve una sesión válida es exactamente el
 * agujero que hay que cerrar.
 */
export async function POST(request: NextRequest) {
  // Sin credenciales que validar, lo único que se puede exigir es que el
  // pedido venga de la propia app. No sustituye a la autenticación real.
  const origen = request.headers.get("origin");
  if (origen) {
    const host =
      request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    let mismoSitio = false;
    try {
      mismoSitio = new URL(origen).host === host;
    } catch {
      mismoSitio = false;
    }
    if (!mismoSitio) {
      return NextResponse.json({ error: "Origen inválido" }, { status: 403 });
    }
  }

  const usuario = await ciditucAdapter.login();
  const res = NextResponse.json({ usuario });
  res.cookies.set(SESSION_COOKIE, crearToken(usuario), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // El mismo número que el `exp` de adentro del token. Antes eran 30 días
    // acá y ningún vencimiento adentro: dos fuentes de verdad, y la que
    // mandaba era la del cliente.
    maxAge: TTL_SESION_SEG,
  });
  return res;
}
