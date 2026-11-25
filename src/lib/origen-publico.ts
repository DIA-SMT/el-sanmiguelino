import type { NextRequest } from "next/server";

/**
 * El origen con el que el navegador llegó al sitio, para armar redirecciones.
 *
 * `request.nextUrl.origin` no sirve detrás de nginx: `next start` arma la URL
 * con la dirección donde escucha (`localhost:3015`) y no con el `Host` que
 * pidió el navegador, así que una redirección a `/diario` mandaba a
 * `https://localhost:3015/diario`. Pasó con el ingreso por Ciudad Digital el día
 * que el diario se mudó a la VPS.
 *
 * Se lee lo que pone el que está adelante (nginx en la VPS, la plataforma en
 * Vercel): `X-Forwarded-Host` y `X-Forwarded-Proto`, y si no están, `Host`. El
 * diario escucha sólo en 127.0.0.1, así que esos encabezados los escribe
 * siempre nginx, y nginx sólo atiende los nombres de su `server_name`. Igual
 * se revisa que el host tenga forma de host: si no, queda el de Next.
 */
export function origenPublico(request: NextRequest): string {
  const h = request.headers;
  const primero = (valor: string | null) => valor?.split(",")[0]?.trim() || "";

  const host = primero(h.get("x-forwarded-host")) || primero(h.get("host"));
  if (!/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) return request.nextUrl.origin;

  const proto =
    primero(h.get("x-forwarded-proto")) || request.nextUrl.protocol.replace(":", "");
  return `${proto === "http" ? "http" : "https"}://${host}`;
}
