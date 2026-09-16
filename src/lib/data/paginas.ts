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
  if (!enLaCalle) {
    // Todas las páginas por su nota, con el número que les toca según la clase
    // de edición. `numeroDeNota()` ya sabe cuál es la regla de cada una.
    return notas.map((nota) => ({
      numero: numeroDeNota(notas, nota.slug),
      href: `/nota/${nota.slug}`,
      titulo: nota.titulo,
    }));
  }

  if (esDigitalizada(notas)) {
    return notas.map((nota, i) => ({
      numero: i + 1,
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
      numero: i + 2,
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

/*
 * Acá vivía `paginaActual(notas, pathname)`, que hacía lo mismo que
 * `posicionEnFoliado()` pero armando el foliado por su cuenta. **No la llamaba
 * nadie**, y mientras tanto el mando de paso de página comparaba direcciones a
 * mano y se perdía la segunda dirección de la tapa: entrar a la tapa por su
 * nota daba una pantalla sin flechas. La regla que ella tenía escrita ahora
 * vive en el campo `alias` de `PaginaEdicion`, que es donde se puede usar.
 */
