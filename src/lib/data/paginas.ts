import type { NotaResumen } from "@/lib/types";

/** Una página del diario: la portada y después una por nota, como en el
 *  impreso. El orden del array `notas` define la numeración. */
export interface PaginaEdicion {
  numero: number;
  href: string;
  titulo: string;
}

export function paginasDeEdicion(notas: NotaResumen[]): PaginaEdicion[] {
  return [
    { numero: 1, href: "/diario", titulo: "Portada" },
    ...notas.map((nota, i) => ({
      numero: i + 2,
      href: `/nota/${nota.slug}`,
      titulo: nota.titulo,
    })),
  ];
}

/** Página actual a partir del pathname; null si la ruta no es una página
 *  numerada (por ejemplo, el listado de una sección). */
export function paginaActual(
  notas: NotaResumen[],
  pathname: string,
): PaginaEdicion | null {
  return paginasDeEdicion(notas).find((p) => p.href === pathname) ?? null;
}
