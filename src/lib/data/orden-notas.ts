/**
 * Las reglas del orden de las notas de una edición, sin base de datos.
 *
 * Viven aparte de los repos para poder probarlas solas: son las que deciden
 * dónde queda cada nota, y un error acá desordena un número publicado.
 */

/** Lo mínimo de una fila para decidir dónde puede ir una nota. */
export interface FilaParaOrdenar {
  slug: string;
  titulo: string;
  pdfPagina: number | null;
}

/**
 * El orden nuevo, como lista de slugs, o un error que se puede mostrar.
 *
 * `despuesDe` es el slug de la nota detrás de la cual va, o `null` para que
 * vaya primera. `filas` en el orden actual.
 *
 * Se mueven sólo las notas escritas: las páginas del impreso van en el orden
 * del papel. Y nada va antes de la tapa del impreso, que es la página 1 y es
 * lo que dice que el número está digitalizado (`esDigitalizada`).
 */
export function nuevoOrden(
  filas: FilaParaOrdenar[],
  slug: string,
  despuesDe: string | null,
): string[] {
  const fila = filas.find((f) => f.slug === slug);
  if (!fila) throw new Error("La nota no está en esta edición.");
  if (fila.pdfPagina !== null) {
    throw new Error(
      `Es la página ${fila.pdfPagina} del impreso: las páginas del PDF van en ` +
        "el orden del papel. Lo que se puede mover son las notas escritas.",
    );
  }
  if (despuesDe === slug) {
    throw new Error("Una nota no puede ir después de sí misma.");
  }
  const resto = filas.filter((f) => f.slug !== slug);
  if (despuesDe === null) {
    if (resto.some((f) => f.pdfPagina === 1)) {
      throw new Error(
        "Antes de la tapa del impreso no puede ir ninguna nota: la tapa es la " +
          "página 1 del número.",
      );
    }
    return [slug, ...resto.map((f) => f.slug)];
  }
  const i = resto.findIndex((f) => f.slug === despuesDe);
  if (i === -1) {
    throw new Error("La nota de referencia no está en esta edición.");
  }
  const orden = resto.map((f) => f.slug);
  orden.splice(i + 1, 0, slug);
  return orden;
}

/**
 * El orden de una edición después de digitalizar su PDF: cada página del
 * impreso, y detrás de ella las notas escritas que estaban detrás de ella.
 *
 * `viejas` son las filas de antes, con el orden de antes: de ahí sale detrás
 * de qué página estaba cada nota escrita. `cabezas` son las notas del impreso
 * que quedaron, en el orden del papel (una página unida a la anterior no tiene
 * la suya). Devuelve los ids en el orden final; las filas viejas del impreso
 * que no están en `cabezas` no aparecen —son páginas que ya no existen—.
 *
 * Una nota escrita cuya página ya no tiene nota propia va detrás de la que la
 * cubre. Las que estaban antes de toda página van detrás de la primera —la
 * tapa del impreso—, salvo con `antesDeLaPrimera`: en un facsímil sin
 * digitalizar la primera fila es la página 2, y antes de ella sí puede ir una
 * nota.
 */
export function ordenTrasDigitalizar(
  viejas: { id: string; orden: number; pdfPagina: number | null }[],
  cabezas: { id: string; pagina: number }[],
  { antesDeLaPrimera = false }: { antesDeLaPrimera?: boolean } = {},
): string[] {
  const ancla = new Map<string, number>();
  let ultima = 0;
  for (const v of [...viejas].sort((a, b) => a.orden - b.orden)) {
    if (v.pdfPagina !== null) ultima = v.pdfPagina;
    else ancla.set(v.id, ultima);
  }
  if (cabezas.length === 0) return [...ancla.keys()];

  const final: string[] = [];
  if (antesDeLaPrimera) {
    for (const [id, pagina] of ancla) {
      if (pagina < cabezas[0].pagina) final.push(id);
    }
  }
  for (const [k, cabeza] of cabezas.entries()) {
    final.push(cabeza.id);
    const hasta = cabezas[k + 1]?.pagina ?? Number.POSITIVE_INFINITY;
    for (const [id, pagina] of ancla) {
      if (antesDeLaPrimera && pagina < cabezas[0].pagina) continue;
      const donde = Math.max(pagina, cabezas[0].pagina);
      if (donde >= cabeza.pagina && donde < hasta) final.push(id);
    }
  }
  return final;
}
