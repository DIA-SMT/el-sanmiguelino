import type { NotaResumen } from "@/lib/types";

/** Una página del diario. El orden del array `notas` define la numeración. */
export interface PaginaEdicion {
  numero: number;
  href: string;
  titulo: string;
  /**
   * La otra dirección de esta misma página, si tiene dos.
   *
   * Sólo la tapa de un número digitalizado: se sirve en `/diario`, que es la
   * portada, y también vive en su propia `/nota/…`, que es a donde llevan el
   * titular de la tapa y el "Pág. 1" del sumario, y donde se la puede comentar.
   *
   * Existe porque el mando de paso de página ubica la pantalla comparando
   * direcciones: sin esto, entrar a la tapa por su nota daba una pantalla del
   * diario SIN flechas, sin teclado y sin gesto. `href` sigue siendo la
   * canónica —es a donde apunta la flecha de "anterior" desde la página 2—.
   */
  alias?: string;
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

/** Un rango de páginas del IMPRESO: las hojas del facsímil que muestra una
 *  nota. Casi siempre es una sola. */
export interface Folios {
  desde: number;
  hasta: number;
}

/**
 * El número de cada nota: su posición en el número, como la lee el lector.
 *
 * **Por posición en la web, no por página del papel.** Lo decidió la redacción
 * el 2026-10-21. Una página del impreso puede traer varias notas, que se
 * separan a mano y se ubican al lado de la suya; y dos páginas pueden ser una
 * sola nota, que se une. Con el número del papel, eso dejaba dos notas con el
 * mismo número o una nota con dos ("Págs. 4 y 5"). En la web cada nota es una
 * página y se cuenta como tal; el número del papel queda donde es el papel: en
 * el facsímil ("Verla como salió impresa").
 *
 * En un número digitalizado la tapa es la 1. En uno de notas escritas, o en un
 * facsímil sin digitalizar, la 1 es la portada y la primera nota es la 2.
 */
function numerosDe(notas: NotaResumen[]): number[] {
  const base = esDigitalizada(notas) ? 1 : 2;
  return notas.map((_, i) => base + i);
}

/**
 * Hasta qué página del impreso llega cada fila del PDF, para el índice.
 *
 * Una fila cubre desde su `pdfPagina` hasta la anterior a la de la próxima fila
 * del PDF; la última, hasta el final del archivo. Mientras haya una fila por
 * página, cada una cubre sólo la suya; si a una página le borraron la nota, la
 * de antes la cubre. No hace falta una columna para recordarlo: el hueco ES el
 * dato, y una columna aparte podría decir otra cosa que el hueco.
 *
 * Lo llama el repo al armar el índice, que es el único que sabe cuántas
 * páginas tiene el PDF. `filas` en el orden del índice.
 */
export function hastaDelImpreso<
  T extends { pdfPagina?: number | null },
>(filas: T[], pdfPaginas: number | null | undefined): (T & { pdfHasta?: number })[] {
  const conPagina = filas
    .map((f) => f.pdfPagina)
    .filter((p): p is number => typeof p === "number");
  return filas.map((fila) => {
    const desde = fila.pdfPagina;
    if (typeof desde !== "number") return fila;
    const proxima = conPagina.filter((p) => p > desde).sort((a, b) => a - b)[0];
    const hasta = proxima !== undefined ? proxima - 1 : (pdfPaginas ?? desde);
    return hasta > desde ? { ...fila, pdfHasta: hasta } : fila;
  });
}

/**
 * Cómo se nombran unas páginas del impreso: "Página 4", "Páginas 4 y 5".
 *
 * Es el rótulo del facsímil. Dos páginas van con "y" —es lo que dice
 * cualquiera que hojea un diario— y más de dos, con "a".
 */
export function rotuloDeFolios(
  { desde, hasta }: Folios,
  { corto = false }: { corto?: boolean } = {},
): string {
  const una = corto ? "Pág." : "Página";
  const varias = corto ? "Págs." : "Páginas";
  if (hasta <= desde) return `${una} ${desde}`;
  return `${varias} ${desde} ${hasta === desde + 1 ? "y" : "a"} ${hasta}`;
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
export function paginasDeEdicion(
  notas: NotaResumen[],
  /**
   * ¿Es el número que el diario está sirviendo?
   *
   * Sólo entonces existe `/diario`, que es la portada. **En el archivo no hay
   * portada**: la tapa se lee en su propia nota y la puerta al número es su
   * sumario. Pasarle `false` a un número viejo es lo que permite recorrerlo
   * con las flechas igual que al del mes, que antes no se podía: el foliado
   * era siempre el de la calle, ninguna nota del archivo figuraba en él y el
   * mando se apagaba entero.
   */
  { enLaCalle = true }: { enLaCalle?: boolean } = {},
): PaginaEdicion[] {
  // El número de cada nota lo decide `numerosDe()`, que ya sabe la regla de
  // cada clase de edición.
  const numeros = numerosDe(notas);
  const deLaNota = (i: number) => ({ numero: numeros[i] });

  if (!enLaCalle) {
    // Todas las páginas por su nota.
    return notas.map((nota, i) => ({
      ...deLaNota(i),
      href: `/nota/${nota.slug}`,
      titulo: nota.titulo,
    }));
  }

  if (esDigitalizada(notas)) {
    return notas.map((nota, i) => ({
      ...deLaNota(i),
      // La tapa se sirve en `/diario`, que es la portada del diario y la
      // página 1 del impreso al mismo tiempo. Y además vive en su nota: por
      // eso lleva `alias`, o ahí no habría con qué pasar de página.
      href: i === 0 ? "/diario" : `/nota/${nota.slug}`,
      ...(i === 0 ? { alias: `/nota/${nota.slug}` } : {}),
      titulo: nota.titulo,
    }));
  }

  return [
    { numero: 1, href: "/diario", titulo: "Portada" },
    ...notas.map((nota, i) => ({
      ...deLaNota(i),
      href: `/nota/${nota.slug}`,
      titulo: nota.titulo,
    })),
  ];
}

/**
 * En qué posición del foliado cae una dirección. `-1` si no es de este número.
 *
 * Mira las DOS direcciones de una página, que es lo que distingue a la tapa.
 */
export function posicionEnFoliado(
  paginas: PaginaEdicion[],
  pathname: string,
): number {
  return paginas.findIndex(
    (p) => p.href === pathname || p.alias === pathname,
  );
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
  return i === -1 ? 1 : numerosDe(notas)[i];
}

/**
 * Cuántas páginas tiene el número.
 *
 * No siempre es cuántas notas hay: en una edición de notas escritas la portada
 * es la página 1 y no es una nota.
 */
export function totalDePaginas(notas: NotaResumen[]): number {
  return notas.length + (esDigitalizada(notas) ? 0 : 1);
}

/**
 * La nota que está en una página, por su número. `null` si ese número es la
 * portada de una edición sin digitalizar, que no es una nota, o si no existe.
 */
export function notaEnPagina(
  notas: NotaResumen[],
  numero: number,
): NotaResumen | null {
  const i = numerosDe(notas).indexOf(numero);
  return i === -1 ? null : notas[i];
}

/*
 * Acá vivía `paginaActual(notas, pathname)`, que hacía lo mismo que
 * `posicionEnFoliado()` pero armando el foliado por su cuenta. **No la llamaba
 * nadie**, y mientras tanto el mando de paso de página comparaba direcciones a
 * mano y se perdía la segunda dirección de la tapa: entrar a la tapa por su
 * nota daba una pantalla sin flechas. La regla que ella tenía escrita ahora
 * vive en el campo `alias` de `PaginaEdicion`, que es donde se puede usar.
 */
