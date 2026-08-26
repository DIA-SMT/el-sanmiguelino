import { cache } from "react";
import type {
  EdicionResumen,
  NotaBorrador,
  NotaBuscable,
  NotaCompleta,
  NotaResumen,
} from "@/lib/types";
import { edicionMockRepo } from "@/lib/repos/edicion-mock";
import { edicionPostgresRepo } from "@/lib/repos/edicion-postgres";

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

  /** El índice de UNA edición, la que sea. Lo necesita el foliado de una nota
   *  del archivo, que se cuenta sobre su propia edición y no sobre la que está
   *  en la calle. */
  indiceDe(edicionSlug: string): Promise<NotaResumen[]>;

  /** Las ediciones ya publicadas, de la más nueva a la más vieja. El archivo. */
  publicadas(): Promise<EdicionResumen[]>;

  /**
   * Guarda una nota: la crea si el slug no existe, la actualiza si sí.
   *
   * Es opcional en la interfaz porque el motor mock **no puede** cumplirla: su
   * almacén es un archivo del repositorio, y una escritura que se pierde al
   * recargar es peor que un error claro. Los consumidores preguntan por
   * `repoEscribe()`.
   */
  guardarNota?(borrador: NotaBorrador): Promise<NotaCompleta>;
}

/**
 * El motor activo, elegido acá y en ningún otro lado: ningún consumidor sabe
 * de dónde salen las notas.
 *
 * El criterio es la presencia de `DATABASE_URL`, y no una variable propia de
 * más. Si hay base configurada se usa; si no —alguien que clona el repo y
 * quiere mirar el diario sin pedirle credenciales a nadie— se cae al mock, que
 * tiene exactamente los mismos datos porque es la semilla.
 *
 * Que el fallback exista no lo vuelve inofensivo: en producción quedarse en el
 * mock significaría servir la edición congelada del archivo mientras el panel
 * escribe en una base que nadie lee. Por eso abajo tira en vez de caer.
 */
const HAY_BASE = Boolean(process.env.DATABASE_URL);

if (!HAY_BASE && process.env.NODE_ENV === "production") {
  throw new Error(
    "Falta DATABASE_URL en producción. Sin base, el diario serviría la edición " +
      "congelada del archivo semilla y todo lo que cargue el panel sería invisible.",
  );
}

const repo: EdicionRepo = HAY_BASE ? edicionPostgresRepo : edicionMockRepo;

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

/** El índice de una edición cualquiera, para el foliado de una nota del
 *  archivo y para su sumario. */
export const getIndiceDe = cache(
  async (edicionSlug: string): Promise<NotaResumen[]> =>
    repo.indiceDe(edicionSlug),
);

/** Las ediciones ya publicadas, de la más nueva a la más vieja. */
export const getPublicadas = cache(async (): Promise<EdicionResumen[]> =>
  repo.publicadas(),
);

/** Para validar que un slug existe sin traerse la nota. Hoy cuesta lo mismo;
 *  con la base detrás, es un `select 1`. */
export async function notaExiste(slug: string): Promise<boolean> {
  const indice = await getIndice();
  return indice.some((n) => n.slug === slug);
}

/** ¿El motor activo sabe escribir? Sólo Postgres. El panel lo consulta para no
 *  ofrecer un botón de guardar que no puede cumplir. */
export function repoEscribe(): boolean {
  return typeof repo.guardarNota === "function";
}

/**
 * Guarda una nota y devuelve la versión persistida.
 *
 * No está envuelta en `cache()` —al revés que las lecturas—: memoizar una
 * escritura haría que dos guardados iguales en el mismo render se conviertan en
 * uno solo, que es exactamente lo que no se quiere.
 */
export async function guardarNota(
  borrador: NotaBorrador,
): Promise<NotaCompleta> {
  if (!repo.guardarNota) {
    throw new Error(
      "El motor activo no sabe escribir. Falta DATABASE_URL: sin base, lo que " +
        "se guarde se pierde al recargar.",
    );
  }
  return repo.guardarNota(borrador);
}
