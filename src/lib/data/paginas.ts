import type { NotaResumen } from "@/lib/types";

/** Una página del diario. El orden del array `notas` define la numeración. */
export interface PaginaEdicion {
  numero: number;
  /** El último folio que ocupa, si son varios: una nota que en el papel va en
   *  dos páginas y se unió en una (ver `NotaResumen.pdfHasta`). */
  hasta?: number;
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

/** Desde qué folio y hasta cuál ocupa una nota. Casi siempre son el mismo. */
export interface Folios {
  desde: number;
  hasta: number;
}

/**
 * Los folios de cada nota del índice, en el mismo orden.
 *
 * **Una página del impreso lleva SU número, no el de su posición.** Antes el
 * folio era la posición en la lista, y eso andaba mientras hubiera una nota por
 * página. Cuando la redacción unió una nota que el impreso tenía en las
 * páginas 4 y 5 y borró la de la 5, todo lo que venía detrás se corría un
 * lugar: la página 6 del papel pasaba a decir "Página 5", su facsímil seguía
 * diciendo 6, y a Migue "la página 6" le devolvía la 7. Ahora la nota unida
 * ocupa la 4 y la 5, y la 6 sigue siendo la 6.
 *
 * Lo que no es del impreso —las notas escritas, o un dato que no cierra—
 * sigue a continuación del último folio usado, que es lo que pasaba antes.
 */
function foliosDe(notas: NotaResumen[]): Folios[] {
  let siguiente = esDigitalizada(notas) ? 1 : 2;
  return notas.map((nota) => {
    // Un `pdfPagina` que no avanza sería un folio repetido, y el pasador ubica
    // la hoja buscando su número: con dos iguales se pierde. Mejor un número
    // corrido que una hoja sin pie.
    const desde =
      nota.pdfPagina && nota.pdfPagina >= siguiente ? nota.pdfPagina : siguiente;
    const hasta = Math.max(desde, nota.pdfHasta ?? desde);
    siguiente = hasta + 1;
    return { desde, hasta };
  });
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
 * Cómo se nombra un rango de folios.
 *
 * `corto` es el de la bandera y el sumario ("Pág. 4", "Págs. 4 y 5"); el largo
 * es el del pie ("Página 4", "Páginas 4 y 5"). Dos páginas van con "y" —es lo
 * que dice cualquiera que hojea un diario— y más de dos, con "a".
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
  // El número de cada nota lo decide `foliosDe()`, que ya sabe la regla de
  // cada clase de edición y las notas que ocupan más de una página.
  const folios = foliosDe(notas);
  const deLaNota = (i: number) => ({
    numero: folios[i].desde,
    ...(folios[i].hasta > folios[i].desde ? { hasta: folios[i].hasta } : {}),
  });

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
  return foliosDeNota(notas, slug).desde;
}

/** Los folios de una nota: el primero y el último. Para la bandera y el
 *  sumario, que dicen "Págs. 4 y 5" cuando la nota ocupa dos. */
export function foliosDeNota(notas: NotaResumen[], slug: string): Folios {
  const i = notas.findIndex((n) => n.slug === slug);
  if (i === -1) return { desde: 1, hasta: 1 };
  return foliosDe(notas)[i];
}

/**
 * Cuántas páginas tiene el número: el folio más alto.
 *
 * No es cuántas notas hay. Con una nota que ocupa dos páginas, son una menos
 * que las páginas del papel; y en una edición de notas escritas la portada es
 * la página 1 y no es una nota.
 */
export function totalDePaginas(notas: NotaResumen[]): number {
  const folios = foliosDe(notas);
  return folios.at(-1)?.hasta ?? (esDigitalizada(notas) ? 0 : 1);
}

/**
 * La nota que está en una página, por su número. `null` si ese número es la
 * portada de una edición sin digitalizar, que no es una nota, o si no existe.
 *
 * Busca por rango: en una nota que ocupa la 4 y la 5, "la página 5" es ella.
 */
export function notaEnPagina(
  notas: NotaResumen[],
  numero: number,
): NotaResumen | null {
  const folios = foliosDe(notas);
  const i = folios.findIndex((f) => f.desde <= numero && numero <= f.hasta);
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
