import type { NotaResumen } from "@/lib/types";

export function slugificarSeccion(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export interface SeccionInfo {
  nombre: string;
  slug: string;
}

/** Secciones de la edición, en el orden en que aparecen las notas. */
export function seccionesDeEdicion(notas: NotaResumen[]): SeccionInfo[] {
  const vistas = new Map<string, SeccionInfo>();
  for (const nota of notas) {
    const slug = slugificarSeccion(nota.seccion);
    if (!vistas.has(slug)) vistas.set(slug, { nombre: nota.seccion, slug });
  }
  return [...vistas.values()];
}

export function notasPorSeccion(
  notas: NotaResumen[],
  slug: string,
): NotaResumen[] {
  return notas.filter((n) => slugificarSeccion(n.seccion) === slug);
}

export function getSeccion(
  notas: NotaResumen[],
  slug: string,
): SeccionInfo | null {
  return seccionesDeEdicion(notas).find((s) => s.slug === slug) ?? null;
}
