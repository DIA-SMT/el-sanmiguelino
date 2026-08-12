import type { Edicion } from "@/lib/types";

/** Una página del diario: la portada y después una por nota, como en el
 *  impreso. El orden del array `notas` define la numeración. */
export interface PaginaEdicion {
  numero: number;
  href: string;
  titulo: string;
}

export function paginasDeEdicion(edicion: Edicion): PaginaEdicion[] {
  return [
    { numero: 1, href: "/diario", titulo: "Portada" },
    ...edicion.notas.map((nota, i) => ({
      numero: i + 2,
      href: `/nota/${nota.slug}`,
      titulo: nota.titulo,
    })),
  ];
}

/** Página actual a partir del pathname; null si la ruta no es una página
 *  numerada (por ejemplo, el listado de una sección). */
export function paginaActual(
  edicion: Edicion,
  pathname: string,
): PaginaEdicion | null {
  return paginasDeEdicion(edicion).find((p) => p.href === pathname) ?? null;
}
