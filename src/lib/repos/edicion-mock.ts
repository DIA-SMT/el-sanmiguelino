import type { EdicionRepo } from "@/lib/repos/edicion";
import { edicionActual } from "@/lib/data/edicion-actual";

/**
 * Motor en memoria: proyecta la edición hardcodeada de
 * `src/lib/data/edicion-actual.ts`.
 *
 * **Este es el único archivo de la app que puede importar `edicionActual`.**
 * Es el portón de la migración: mientras `git grep edicionActual` no devuelva
 * nada fuera de acá, la frontera está bien puesta y cambiar de motor es
 * cambiar una línea en `edicion.ts`.
 *
 * El archivo de datos se queda en el árbol después de que exista Supabase: es
 * la semilla con la que se carga la base la primera vez.
 */
export const edicionMockRepo: EdicionRepo = {
  async actual() {
    return edicionActual;
  },

  async nota(slug) {
    return edicionActual.notas.find((n) => n.slug === slug) ?? null;
  },
};
