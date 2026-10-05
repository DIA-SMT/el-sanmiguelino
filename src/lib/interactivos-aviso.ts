/**
 * Lo que comparten las dos puertas de `/interactivo`: la ruta
 * (`src/app/interactivo/route.ts`) y el gate de sesión (`src/proxy.ts`), que
 * contesta antes que la ruta cuando no hay sesión. Sin `server-only` porque el
 * proxy también lo usa.
 */

import { SITIOS_INCRUSTABLES } from "@/lib/interactivos";

/**
 * Las cabeceras de todo lo que sale de `/interactivo`, sea el interactivo o un
 * aviso. El porqué de cada una está en la ruta; acá importa que sean las
 * MISMAS siempre: un aviso sin el sandbox sería una página de nuestro origen
 * adentro del recuadro.
 */
export const CABECERAS_INTERACTIVO: Record<string, string> = {
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": [
    "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox",
    "frame-ancestors 'self'",
    "form-action 'none'",
    `base-uri ${SITIOS_INCRUSTABLES.map((s) => `https://${s}`).join(" ")}`,
  ].join("; "),
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Lo que se ve en el recuadro cuando no va el interactivo. Con el enlace para
 * abrirlo en el Portal si se sabe cuál es: puede ser un problema de este lado
 * y no del Portal.
 *
 * El tema lo resuelve solo: adentro de un <iframe>, `prefers-color-scheme`
 * sigue el `color-scheme` que el diario le pone a la página según su tema.
 */
export function paginaDeAviso(mensaje: string, url: string | null): string {
  const enlace = url
    ? `<p><a href="${escapar(url)}" target="_blank" rel="noopener noreferrer">Abrirlo en el Portal de Datos</a></p>`
    : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Interactivo</title>
<style>html,body{height:100%;margin:0}body{display:grid;place-items:center;padding:24px;box-sizing:border-box;font:15px/1.5 Georgia,serif;font-style:italic;color:#555;background:#efe9dc;text-align:center}a{color:#1a5fb4}@media (prefers-color-scheme:dark){body{background:#1d222b;color:#b8bfca}a{color:#7fb0ff}}</style></head>
<body><div><p>${escapar(mensaje)}</p>${enlace}</div></body></html>`;
}

/** El aviso de "sin sesión", listo para devolver. */
export function respuestaSinSesion(url: string | null): Response {
  return new Response(
    paginaDeAviso(
      "Tu sesión en el diario venció. Volvé a ingresar para ver el interactivo.",
      url,
    ),
    {
      status: 401,
      headers: { ...CABECERAS_INTERACTIVO, "Cache-Control": "no-store" },
    },
  );
}
