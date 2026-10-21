/**
 * Ordenar las notas de una edición.
 *
 * Lo pidió la redacción (2026-10-21): la digitalización lee el PDF página por
 * página, y cuando una página trae varias notas salen juntas. Se separan
 * creando una nota nueva, y la nueva caía siempre al final de la edición,
 * lejos de la página de la que salió.
 *
 * **Lo que se mueve son las notas escritas.** Las páginas del impreso van en
 * el orden del papel: es el orden del PDF, el que reconstruye la digitalización
 * cada vez y el que el facsímil tiene que seguir. Una nota escrita puede ir en
 * cualquier lugar entre ellas, menos antes de la tapa del impreso: la tapa es
 * la página 1 y es lo que dice que el número está digitalizado (ver
 * `esDigitalizada` en `paginas.ts`). En un número de notas escritas, sin PDF,
 * cualquiera puede ir primera, y la primera es la que abre la portada.
 *
 * La regla vive en `nuevoOrden()` (`src/lib/data/orden-notas.ts`), que es
 * pura, para poder probarla sin base.
 */

import "server-only";

import { db } from "@/lib/db";
import {
  nuevoOrden,
  type FilaParaOrdenar,
} from "@/lib/data/orden-notas";

export { nuevoOrden, type FilaParaOrdenar };

/** Las notas de una edición en su orden, para elegir dónde ubicar una. Del
 *  panel: de cualquier edición, publicada o no. */
export async function filasDeEdicion(
  edicionSlug: string,
): Promise<FilaParaOrdenar[]> {
  return db().nota.findMany({
    where: { edicion: { slug: edicionSlug } },
    orderBy: { orden: "asc" },
    select: { slug: true, titulo: true, pdfPagina: true },
  });
}

/**
 * Ubica una nota detrás de otra de su edición, o primera con `null`.
 *
 * Devuelve si cambió algo. Corre en una transacción `Serializable`: lee el
 * orden y lo reescribe entero, y dos personas ordenando la misma edición a la
 * vez no pueden pisarse a medias.
 */
export async function ubicarNota(
  slug: string,
  despuesDe: string | null,
): Promise<{ cambio: boolean; edicionSlug: string; titulo: string }> {
  try {
    return await db().$transaction(
      async (tx) => {
        const nota = await tx.nota.findUnique({
          where: { slug },
          select: { titulo: true, edicionId: true, edicion: { select: { slug: true } } },
        });
        if (!nota) throw new Error(`No existe la nota "${slug}".`);

        const filas = await tx.nota.findMany({
          where: { edicionId: nota.edicionId },
          orderBy: { orden: "asc" },
          select: { id: true, slug: true, titulo: true, pdfPagina: true },
        });
        const orden = nuevoOrden(filas, slug, despuesDe);
        const base = { edicionSlug: nota.edicion.slug, titulo: nota.titulo };
        if (orden.every((s, i) => filas[i].slug === s)) {
          return { cambio: false, ...base };
        }

        /*
         * Dos pasadas, por `@@unique([edicionId, orden])`: primero todas a un
         * rango que no choca con nada, después cada una a su lugar. Escribir
         * el número final de una vez chocaría con la fila que todavía lo
         * tiene.
         */
        const idDe = new Map(filas.map((f) => [f.slug, f.id]));
        for (const [i, s] of orden.entries()) {
          await tx.nota.update({
            where: { id: idDe.get(s)! },
            data: { orden: 100_000 + i },
          });
        }
        for (const [i, s] of orden.entries()) {
          await tx.nota.update({
            where: { id: idDe.get(s)! },
            data: { orden: i },
          });
        }
        return { cambio: true, ...base };
      },
      { isolationLevel: "Serializable" },
    );
  } catch (e) {
    // P2034: otra transacción tocó el mismo orden. No se escribió nada.
    if ((e as { code?: string })?.code === "P2034") {
      throw new Error(
        "Alguien más estaba ordenando esta edición al mismo tiempo, y no se " +
          "movió nada. Recargá y volvé a intentar.",
      );
    }
    throw e;
  }
}
