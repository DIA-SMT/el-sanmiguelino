import type { NotaResumen } from "@/lib/types";

/** Una página del diario. El orden del array `notas` define la numeración. */
export interface PaginaEdicion {
  numero: number;
  href: string;
  titulo: string;
}

/**
 * ¿Este número está digitalizado?
 *
 * Se pregunta por la página 1 del impreso porque es el signo estructural: al
 * digitalizar, la tapa del papel pasa a ser una fila de `notas` —es un
 * artículo, con su titular y su bajada— mientras que un facsímil sin
 * digitalizar la deja fuera del índice y la dibuja en `/diario`. Ver
 * `Nota.pdfPagina` en el esquema.
 */
function esDigitalizada(notas: NotaResumen[]): boolean {
  return notas[0]?.pdfPagina === 1;
}

/**
 * El foliado del diario.
 *
 * **En un número digitalizado, la portada NO es una página aparte: es la
 * página 1.** Y eso arregla dos cosas que estaban mal a la vez.
 *
 * La primera es que los números no coincidían. El pie de una hoja decía
 * "Página 4 de 9" mientras el facsímil de esa misma hoja decía "Página 3",
 * porque la portada se contaba de más y corría todo el foliado un lugar. El
 * lector veía dos numeraciones distintas del mismo diario, y no había forma de
 * saber a cuál se refería alguien que pedía "la página 3" — ni para una
 * persona ni para Migue.
 *
 * La segunda es que la página 2 era un duplicado. La portada de un número
 * digitalizado muestra el artículo de tapa ENTERO, así que pasar de página
 * llevaba a leer exactamente lo mismo otra vez.
 *
 * En una edición de notas escritas nada de esto aplica y el foliado sigue como
 * siempre: la portada es la página 1 y la primera nota es la 2. Ahí la tapa es
 * una vidriera —muestra la nota principal para que se entre a leerla— y no la
 * nota misma.
 */
export function paginasDeEdicion(notas: NotaResumen[]): PaginaEdicion[] {
  if (esDigitalizada(notas)) {
    return notas.map((nota, i) => ({
      numero: i + 1,
      // La tapa se sirve en `/diario`, que es la portada del diario y la
      // página 1 del impreso al mismo tiempo.
      href: i === 0 ? "/diario" : `/nota/${nota.slug}`,
      titulo: nota.titulo,
    }));
  }

  return [
    { numero: 1, href: "/diario", titulo: "Portada" },
    ...notas.map((nota, i) => ({
      numero: i + 2,
      href: `/nota/${nota.slug}`,
      titulo: nota.titulo,
    })),
  ];
}

/**
 * Qué número de página le toca a una nota.
 *
 * Vive acá y no en cada pantalla porque la regla cambió y hay tres lugares que
 * tienen que contestar lo mismo: el pasador al pie, el mando de paso de página
 * y lo que Migue entiende cuando alguien le nombra un número.
 */
export function numeroDeNota(notas: NotaResumen[], slug: string): number {
  const i = notas.findIndex((n) => n.slug === slug);
  if (i === -1) return 1;
  return esDigitalizada(notas) ? i + 1 : i + 2;
}

/**
 * La nota que está en una página, por su número. `null` si ese número es la
 * portada de una edición sin digitalizar, que no es una nota, o si no existe.
 */
export function notaEnPagina(
  notas: NotaResumen[],
  numero: number,
): NotaResumen | null {
  const i = esDigitalizada(notas) ? numero - 1 : numero - 2;
  return notas[i] ?? null;
}

/** Página actual a partir del pathname; null si la ruta no es una página
 *  numerada (por ejemplo, el listado de una sección). */
export function paginaActual(
  notas: NotaResumen[],
  pathname: string,
): PaginaEdicion | null {
  const paginas = paginasDeEdicion(notas);
  const directa = paginas.find((p) => p.href === pathname);
  if (directa) return directa;

  /*
   * La tapa de un número digitalizado tiene DOS direcciones: `/diario`, que es
   * la portada, y su propia `/nota/…`, a la que se llega desde el titular de la
   * portada y que es donde se puede comentar. Las dos son la página 1, y sin
   * esto la segunda se quedaba sin número al pie.
   */
  if (esDigitalizada(notas) && notas[0] && pathname === `/nota/${notas[0].slug}`) {
    return paginas[0] ?? null;
  }
  return null;
}
