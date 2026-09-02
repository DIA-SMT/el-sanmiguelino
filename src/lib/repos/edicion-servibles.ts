/**
 * Qué ediciones puede servir el diario, y cuál está sirviendo.
 *
 * Existe para que la regla viva **una sola vez**. Es la misma que usa
 * `edicionActualFila()` para elegir el número que sale —fecha ya cumplida más
 * `TIENE_CONTENIDO`— y la necesitan las tres escrituras que pueden dejar al
 * diario sin ningún número que mostrar:
 *
 * - borrar una edición (`edicion-borrar.ts`),
 * - quitarle el PDF a un facsímil (`edicion-pdf.ts`), que borra sus páginas y
 *   la deja sin contenido,
 * - y la pantalla del panel, que apaga los botones correspondientes.
 *
 * Cuando la regla estaba copiada, las copias se separaron: el panel marcaba
 * "En la calle" mirando sólo la fecha, mientras el diario se salteaba esa
 * edición por no tener contenido y servía la anterior. El panel decía una cosa
 * y el lector veía otra.
 *
 * **Por qué importa tanto**: si no queda ninguna edición servible,
 * `edicionActualFila()` tira, y eso no es una pantalla fea — lo llaman
 * `getResumenEdicion()` y `getIndice()`, que usan la landing PÚBLICA y el
 * layout del diario. Sin `error.tsx` en el proyecto, el lector recibe un 500.
 */

import "server-only";

import { db } from "@/lib/db";
import { TIENE_CONTENIDO } from "@/lib/repos/edicion-postgres";

/**
 * El slug de la edición que el lector ve al abrir el diario, o `null` si no hay
 * ninguna.
 *
 * Ignora la edición "en foco" del administrador a propósito: la vista previa es
 * de él, y lo que estas guardas protegen es el diario del lector.
 */
export async function slugEnLaCalle(): Promise<string | null> {
  const fila = await db().edicion.findFirst({
    where: { publicaEn: { not: null, lte: new Date() }, ...TIENE_CONTENIDO },
    orderBy: { publicaEn: "desc" },
    select: { slug: true },
  });
  return fila?.slug ?? null;
}

/** Cuántas OTRAS ediciones podría servir el diario si esta desapareciera. Cero
 *  significa que lo que se está por hacer deja el sitio sin número. */
export async function otrasServibles(exceptoSlug: string): Promise<number> {
  return db().edicion.count({
    where: {
      slug: { not: exceptoSlug },
      publicaEn: { not: null, lte: new Date() },
      ...TIENE_CONTENIDO,
    },
  });
}

/**
 * ¿Es esta edición la única que el diario puede servir?
 *
 * Se pregunta antes de cualquier escritura que la deje sin contenido. Las dos
 * consultas van juntas acá para que ningún llamador se olvide de una: preguntar
 * sólo "¿es la que está en la calle?" dejaría pasar el borrado cuando hay otra
 * más vieja para caerse, y preguntar sólo "¿hay otras?" trabaría el borrado de
 * una edición programada que no está sirviendo nada.
 */
export async function esLaUnicaServible(edicionSlug: string): Promise<boolean> {
  const [enLaCalle, otras] = await Promise.all([
    slugEnLaCalle(),
    otrasServibles(edicionSlug),
  ]);
  return enLaCalle === edicionSlug && otras === 0;
}
