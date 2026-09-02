/**
 * El facsímil: cargar y quitar el PDF de un número.
 *
 * Una edición se publica de una de dos formas, nunca de las dos: con **notas
 * escritas** —agosto, septiembre— o con el **PDF del impreso**, donde cada
 * página del archivo es una hoja del diario. Las dos conviven en la base y el
 * lector no elige: el diario mira `Edicion.pdfUrl` y sirve lo que corresponda.
 *
 * Lo que hace este módulo es traducir "este número son N páginas" a filas de
 * `notas`, que es lo que el diario ya sabe paginar, foliar y comentar. El
 * porqué de esa decisión está escrito en `Nota.pdfPagina`, en el esquema.
 *
 * **Las páginas empiezan en la 2.** La 1 es la tapa y se sirve en `/diario`,
 * como siempre. Así el foliado no cambia: la nota k-ésima de una edición sigue
 * siendo su página k+1.
 */

import "server-only";

import { db } from "@/lib/db";

/** Lo que puede tener un PDF de diario. Un número de más acá casi seguro es un
 *  error de conteo, y cada página cuesta una fila y un slug. */
const MAXIMO_PAGINAS = 200;

/** El slug de la página N de una edición. Sale del slug de la edición, que ya
 *  está validado contra `SLUG_VALIDO` cuando se la crea, así que esto también
 *  es un slug válido: es la clave de la que cuelgan los comentarios. */
function slugDePagina(edicionSlug: string, pagina: number): string {
  return `${edicionSlug}-p${pagina}`;
}

/**
 * Deja la edición publicada como facsímil de `paginas` páginas.
 *
 * Es idempotente: volver a llamarla con el mismo número de páginas reescribe lo
 * mismo. Reemplazar el PDF por uno **más corto** borra las páginas sobrantes, y
 * con ellas sus comentarios — el llamador tiene que avisarlo antes, porque acá
 * ya es tarde.
 *
 * Devuelve cuántas páginas quedaron y cuántas se borraron, para que el panel
 * pueda decir qué pasó en vez de un "listo".
 */
export async function guardarPdfDeEdicion(
  edicionSlug: string,
  url: string,
  paginas: number,
): Promise<{ paginas: number; borradas: number }> {
  if (!Number.isInteger(paginas) || paginas < 1 || paginas > MAXIMO_PAGINAS) {
    throw new Error(
      `El PDF dice tener ${paginas} páginas, y eso no es un diario. ` +
        `El máximo son ${MAXIMO_PAGINAS}.`,
    );
  }

  const edicion = await db().edicion.findUnique({
    where: { slug: edicionSlug },
    select: { id: true, mes: true },
  });
  if (!edicion) throw new Error(`No existe la edición "${edicionSlug}".`);

  /*
   * Una edición es de notas escritas o es un facsímil, nunca las dos cosas.
   *
   * Mezclarlas no rompe nada visible de entrada y por eso hay que atajarlo acá:
   * las notas escritas quedarían intercaladas entre las páginas del PDF, con el
   * foliado corrido, y el número saldría con la página 4 del impreso numerada 7.
   */
  const escritas = await db().nota.count({
    where: { edicionId: edicion.id, pdfPagina: null },
  });
  if (escritas > 0) {
    throw new Error(
      `Esta edición ya tiene ${escritas} ${escritas === 1 ? "nota escrita" : "notas escritas"}. ` +
        "Una edición se publica con notas o con el PDF del impreso, no con las " +
        "dos cosas: borrá las notas o cargá el PDF en otra edición.",
    );
  }

  /*
   * Que ningún slug de página esté ocupado por una nota de OTRA edición.
   *
   * El slug es único en toda la base, así que `septiembre-2026-p3` podría ser
   * una nota escrita de cualquier otro número. Sin esta comprobación el upsert
   * de abajo se la llevaría puesta: le cambiaría la edición, el título y el
   * cuerpo, y sus comentarios lo seguirían.
   */
  const slugs = Array.from({ length: Math.max(paginas - 1, 0) }, (_, i) =>
    slugDePagina(edicionSlug, i + 2),
  );
  const ajenas = await db().nota.findMany({
    where: { slug: { in: slugs }, edicionId: { not: edicion.id } },
    select: { slug: true, titulo: true },
  });
  if (ajenas.length > 0) {
    throw new Error(
      `El slug "${ajenas[0].slug}" ya lo usa la nota «${ajenas[0].titulo}» de ` +
        "otra edición. Cambiale el slug a esa nota, o el slug a esta edición.",
    );
  }

  return db().$transaction(async (tx) => {
    // Primero las que sobran: un PDF más corto que el anterior deja páginas
    // colgadas que ya no existen en el archivo nuevo.
    const { count: borradas } = await tx.nota.deleteMany({
      where: { edicionId: edicion.id, pdfPagina: { gt: paginas } },
    });

    for (let pagina = 2; pagina <= paginas; pagina++) {
      const campos = {
        seccion: "Edición impresa",
        titulo: `Página ${pagina}`,
        bajada: `Página ${pagina} de ${edicion.mes}, tal como salió impresa.`,
        // Sin cuerpo y sin texto plano: de un facsímil no se extrae texto. Es
        // lo que hace que el buscador nunca devuelva estas filas, que es lo
        // correcto — no hay nada que resaltar en un resultado.
        cuerpo: [],
        textoPlano: "",
        minutosLectura: 0,
        pdfPagina: pagina,
        // `orden` es el foliado y `pdfPagina` es qué se dibuja. Se escriben
        // juntos acá, que es el único lugar que los crea; ver `Nota.pdfPagina`.
        orden: pagina - 2,
        edicionId: edicion.id,
      };
      await tx.nota.upsert({
        where: { slug: slugDePagina(edicionSlug, pagina) },
        update: campos,
        create: { slug: slugDePagina(edicionSlug, pagina), ...campos },
      });
    }

    await tx.edicion.update({
      where: { id: edicion.id },
      data: { pdfUrl: url, pdfPaginas: paginas },
    });

    return { paginas, borradas };
  });
}

/**
 * Saca el facsímil: la edición vuelve a ser un número sin contenido.
 *
 * Borra las páginas —y sus comentarios, por la cascada— porque sin PDF no hay
 * nada que dibujar en ellas: quedarían como páginas en blanco con foliado.
 *
 * El objeto del bucket **no se borra**. Es barato, y un lector con la página
 * abierta o una caché intermedia lo puede estar pidiendo todavía; borrarlo le
 * daría un error en lugar de una página vieja.
 */
export async function quitarPdfDeEdicion(
  edicionSlug: string,
): Promise<{ borradas: number }> {
  const edicion = await db().edicion.findUnique({
    where: { slug: edicionSlug },
    select: { id: true },
  });
  if (!edicion) throw new Error(`No existe la edición "${edicionSlug}".`);

  return db().$transaction(async (tx) => {
    const { count: borradas } = await tx.nota.deleteMany({
      where: { edicionId: edicion.id, pdfPagina: { not: null } },
    });
    await tx.edicion.update({
      where: { id: edicion.id },
      data: { pdfUrl: null, pdfPaginas: null },
    });
    return { borradas };
  });
}
