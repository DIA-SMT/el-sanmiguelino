import { cache } from "react";
import type {
  EdicionResumen,
  NotaBuscable,
  NotaCompleta,
  NotaResumen,
} from "@/lib/types";
import { edicionMockRepo } from "@/lib/repos/edicion-mock";

/**
 * De dónde salen las notas del diario.
 *
 * Las firmas son **async desde el primer día**, aunque el motor de hoy sea un
 * objeto en memoria que responde al instante. Ese es el punto: el costo caro
 * de esta migración no es leer de Postgres, es volver asíncronos los
 * componentes que eran síncronos y arrastrar el `await` por todo el árbol. Ese
 * costo se paga contra datos que ya funcionan, y no en el mismo commit en que
 * se estrena la base — donde cualquier síntoma raro se le echaría la culpa a
 * la conexión.
 *
 * Los métodos están partidos por lo que cada pantalla necesita de verdad, no
 * por comodidad. Contra el mock da lo mismo; contra Postgres, `indice()` es un
 * `select` sin el cuerpo de ocho notas.
 */
export interface EdicionRepo {
  /** Cabecera de la edición: mes, número, etiqueta. Sin notas. */
  resumen(): Promise<EdicionResumen>;
  /** Todas las notas en orden de tapa, sin cuerpo. */
  indice(): Promise<NotaResumen[]>;
  /** Una nota entera, o null si no está en la edición. */
  nota(slug: string): Promise<NotaCompleta | null>;
  /** Varias notas enteras, en el orden pedido. Para la portada, que necesita
   *  el cuerpo de las dos primeras, y para Migue, que las necesita todas. */
  completas(slugs: string[]): Promise<NotaCompleta[]>;
  /** El índice más el texto plano de cada cuerpo, para el buscador. */
  buscables(): Promise<NotaBuscable[]>;
}

/** El motor activo. Cuando exista la capa Supabase se elige acá, y no se toca
 *  ningún consumidor. */
const repo: EdicionRepo = edicionMockRepo;

/*
 * Todo va envuelto en `cache()` de React: dentro de un mismo render, quien
 * pida lo mismo comparte una sola lectura. Una página del diario pide el
 * índice desde el layout, el masthead y la página; sin esto serían tres viajes
 * a la base por request.
 */

export const getResumenEdicion = cache(async (): Promise<EdicionResumen> =>
  repo.resumen(),
);

export const getIndice = cache(async (): Promise<NotaResumen[]> =>
  repo.indice(),
);

export const getNota = cache(
  async (slug: string): Promise<NotaCompleta | null> => repo.nota(slug),
);

export const getCompletas = cache(
  async (slugs: string[]): Promise<NotaCompleta[]> => repo.completas(slugs),
);

export const getBuscables = cache(async (): Promise<NotaBuscable[]> =>
  repo.buscables(),
);

/** Para validar que un slug existe sin traerse la nota. Hoy cuesta lo mismo;
 *  con la base detrás, es un `select 1`. */
export async function notaExiste(slug: string): Promise<boolean> {
  const indice = await getIndice();
  return indice.some((n) => n.slug === slug);
}
