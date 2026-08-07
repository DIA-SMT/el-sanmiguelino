import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { AUTH_CIDITUC_OBLIGATORIA } from "@/lib/auth/config";

/**
 * Gate de acceso con Cidituc. Públicas: la landing (/), /login y las rutas de
 * auth; todo el resto del diario requiere sesión. Acá solo se chequea
 * presencia de la cookie (redirección rápida); la firma se verifica del lado
 * servidor en páginas y API.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const tieneSesion = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  const esPublica =
    pathname === "/" || pathname === "/login" || pathname.startsWith("/api/auth/");

  // Las API protegidas responden su propio 401 (un redirect HTML no le sirve
  // a un fetch); el proxy solo redirige navegaciones de página.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (AUTH_CIDITUC_OBLIGATORIA && !esPublica && !tieneSesion) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search =
      pathname === "/diario" ? "" : `?volverA=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  // Con sesión, la landing y el login van directo al diario.
  if (tieneSesion && (pathname === "/" || pathname === "/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/diario";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)).*)"],
};
