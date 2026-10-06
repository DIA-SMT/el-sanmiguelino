import type { NextRequest } from "next/server";
import { urlIncrustable } from "@/lib/interactivos";
import {
  CABECERAS_INTERACTIVO,
  paginaDeAviso,
} from "@/lib/interactivos-aviso";
import { prepararInteractivo } from "@/lib/interactivos-servidor";
import { getNota } from "@/lib/repos/edicion";

/**
 * El interactivo del Portal de Datos, ajustado para la nota (ver
 * `src/lib/interactivos-servidor.ts`). Lo pide el <iframe> de
 * `InteractivoIncrustado`: `/interactivo?nota=<slug>&bloque=<n>&tema=dark`.
 *
 * **Es público, como leer la nota.** Por eso no recibe una dirección: recibe
 * una nota y el lugar del bloque, y la dirección sale de la nota. `getNota`
 * sólo devuelve notas de ediciones que ya se pueden leer —salvo la vista previa
 * de un administrador—, y la dirección vuelve a pasar por `urlIncrustable`. Lo
 * único que esta ruta puede bajar del Portal es lo que el diario publicó: no es
 * un intermediario al que se le pueda pedir cualquier página.
 *
 * **Se sirve aislado, aunque viva en nuestro dominio.** Es una página ajena con
 * sus scripts, y servida desde acá correría con los permisos del diario: podría
 * actuar con la sesión del lector, comentar en su nombre, todo. Por eso la
 * respuesta lleva `Content-Security-Policy: sandbox` SIN `allow-same-origin`
 * (las cabeceras están en `src/lib/interactivos-aviso.ts`): el navegador la
 * trata como de un origen anónimo, sin acceso a nuestras cookies, a nuestro
 * almacenamiento ni a la página que la contiene —aunque alguien la abra directo
 * en una pestaña—. El <iframe> repite el sandbox; las dos cosas juntas, para
 * que olvidarse de una no abra nada. Además:
 * - `frame-ancestors 'self'`: sólo el diario la puede meter en un recuadro.
 * - `form-action 'none'`: no puede mandar formularios. Un falso "Ingresá con
 *   Ciudadano Digital" adentro de la nota no tendría a dónde enviar nada.
 * - `base-uri`: el único <base> que vale es el que pone el diario, del Portal.
 *
 * No va bajo `/api/` porque devuelve una página, no datos, y el gate de `/api/`
 * pide sesión.
 */

const SIN_GUARDAR = { ...CABECERAS_INTERACTIVO, "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const parametros = request.nextUrl.searchParams;
  const slug = parametros.get("nota") ?? "";
  const indice = Number(parametros.get("bloque"));
  const nota = slug && Number.isInteger(indice) && indice >= 0
    ? await getNota(slug)
    : null;
  const bloque = nota?.cuerpo[indice];
  const url =
    bloque?.tipo === "interactivo" ? urlIncrustable(bloque.url) : null;
  if (!url) {
    return new Response(
      paginaDeAviso("Este interactivo no está disponible.", null),
      { status: 404, headers: SIN_GUARDAR },
    );
  }
  const tema = parametros.get("tema") === "dark" ? "dark" : "light";

  let r: Awaited<ReturnType<typeof prepararInteractivo>>;
  try {
    r = await prepararInteractivo(url, tema);
  } catch {
    r = { ok: false, motivo: "portal" };
  }
  if (!r.ok) {
    return new Response(
      paginaDeAviso("No se pudo traer el interactivo del Portal de Datos.", url),
      { status: 502, headers: SIN_GUARDAR },
    );
  }
  return new Response(r.html, {
    headers: {
      ...CABECERAS_INTERACTIVO,
      // Sólo en el navegador de quien mira, no en una caché compartida: en la
      // vista previa de un administrador la nota puede no estar publicada.
      // Diez minutos alcanzan para que pasar de página y volver no la baje
      // de nuevo; la copia del Portal ya la guarda el servidor.
      "Cache-Control": "private, max-age=600",
    },
  });
}
