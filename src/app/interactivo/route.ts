import type { NextRequest } from "next/server";
import { usuarioActual } from "@/lib/auth/dal";
import { urlIncrustable } from "@/lib/interactivos";
import {
  CABECERAS_INTERACTIVO,
  paginaDeAviso,
  respuestaSinSesion,
} from "@/lib/interactivos-aviso";
import { prepararInteractivo } from "@/lib/interactivos-servidor";

/**
 * El interactivo del Portal de Datos, ajustado para la nota (ver
 * `src/lib/interactivos-servidor.ts`). Lo pide el <iframe> de
 * `InteractivoIncrustado`: `/interactivo?u=<dirección del Portal>&tema=dark`.
 *
 * **Se sirve aislado, aunque viva en nuestro dominio.** Es una página ajena con
 * sus scripts, y servida desde acá correría con los permisos del diario: podría
 * actuar con la sesión del lector, comentar en su nombre, todo. Por eso la
 * respuesta lleva `Content-Security-Policy: sandbox` SIN `allow-same-origin`
 * (las cabeceras están en `src/lib/interactivos-aviso.ts`): el navegador la
 * trata como de un origen anónimo, sin acceso a nuestras cookies, a nuestro
 * almacenamiento ni a la página que la contiene —aunque alguien la abra directo
 * en una pestaña—. El <iframe> repite el sandbox; las dos cosas juntas, para
 * que olvidarse de una no abra nada.
 *
 * Además:
 * - `frame-ancestors 'self'`: sólo el diario la puede meter en un recuadro.
 * - `form-action 'none'`: no puede mandar formularios. Un falso "Ingresá con
 *   Ciudadano Digital" adentro de la nota no tendría a dónde enviar nada.
 * - `base-uri`: el único <base> que vale es el que pone el diario, del Portal.
 * - Sólo se piden direcciones que pasan `urlIncrustable` —los sitios de
 *   `SITIOS_INCRUSTABLES`, sin otro puerto—, y las redirecciones se validan
 *   antes de seguirlas. La ruta no es un proxy abierto.
 *
 * **La sesión se verifica acá, con su firma.** El gate de `src/proxy.ts` sólo
 * mira la forma de la cookie: una inventada con un vencimiento lejano pasa.
 * Las páginas lo cubren porque el layout del diario verifica la firma, pero un
 * route handler no pasa por ningún layout. Sin esto, cualquiera usaba el
 * servidor del diario para bajar páginas del Portal. Va antes de mirar la
 * dirección, para que sin sesión no se pueda tantear cuáles se aceptan.
 *
 * No va bajo `/api/` porque devuelve una página, no datos, y el gate de `/api/`
 * responde JSON.
 */
export async function GET(request: NextRequest) {
  if (!(await usuarioActual())) return respuestaSinSesion(null);

  const url = urlIncrustable(request.nextUrl.searchParams.get("u") ?? "");
  if (!url) {
    return new Response(
      paginaDeAviso("Ese interactivo no es de un sitio habilitado.", null),
      { status: 400, headers: { ...CABECERAS_INTERACTIVO, "Cache-Control": "no-store" } },
    );
  }
  const tema =
    request.nextUrl.searchParams.get("tema") === "dark" ? "dark" : "light";

  let r: Awaited<ReturnType<typeof prepararInteractivo>>;
  try {
    r = await prepararInteractivo(url, tema);
  } catch {
    r = { ok: false, motivo: "portal" };
  }
  if (!r.ok) {
    return new Response(
      paginaDeAviso("No se pudo traer el interactivo del Portal de Datos.", url),
      { status: 502, headers: { ...CABECERAS_INTERACTIVO, "Cache-Control": "no-store" } },
    );
  }
  return new Response(r.html, {
    headers: {
      ...CABECERAS_INTERACTIVO,
      // Privada: depende de la sesión. Diez minutos alcanzan para que pasar
      // de página y volver no la baje de nuevo.
      "Cache-Control": "private, max-age=600",
    },
  });
}
