import { cache } from "react";
import type { Edicion, Nota } from "@/lib/types";
import { edicionMockRepo } from "@/lib/repos/edicion-mock";

/**
 * De dónde salen las notas del diario.
 *
 * Las firmas son **async desde el primer día**, aunque el motor de hoy sea un
 * objeto en memoria que responde al instante. Ese es el punto de la etapa: el
 * costo caro de esta migración no es leer de Postgres, es volver asíncronos
 * ocho componentes que hoy son síncronos y arrastrar el `await` por todo el
 * árbol. Ese costo se paga acá, contra datos que ya funcionan, y no en el
 * mismo commit en que se estrena la base — donde cualquier síntoma raro se le
 * echaría la culpa a la conexión.
 */
export interface EdicionRepo {
  /** La edición en curso, entera. */
  actual(): Promise<Edicion>;
  /** Una nota por slug, o null si no está en la edición. */
  nota(slug: string): Promise<Nota | null>;
}

/** El motor activo. Cuando exista la capa Supabase, se elige acá y no se toca
 *  ningún consumidor. */
const repo: EdicionRepo = edicionMockRepo;

/**
 * La edición en curso.
 *
 * Envuelta en `cache()` de React: dentro de un mismo render, todos los que la
 * pidan comparten una sola lectura. Una página del diario la pide desde el
 * layout, el masthead, la página y dos o tres componentes; sin esto serían
 * cinco viajes a la base por request.
 */
export const getEdicion = cache(async (): Promise<Edicion> => repo.actual());

/** Una nota por slug. Memoizada por render, igual que la edición. */
export const getNota = cache(
  async (slug: string): Promise<Nota | null> => repo.nota(slug),
);

/** Para validar que un slug existe sin traerse la nota entera. Hoy cuesta lo
 *  mismo; con la base detrás, es un `select 1`. */
export async function notaExiste(slug: string): Promise<boolean> {
  return (await getNota(slug)) !== null;
}
