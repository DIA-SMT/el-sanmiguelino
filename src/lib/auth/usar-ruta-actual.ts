"use client";

import { usePathname, useSearchParams } from "next/navigation";

/**
 * La página donde está el lector, con su query: a dónde vuelve después de
 * ingresar. Es una sola función para todos los "Ingresar" —la cabecera, Migue,
 * el formulario de papel— porque cada uno armándola por su cuenta terminaba
 * distinto: dos de los tres perdían el `?q=` y volvían a un buscador vacío.
 *
 * `useSearchParams` no necesita un Suspense propio acá: lo usan componentes que
 * viven en páginas que ya son dinámicas (leen la cookie de sesión).
 */
export function useRutaActual(): string {
  const ruta = usePathname();
  const query = useSearchParams().toString();
  return query ? `${ruta}?${query}` : ruta;
}
