/**
 * Borrar una nota.
 *
 * Existe por el caso que lo pidió: la digitalización lee el PDF una página por
 * vez, así que una nota que en el papel ocupa las páginas 4 y 5 sale partida
 * en dos. La redacción pasaba el texto de la 5 a la 4 en el editor, y después
 * no tenía cómo sacar la 5: el panel no borraba notas.
 *
 * **Una página del impreso no se borra igual que una nota escrita.**
 *
 * - Una nota ESCRITA se va y listo: es texto que sólo existe en la web.
 * - Una página del PDF no puede desaparecer del número, porque el papel la
 *   sigue teniendo. Lo que se borra es la nota; la página pasa a mostrarse con
 *   la nota de la página anterior, que queda cubriendo las dos ("Págs. 4 y 5",
 *   con las dos hojas en el facsímil). Así el foliado sigue siendo el del papel
 *   —la 6 sigue siendo la 6—, y los comentarios de la página que se va no se
 *   pierden: pasan a la nota que la cubre, que es donde está su texto ahora.
 *
 * Ver `NotaResumen.pdfHasta` para cómo se deduce qué cubre cada nota, y
 * `guardarDigitalizacion()` para por qué volver a digitalizar no la resucita.
 *
 * Todas las comprobaciones corren acá, del lado del servidor: lo que la
 * pantalla dibuja es una cortesía (ver `edicion-borrar.ts`, que sigue la misma
 * regla).
 */

import "server-only";

import { db } from "@/lib/db";
import { esLaUnicaServible } from "@/lib/repos/edicion-servibles";

/** Lo que hay que saber antes de borrar, y lo que el panel muestra. */
export interface EstadoParaBorrarNota {
  slug: string;
  titulo: string;
  edicionSlug: string;
  mes: string;
  /** Su edición tiene fecha cumplida: hay vecinos leyéndola. */
  publicada: boolean;
  /** Comentarios de vecinos en esta nota. */
  comentarios: number;
  /**
   * Si es una página del impreso: cuál, y qué nota la va a mostrar desde
   * ahora. Sus comentarios se mudan a esa nota.
   */
  pagina: {
    numero: number;
    /**
     * La nota que la va a cubrir, con su primera página y la última que va a
     * cubrir después del borrado. No siempre es `numero`: si esta página ya
     * cubría la siguiente, la otra pasa también.
     */
    pasaA: { slug: string; titulo: string; pagina: number; hasta: number };
    /**
     * Si la dirección de esta nota va a llevar a la que la cubre. Sólo con el
     * slug de siempre (`<edición>-p<n>`): de un slug renombrado no se puede
     * deducir de qué página era (ver `notaQueCubre` en la página de la nota).
     */
    redirige: boolean;
  } | null;
  /** Por qué no se puede borrar, ya escrito para la pantalla. null = se puede. */
  impedimento: string | null;
}

/**
 * Qué se pierde, y si se puede.
 *
 * Se consulta dos veces, igual que al borrar una edición: una para dibujar el
 * aviso y otra dentro de la acción, justo antes de borrar. Entre las dos
 * pueden haber pasado cosas —un comentario nuevo, otra persona que borró la
 * página de al lado—.
 */
