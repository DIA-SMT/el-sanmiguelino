import { type NextRequest } from "next/server";
import { darDeBajaConEnlace } from "@/lib/repos/suscripciones";

/**
 * La baja "de un clic" de los programas de correo (RFC 8058).
 *
 * Gmail y otros muestran su propio botón «Anular suscripción» junto al
 * remitente cuando el correo trae las cabeceras `List-Unsubscribe` y
 * `List-Unsubscribe-Post`; al apretarlo, el programa hace un POST a esta
 * dirección con el enlace firmado, sin abrir ninguna página. Gmail y Yahoo lo
 * exigen a quien manda correos en cantidad.
 *
 * Sólo POST: un GET acá daría de baja a cualquiera cuyo correo pase por un
 * filtro que abre los enlaces. Es pública en el proxy (no hay sesión: lo pide
 * un servidor de correo), y la llave es la firma.
 */
export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t") ?? undefined;
  const r = await darDeBajaConEnlace(token, "un-click");
  const ok = r.estado === "hecho" || r.estado === "ya-estaba";
  return new Response(null, { status: ok ? 200 : 400 });
}
