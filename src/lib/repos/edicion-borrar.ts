/**
 * Borrar una edición.
 *
 * Es la única operación del panel que **pierde datos de un vecino**: borrar una
 * edición se lleva sus notas —o sus páginas de PDF—, y con ellas los comentarios
 * y los votos, por la cascada de claves externas que declara el esquema
 * (`ediciones` → `notas` → `comentarios` → `votos`). No hay papelera y no hay
 * vuelta atrás.
 *
 * Por eso acá hay más comprobaciones que en cualquier otra escritura, y todas
 * corren **del lado del servidor**: lo que la pantalla dibuja es una cortesía,
 * no un control. Una Server Action es un endpoint POST con su propia URL.
 *
 * Existe porque una edición cargada por error no tenía forma de irse: quedaba en
 * la lista para siempre, y si además se le había puesto una fecha ya cumplida,
 * competía por ser la que sale.
 */

import "server-only";

import { db } from "@/lib/db";
import { otrasServibles, slugEnLaCalle } from "@/lib/repos/edicion-servibles";

/** Lo que hay que saber antes de borrar, y lo que el panel muestra para que
 *  quien aprieta sepa qué se lleva puesto. */
export interface EstadoParaBorrar {
  slug: string;
  mes: string;
  /** Notas escritas a mano. */
  notas: number;
  /** Páginas del facsímil. */
  paginas: number;
  /** Comentarios de vecinos que se van con la edición. */
  comentarios: number;
  /** Tiene el PDF del impreso cargado. */
  tienePdf: boolean;
  /** Es la que el lector ve ahora mismo al abrir el diario. */
  enLaCalle: boolean;
  /** Es la ÚNICA que se puede servir: borrarla deja el diario sin número. */
  laUnicaServible: boolean;
}

/**
 * Qué se va a perder, y si se puede.
 *
 * Se consulta dos veces: una para dibujar el aviso y otra dentro de la acción
 * que borra, justo antes de borrar. La segunda no es paranoia — entre que la
 * pantalla se dibujó y alguien apretó el botón puede haber pasado un rato, y en
 * el medio otra persona pudo comentar una nota de esa edición.
 */
export async function estadoParaBorrar(
  edicionSlug: string,
): Promise<EstadoParaBorrar | null> {
  const edicion = await db().edicion.findUnique({
    where: { slug: edicionSlug },
    select: { id: true, slug: true, mes: true, pdfUrl: true },
  });
  if (!edicion) return null;

  const [notas, paginas, comentarios, enLaCalle, serviblesSinEsta] =
    await Promise.all([
      db().nota.count({ where: { edicionId: edicion.id, pdfPagina: null } }),
      db().nota.count({
        where: { edicionId: edicion.id, pdfPagina: { not: null } },
      }),
      db().comentario.count({ where: { nota: { edicionId: edicion.id } } }),
      slugEnLaCalle(),
      // Cuántas otras quedarían para servir si esta se fuera. Cero significa
      // que el diario se queda sin número que mostrar.
      otrasServibles(edicionSlug),
    ]);

  return {
    slug: edicion.slug,
    mes: edicion.mes,
    notas,
    paginas,
    comentarios,
    tienePdf: Boolean(edicion.pdfUrl),
    enLaCalle: enLaCalle === edicion.slug,
    laUnicaServible: enLaCalle === edicion.slug && serviblesSinEsta === 0,
  };
}

/**
 * Borra la edición. Devuelve qué se llevó puesto.
 *
 * `confirmacion` tiene que ser el slug tipeado a mano **cuando la edición tiene
 * algo adentro**. No es un trámite: un botón de borrar al lado de uno de editar,
 * en una lista de fichas parecidas, se aprieta por accidente — y acá el
 * accidente se lleva los comentarios de vecinos. Cuando la edición está vacía
 * —el caso que motivó todo esto, la que se cargó de más— no se pide nada: no hay
 * nada que perder y pedir ceremonia para tirar una fila vacía es maltratar a
 * quien se equivocó.
 *
 * **El PDF del bucket no se borra**, por lo mismo que en `quitarPdfDeEdicion`:
 * es barato, y un lector con la página abierta puede estar pidiéndolo todavía.
 */
export async function borrarEdicion(
  edicionSlug: string,
  confirmacion?: string,
): Promise<EstadoParaBorrar> {
  const estado = await estadoParaBorrar(edicionSlug);
  if (!estado) throw new Error(`No existe la edición "${edicionSlug}".`);

  if (estado.laUnicaServible) {
    throw new Error(
      `"${estado.mes}" es la única edición que el diario puede servir: ` +
        "borrarla dejaría el sitio sin ningún número que mostrar. Publicá otra " +
        "—o dale una fecha ya cumplida— y después borrá esta.",
    );
  }

  /*
   * `tienePdf` cuenta, y no es un detalle: **un facsímil de una sola página no
   * tiene ninguna fila en `notas`** —la página 1 es la tapa y se sirve en
   * /diario— así que sin esto un número entero, cargado y publicable, se borraba
   * de un click como si estuviera vacío. Apareció probando exactamente ese caso:
   * la ficha del panel sí pedía el slug (mira `edicion.pdf`) y el servidor no,
   * o sea que las dos mitades del mismo control no decían lo mismo.
   */
  const tieneAlgo =
    estado.notas > 0 ||
    estado.paginas > 0 ||
    estado.comentarios > 0 ||
    estado.tienePdf;
  if (tieneAlgo && confirmacion !== estado.slug) {
    throw new Error(
      `Para borrar "${estado.mes}" hay que escribir su slug (${estado.slug}) ` +
        "tal cual.",
    );
  }

  // Una sola sentencia, por el slug que ya es único: la cascada de la base se
  // lleva notas, comentarios y votos. No hace falta transacción porque un
  // DELETE con cascada ya es atómico — y hacerlo a mano en tres pasos abriría
  // una ventana en la que la edición existe y sus notas no.
  await db().edicion.delete({ where: { slug: edicionSlug } });

  return estado;
}
