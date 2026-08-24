import type { Edicion, Nota } from "@/lib/types";
import { slugificarSeccion } from "@/lib/data/secciones";

/**
 * Notas para seguir leyendo después de una. Primero las de la misma sección,
 * que es lo que más se parece a lo que el lector vino a buscar; después el
 * resto de la edición en orden de tapa, para no dejar nunca el pie vacío.
 */
export function notasRelacionadas(
  edicion: Edicion,
  slug: string,
  cantidad = 3,
): Nota[] {
  const actual = edicion.notas.find((n) => n.slug === slug);
  if (!actual) return [];

  const seccion = slugificarSeccion(actual.seccion);
  const otras = edicion.notas.filter((n) => n.slug !== slug);
  const mismaSeccion = otras.filter(
    (n) => slugificarSeccion(n.seccion) === seccion,
  );
  const resto = otras.filter((n) => slugificarSeccion(n.seccion) !== seccion);

  return [...mismaSeccion, ...resto].slice(0, cantidad);
}
