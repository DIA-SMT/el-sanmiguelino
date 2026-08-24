import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, cookieMuerta } from "@/lib/auth/cookie";
import { AUTH_CIDITUC_OBLIGATORIA } from "@/lib/auth/config";

/**
 * Gate de acceso con Cidituc. Públicas: la landing (/), /login y las rutas de
 * auth; todo el resto del diario requiere sesión.
 *
 * El proxy hace un chequeo *estructural* del token (versión y vencimiento), no
 * criptográfico: la firma se verifica del lado servidor en cada página y API.
 * Lo que sí aporta acá es distinguir una cookie ausente de una vencida, para
 * poder borrarla — si no, el navegador manda para siempre una cookie muerta,
 * el proxy la ve "presente" y manda a /login, /login ve sesión y manda al
 * diario: bucle infinito.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const bruta = request.cookies.get(SESSION_COOKIE)?.value;
  const muerta = Boolean(bruta) && cookieMuerta(bruta);
  const tieneSesion = Boolean(bruta) && !muerta;

  const esAuth = pathname.startsWith("/api/auth/");
  const esPublica = pathname === "/" || pathname === "/login" || esAuth;

  // Las API responden su propio 401 (un redirect HTML no le sirve a un fetch).
  // Antes /api/* quedaba enteramente fuera del gate: cualquiera sin sesión
  // podía postear comentarios o consultar a Migue.
  if (pathname.startsWith("/api/")) {
    if (!esAuth && !tieneSesion) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (AUTH_CIDITUC_OBLIGATORIA && !esPublica && !tieneSesion) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search =
      pathname === "/diario" ? "" : `?volverA=${encodeURIComponent(pathname)}`;
    const res = NextResponse.redirect(url);
    if (muerta) res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  // Con sesión, la landing y el login van directo al diario.
  if (tieneSesion && (pathname === "/" || pathname === "/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/diario";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Cookie muerta en una ruta pública: se limpia acá para que la próxima
  // navegación arranque sin ella.
  if (muerta) {
    const res = NextResponse.next();
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  // El `$` al final del grupo de extensiones no es decorativo: sin él, la
  // alternancia se ancla en cualquier parte de la ruta y `/admin/x.png/borrar`
  // queda exento del proxy. Con `$`, sólo se exime lo que TERMINA en imagen.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