export async function estadoParaBorrarNota(
  slug: string,
): Promise<EstadoParaBorrarNota | null> {
  const nota = await db().nota.findUnique({
    where: { slug },
    select: {
      slug: true,
      titulo: true,
      pdfPagina: true,
      edicionId: true,
      _count: { select: { comentarios: true } },
      edicion: {
        select: {
          slug: true,
          mes: true,
          publicaEn: true,
          pdfUrl: true,
          pdfPaginas: true,
        },
      },
    },
  });
  if (!nota) return null;

  const publicada =
    nota.edicion.publicaEn !== null &&
    nota.edicion.publicaEn.getTime() <= Date.now();

  const base = {
    slug: nota.slug,
    titulo: nota.titulo,
    edicionSlug: nota.edicion.slug,
    mes: nota.edicion.mes,
    publicada,
    comentarios: nota._count.comentarios,
  };

  // Una nota escrita: lo único que la puede trabar es dejar al diario sin
  // número. Pasa si es lo último que le queda a la única edición servible.
  //
  // Una fila con página pero en una edición sin PDF también se trata como
  // escrita: no hay impreso que la respalde ni página que cubrir. No debería
  // existir —quitar el PDF borra sus páginas y una página no se puede mudar de
  // edición—, pero si existe, tiene que poder irse.
  if (nota.pdfPagina === null || !nota.edicion.pdfUrl) {
    const [resto, unica] = await Promise.all([
      db().nota.count({
        where: { edicionId: nota.edicionId, slug: { not: nota.slug } },
      }),
      esLaUnicaServible(nota.edicion.slug),
    ]);
    const dejaSinNumero = resto === 0 && !nota.edicion.pdfUrl && unica;
    return {
      ...base,
      pagina: null,
      impedimento: dejaSinNumero
        ? `Es la única nota de "${nota.edicion.mes}", y es la única edición ` +
          "que el diario puede servir: sin ella el sitio se queda sin ningún " +
          "número que mostrar. Publicá otra edición y después borrala."
        : null,
    };
  }

  /*
   * Una página del impreso.
   *
   * La tapa no se borra: es la fila que dice que el número está digitalizado
   * (ver `esDigitalizada` en `paginas.ts`). Sin ella la edición entera pasaría
   * a dibujarse como facsímil, con la portada aparte y todo el foliado corrido.
   */
  if (nota.pdfPagina === 1) {
    return {
      ...base,
      pagina: null,
      impedimento:
        "Es la tapa del impreso y no se puede borrar: sin ella todo el número " +
        "deja de estar digitalizado. Si algo de la tapa sobra, corregilo en el " +
        "editor.",
    };
  }

  const [tapa, anterior, siguiente] = await Promise.all([
    db().nota.findFirst({
      where: { edicionId: nota.edicionId, pdfPagina: 1 },
      select: { slug: true },
    }),
    // La que la va a cubrir: la página del impreso más cercana para atrás.
    db().nota.findFirst({
      where: { edicionId: nota.edicionId, pdfPagina: { lt: nota.pdfPagina } },
      orderBy: { pdfPagina: "desc" },
      select: { slug: true, titulo: true, pdfPagina: true },
    }),
    // Y la próxima, que es donde termina lo que va a cubrir: la misma regla
    // que `hastaDelImpreso()` en `paginas.ts`.
    db().nota.findFirst({
      where: { edicionId: nota.edicionId, pdfPagina: { gt: nota.pdfPagina } },
      orderBy: { pdfPagina: "asc" },
      select: { pdfPagina: true },
    }),
  ]);

  // Un facsímil sin digitalizar: sus páginas no tienen texto, son el dibujo del
  // PDF. Una página de más ahí no es un duplicado que se unió a mano, y si el
  // archivo está mal, lo que se cambia es el archivo.
  if (!tapa) {
    return {
      ...base,
      pagina: null,
      impedimento:
        "Es una página del PDF sin digitalizar: se dibuja tal cual el archivo. " +
        "Para sacar páginas, reemplazá el PDF en Ediciones.",
    };
  }

  // Con la tapa en su lugar siempre hay una anterior; esto sólo cubre datos
  // que no cierran.
  if (!anterior || anterior.pdfPagina === null) {
    return {
      ...base,
      pagina: null,
      impedimento:
        "No hay ninguna página antes de esta que la pueda mostrar, así que " +
        "borrarla la dejaría fuera del número.",
    };
  }

  const hasta = Math.max(
    nota.pdfPagina,
    siguiente?.pdfPagina != null
      ? siguiente.pdfPagina - 1
      : (nota.edicion.pdfPaginas ?? nota.pdfPagina),
  );

  return {
    ...base,
    pagina: {
      numero: nota.pdfPagina,
      pasaA: {
        slug: anterior.slug,
        titulo: anterior.titulo,
        pagina: anterior.pdfPagina,
        hasta,
      },
      redirige: nota.slug === `${nota.edicion.slug}-p${nota.pdfPagina}`,
    },
    impedimento: null,
  };
}

/**
 * Borra la nota. Devuelve qué pasó, para que el panel lo diga.
 *
 * `confirmacion` tiene que ser el slug tipeado a mano **sólo si se pierden
 * comentarios de vecinos**: una nota escrita con comentarios. Una página del
 * impreso no pierde ninguno —se mudan— y una nota sin comentarios no pierde
 * nada de nadie más que de la redacción, que es quien aprieta. Es la misma
 * proporción que `borrarEdicion()`: ceremonia cuando hay algo de un tercero en
 * juego, y no para tirar un duplicado.
 */
