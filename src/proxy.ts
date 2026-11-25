import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, cookieMuerta } from "@/lib/auth/cookie";

/**
 * El proxy del diario. **Leer es libre**: ninguna página de lectura pide sesión.
 * Cidituc se pide para participar —comentar, votar, preguntarle a Migue,
 * anotarse para el papel—, y eso lo controla cada API con
 * `sesionParaParticipar()`, que verifica la firma. Antes todo el diario estaba
 * detrás del ingreso y este archivo mandaba a /login a quien no tuviera sesión.
 *
 * Lo que queda acá:
 *
 * - Las rutas de `/api` piden sesión, salvo el ingreso en sí, LEER los
 *   comentarios de una nota (`GET /api/comentarios`, exacto: ni el POST de la
 *   misma ruta ni los votos, que cuelgan de ella), la baja de un clic del
 *   newsletter (`POST /api/newsletter/baja`, exacto), la cola del newsletter
 *   (`POST /api/newsletter/procesar`, exacto) y el contador de visitas
 *   (`POST /api/visita`, exacto). Es un atajo para cortar
 *   temprano: el control de verdad está en cada handler, porque acá sólo se
 *   mira la FORMA de la cookie (versión y vencimiento), no la firma.
 *
 * - `/admin` no se toca acá a propósito. Responde 404 por su cuenta
 *   (`requerirAdmin()`), con o sin sesión, para no anunciar que existe. Mandar
 *   a /login sólo desde /admin sería decirlo.
 *
 * - Con sesión, la raíz va a la tapa: la presentación es para quien llega sin
 *   cuenta. `/login` ya no se redirige acá: lo decide la página, con la firma
 *   verificada. Con una cookie de firma vieja (si se rota el secreto) el proxy
 *   la ve "viva", y mandarla a la tapa desde /login dejaba a la persona sin
 *   poder volver a ingresar hasta que venciera.
 *
 * - Una cookie vencida se borra, en cualquier ruta. Si no, el navegador la
 *   manda para siempre.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const bruta = request.cookies.get(SESSION_COOKIE)?.value;
  const muerta = Boolean(bruta) && cookieMuerta(bruta);
  const tieneSesion = Boolean(bruta) && !muerta;

  if (pathname.startsWith("/api/")) {
    const esAuth = pathname.startsWith("/api/auth/");
    const leeComentarios =
      request.method === "GET" && pathname === "/api/comentarios";
    // La baja de un clic del newsletter la pide el servidor de correo de quien
    // lo recibe, sin sesión. La llave es el enlace firmado: ver la ruta.
    const bajaDeNewsletter =
      request.method === "POST" && pathname === "/api/newsletter/baja";
    // La cola del newsletter la llama la base (pg_cron) cada minuto, sin
    // sesión. La llave es NEWSLETTER_CRON_SECRET: ver la ruta.
    const colaDeNewsletter =
      request.method === "POST" && pathname === "/api/newsletter/procesar";
    // El contador de visitas lo manda el navegador de cualquier lector, con
    // o sin sesión. Ver la ruta.
    const contadorDeVisitas =
      request.method === "POST" && pathname === "/api/visita";
    if (
      !esAuth &&
      !leeComentarios &&
      !bajaDeNewsletter &&
      !colaDeNewsletter &&
      !contadorDeVisitas &&
      !tieneSesion
    ) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
  }

  if (tieneSesion && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/diario";
    url.search = "";
    return NextResponse.redirect(url);
  }

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
  //
  // El manifest y el service worker van exentos por la misma razón que el
  // favicon: el navegador los pide solo y, en el caso del manifest, sin cookies.
  // Con el gate encima, el diario dejaba de ser instalable sin un solo error a
  // la vista. Llevan `$` para no eximir nada que sólo empiece igual.
  //
  // `archivos/` (fotos, PDF y audio del depósito) y `api/archivos/subir` van
  // fuera por otra razón: el proxy copia el cuerpo del pedido, y la subida de
  // un PDF de decenas de MB tiene que ir directo a disco. Las dos se cuidan
  // solas: los archivos son públicos y la subida lleva su firma.
  matcher: [
    "/((?!_next/static|_next/image|archivos/|api/archivos/subir$|favicon\\.ico|manifest\\.webmanifest$|sw\\.js$|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
};