export async function borrarNota(
  slug: string,
  confirmacion?: string,
): Promise<EstadoParaBorrarNota & { comentariosMudados: number }> {
  const estado = await estadoParaBorrarNota(slug);
  if (!estado) throw new Error(`No existe la nota "${slug}".`);
  if (estado.impedimento) throw new Error(estado.impedimento);

  const pierdeComentarios = estado.pagina === null && estado.comentarios > 0;
  if (pierdeComentarios && confirmacion !== estado.slug) {
    throw new Error(
      `«${estado.titulo}» tiene ${estado.comentarios} ` +
        `${estado.comentarios === 1 ? "comentario" : "comentarios"} de vecinos ` +
        `que se borran con ella. Para borrarla hay que escribir su slug ` +
        `(${estado.slug}) tal cual.`,
    );
  }

  const pasaA = estado.pagina?.pasaA.slug;
  let comentariosMudados: number;
  try {
    comentariosMudados = await db().$transaction(
      async (tx) => {
        /*
         * Lo que se decidió afuera se vuelve a mirar adentro.
         *
         * Dos personas borrando a la vez la 4 y la 5 era el caso malo: la de
         * la 5 mudaba sus comentarios a la 4 mientras la otra borraba la 4, y
         * la cascada se los llevaba sin que nadie lo hubiera confirmado.
         * `Serializable` hace que una de las dos falle en vez de pisarse, y
         * esto cubre lo que haya cambiado entre la pantalla y el click.
         */
        if (estado.pagina) {
          const cubre = await tx.nota.findFirst({
            where: {
              edicion: { slug: estado.edicionSlug },
              pdfPagina: { lt: estado.pagina.numero },
            },
            orderBy: { pdfPagina: "desc" },
            select: { slug: true },
          });
          if (cubre?.slug !== pasaA) throw new Error(CAMBIO_MIENTRAS_TANTO);
        } else {
          const ahora = await tx.comentario.count({ where: { notaSlug: slug } });
          if (ahora > 0 && confirmacion !== estado.slug) {
            throw new Error(CAMBIO_MIENTRAS_TANTO);
          }
          /*
           * Que no deje al diario sin número, mirado ADENTRO.
           *
           * Dos personas borrando a la vez las dos últimas notas veían, cada
           * una, que quedaba la otra. Leer acá —por la transacción, también
           * las ediciones servibles— es lo que hace que `Serializable` frene a
           * una. Sólo si la edición no tiene PDF, que es el único caso en que
           * quedarse sin notas la deja vacía: leer de más haría chocar borrados
           * que no se afectan. De a una: es la conexión de la transacción.
           */
          const edicion = await tx.edicion.findUnique({
            where: { slug: estado.edicionSlug },
            select: { pdfUrl: true },
          });
          if (!edicion?.pdfUrl) {
            const resto = await tx.nota.count({
              where: { edicion: { slug: estado.edicionSlug }, slug: { not: slug } },
            });
            if (resto === 0 && (await esLaUnicaServible(estado.edicionSlug, tx))) {
              throw new Error(CAMBIO_MIENTRAS_TANTO);
            }
          }
        }

        // Primero se mudan los comentarios, en la misma transacción: si el
        // borrado fallara, no pueden quedar repartidos entre las dos notas.
        const { count } = pasaA
          ? await tx.comentario.updateMany({
              where: { notaSlug: slug },
              data: { notaSlug: pasaA },
            })
          : { count: 0 };
        // Por slug, que es único: lo que quede colgando (comentarios de una
        // nota escrita, sus votos) se va por la cascada del esquema.
        await tx.nota.delete({ where: { slug } });
        return count;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (e) {
    // P2034: Postgres no pudo ordenar esta transacción con otra que tocaba
    // las mismas filas. No se escribió nada.
    if ((e as { code?: string })?.code === "P2034") {
      throw new Error(CAMBIO_MIENTRAS_TANTO);
    }
    throw e;
  }

  return { ...estado, comentariosMudados };
}

const CAMBIO_MIENTRAS_TANTO =
  "Mientras tanto alguien cambió esta nota o las páginas de al lado, y no se " +
  "borró nada. Recargá la pantalla para ver cómo quedaron y volvé a intentar.";
