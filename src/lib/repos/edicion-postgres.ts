import { cache } from "react";
import type { EdicionRepo } from "@/lib/repos/edicion";
import { db } from "@/lib/db";
import { edicionEnFoco } from "@/lib/auth/vista-previa";
import { minutosDeLectura, textoPlanoDe } from "@/lib/derivar";
import type {
  BloqueNota,
  NotaBorrador,
  EdicionResumen,
  ImagenNota,
  NotaBuscable,
  NotaCompleta,
  NotaResumen,
} from "@/lib/types";

/**
 * Motor Postgres. Implementa el mismo contrato que `edicionMockRepo`, y la
 * prueba de que la traducción es fiel es que el comportamiento observable del
 * sitio no cambie al pasar de uno al otro.
 *
 * Las consultas están escritas contra lo que cada pantalla necesita, no contra
 * lo que sería cómodo: `indice()` **no trae el cuerpo**. Ese era el punto de
 * haber partido las formas en la etapa 3 —contra el mock daba lo mismo, acá son
 * ocho documentos JSON por request para dibujar una lista de títulos—.
 */

/** Las columnas de un resumen. Se nombran explícitas y no con un `select *`
 *  para que `cuerpo` no se cuele por descuido en un listado. */
/**
 * De qué ediciones se puede leer una nota.
 *
 * La regla es **"su edición está publicada"**, no "es la edición que se está
 * sirviendo". La diferencia es el archivo entero: una nota de agosto sigue
 * siendo leíble cuando el diario ya va por septiembre, y una de septiembre no
 * se abre antes del 1 aunque alguien tenga la dirección.
 *
 * Un administrador con una edición en foco suma esa, publicada o no: es lo que
 * le permite revisar la edición que está armando.
 */
function edicionesLegibles(enFoco: string | null) {
  return {
    OR: [
      { publicaEn: { not: null, lte: new Date() } },
      ...(enFoco ? [{ slug: enFoco }] : []),
    ],
  };
}

const CAMPOS_RESUMEN = {
  slug: true,
  seccion: true,
  titulo: true,
  bajada: true,
  minutosLectura: true,
  imagenSrc: true,
  imagenAlt: true,
  imagenEpigrafe: true,
} as const;

interface FilaResumen {
  slug: string;
  seccion: string;
  titulo: string;
  bajada: string;
  minutosLectura: number;
  imagenSrc: string | null;
  imagenAlt: string | null;
  imagenEpigrafe: string | null;
}

/**
 * Reconstruye `ImagenNota` desde las tres columnas aplanadas.
 *
 * Devuelve `undefined` —y no un objeto con campos vacíos— cuando no hay foto:
 * las pantallas preguntan `nota.imagen &&` para decidir si dibujan la figura, y
 * un objeto con `alt: ""` pasaría esa guarda y renderizaría una figura vacía
 * con un epígrafe en blanco.
 *
 * El disparador es `alt`, no `src`: una nota puede tener el texto alternativo y
 * el epígrafe cargados y todavía no tener el archivo subido, y en ese caso el
 * diario dibuja su marcador de posición editorial. Sin `alt` no hay imagen
 * accesible que mostrar.
 */
function aImagen(fila: FilaResumen): ImagenNota | undefined {
  if (fila.imagenAlt === null) return undefined;
  return {
    alt: fila.imagenAlt,
    epigrafe: fila.imagenEpigrafe ?? "",
    src: fila.imagenSrc ?? undefined,
  };
}

function aResumen(fila: FilaResumen): NotaResumen {
  return {
    slug: fila.slug,
    seccion: fila.seccion,
    titulo: fila.titulo,
    bajada: fila.bajada,
    imagen: aImagen(fila),
    minutosLectura: fila.minutosLectura,
  };
}

/**
 * El cuerpo vuelve de una columna `Json`, así que Prisma lo tipa como
 * `JsonValue` y hay que afirmarlo. La afirmación es honesta porque el único
 * camino de escritura es `guardarNota()`, que recibe `BloqueNota[]` tipado.
 *
 * No se valida bloque por bloque al leer a propósito: sería recorrer ocho
 * cuerpos en cada request para protegerse de datos que sólo puede haber puesto
 * nuestro propio código. Si algún día se cargan cuerpos desde afuera, la
 * validación va en la escritura, que pasa una vez.
 */
function aCuerpo(valor: unknown): BloqueNota[] {
  return (valor ?? []) as BloqueNota[];
}

/**
 * La edición que hay que servir.
 *
 * **Se calcula, no se marca**: es la más reciente cuya fecha de publicación ya
 * pasó. No hay nada que correr el día 1, ni bandera que dar vuelta, ni estado
 * que pueda quedar trabado. Si el sitio está en pie, sirve la edición correcta.
 *
 * Las que tienen fecha futura no salen, y las que no tienen fecha no salen
 * nunca: eso es lo que permite preparar septiembre con tres días de
 * anticipación sin que se filtre.
 *
 * Un administrador puede poner otra "en foco" y ver el diario entero con ella
 * —ver `vista-previa.ts`—. Para el lector no cambia nada.
 */
const edicionActualFila = cache(async () => {
  const enFoco = await edicionEnFoco();
  if (enFoco) {
    const elegida = await db().edicion.findUnique({ where: { slug: enFoco } });
    // Si el slug de la cookie no existe (la edición se borró, o la cookie
    // quedó vieja) se cae a la publicada en vez de romper: una cookie
    // desactualizada no puede dejar al admin sin diario.
    if (elegida) return elegida;
  }

  const edicion = await db().edicion.findFirst({
    where: {
      publicaEn: { not: null, lte: new Date() },
      // Con al menos una nota. Si llega el día 1 y septiembre está vacío
      // —se programó y no se alcanzó a cargar—, el diario sigue mostrando
      // agosto en vez de una tapa en blanco. Ningún diario saca un número
      // vacío porque se le venció la fecha.
      //
      // No esconde el error: el panel sigue marcando "En la calle" sobre
      // agosto, que es donde el error tiene que verse.
      notas: { some: {} },
    },
    orderBy: { publicaEn: "desc" },
  });
  if (!edicion) {
    throw new Error(
      "No hay ninguna edición publicada: ninguna tiene fecha de publicación " +
        "en el pasado. Correr `npm run db:seed`, o darle fecha a una desde " +
        "el panel.",
    );
  }
  return edicion;
});

export const edicionPostgresRepo: EdicionRepo = {
  async resumen(): Promise<EdicionResumen> {
    const { slug, mes, numero, anio, etiqueta } = await edicionActualFila();
    return { slug, mes, numero, anio, etiqueta: etiqueta ?? undefined };
  },

  async indice(): Promise<NotaResumen[]> {
    const edicion = await edicionActualFila();
    const filas = await db().nota.findMany({
      where: { edicionId: edicion.id },
      orderBy: { orden: "asc" },
      select: CAMPOS_RESUMEN,
    });
    return filas.map(aResumen);
  },

  /**
   * Una nota **de la edición que se está sirviendo**.
   *
   * El filtro por edición no es prolijidad: sin él, una nota de la edición de
   * septiembre se podía leer entrando a su dirección antes del 1, y todo el
   * sentido de preparar la edición con anticipación era que no se filtrara. El
   * índice sí filtraba, así que la nota no aparecía en ningún lado —pero
   * estaba, y una dirección adivinable o compartida por error alcanzaba.
   *
   * Para un administrador con una edición en foco, `edicionActualFila()`
   * devuelve esa, así que ve sus notas. Es la misma consulta.
   */
  async nota(slug: string): Promise<NotaCompleta | null> {
    const fila = await db().nota.findFirst({
      where: { slug, edicion: edicionesLegibles(await edicionEnFoco()) },
      select: {
        ...CAMPOS_RESUMEN,
        cuerpo: true,
        edicion: { select: { slug: true } },
      },
    });
    if (!fila) return null;
    return {
      ...aResumen(fila),
      cuerpo: aCuerpo(fila.cuerpo),
      edicionSlug: fila.edicion.slug,
    };
  },

  async completas(slugs: string[]): Promise<NotaCompleta[]> {
    if (slugs.length === 0) return [];
    const filas = await db().nota.findMany({
      where: {
        slug: { in: slugs },
        edicion: edicionesLegibles(await edicionEnFoco()),
      },
      select: {
        ...CAMPOS_RESUMEN,
        cuerpo: true,
        edicion: { select: { slug: true } },
      },
    });
    // Se respeta el orden PEDIDO, no el que devuelve la base: quien pide
    // ["b", "a"] espera recibirlas así, y la portada depende de eso para saber
    // cuál es la nota principal. `IN` no garantiza ningún orden.
    const porSlug = new Map(filas.map((f) => [f.slug, f]));
    return slugs
      .map((slug) => porSlug.get(slug))
      .filter((f): f is (typeof filas)[number] => Boolean(f))
      .map((f) => ({
        ...aResumen(f),
        cuerpo: aCuerpo(f.cuerpo),
        edicionSlug: f.edicion.slug,
      }));
  },

  async guardarNota(borrador: NotaBorrador): Promise<NotaCompleta> {
    const { slug, slugOriginal, seccion, titulo, bajada, cuerpo, imagen } =
      borrador;

    // Los derivados se calculan ACÁ, con las mismas funciones que usan el
    // motor mock y la semilla. Es el único camino de escritura, así que no
    // pueden quedar desfasados del cuerpo: no hay forma de guardar un texto
    // sin recalcularlos.
    const campos = {
      seccion,
      titulo,
      bajada,
      cuerpo,
      imagenSrc: imagen?.src ?? null,
      imagenAlt: imagen?.alt ?? null,
      imagenEpigrafe: imagen?.epigrafe ?? null,
      minutosLectura: minutosDeLectura(cuerpo),
      textoPlano: textoPlanoDe(cuerpo),
    };

    // Una nota NUEVA no puede escribir sobre una que existe.
    //
    // Antes la clave de busqueda era `slugOriginal ?? slug`, asi que sin
    // slugOriginal —o sea, creando— se buscaba por el slug tipeado; si ese
    // slug ya estaba, la rama de update pisaba la nota publicada entera y sin
    // avisar. Un descuido al elegir el slug borraba una nota de la edicion.
    if (!slugOriginal) {
      const chocado = await db().nota.findUnique({
        where: { slug },
        select: { titulo: true },
      });
      if (chocado) {
        throw new Error(
          `Ya hay una nota con el slug "${slug}": «${chocado.titulo}». ` +
            "Elegí otro, o editá esa nota desde el listado.",
        );
      }
    }

    const clave = slugOriginal ?? slug;
    const existente = slugOriginal
      ? await db().nota.findUnique({
          where: { slug: clave },
          select: { id: true },
        })
      : null;

    if (existente) {
      // Renombrar hacia un slug ocupado por OTRA nota tampoco puede pisarla.
      // La base lo rechazaria por el indice unico, pero con un error de Prisma
      // que no le dice nada a quien esta editando.
      if (slug !== clave) {
        const ocupado = await db().nota.findUnique({
          where: { slug },
          select: { titulo: true },
        });
        if (ocupado) {
          throw new Error(
            `El slug "${slug}" ya lo usa la nota «${ocupado.titulo}».`,
          );
        }
      }
      // El slug puede haber cambiado: el ON UPDATE CASCADE del esquema hace
      // que los comentarios lo sigan en vez de quedar huérfanos.
      const fila = await db().nota.update({
        where: { slug: clave },
        data: { ...campos, slug },
        select: {
          ...CAMPOS_RESUMEN,
          cuerpo: true,
          edicion: { select: { slug: true } },
        },
      });
      return {
        ...aResumen(fila),
        cuerpo: aCuerpo(fila.cuerpo),
        edicionSlug: fila.edicion.slug,
      };
    }

    // Nota nueva: va al final del foliado. `orden` es único por edición, así
    // que se calcula desde el máximo actual y no desde el conteo de filas: si
    // alguna vez queda un hueco en el medio, contar daría un número ya usado
    // y el guardado fallaría por la restricción.
    const edicion = await edicionActualFila();
    const ultima = await db().nota.findFirst({
      where: { edicionId: edicion.id },
      orderBy: { orden: "desc" },
      select: { orden: true },
    });
    const fila = await db().nota.create({
      data: {
        ...campos,
        slug,
        orden: (ultima?.orden ?? -1) + 1,
        edicionId: edicion.id,
      },
      select: {
        ...CAMPOS_RESUMEN,
        cuerpo: true,
        edicion: { select: { slug: true } },
      },
    });
    return {
      ...aResumen(fila),
      cuerpo: aCuerpo(fila.cuerpo),
      edicionSlug: fila.edicion.slug,
    };
  },

  async indiceDe(edicionSlug: string): Promise<NotaResumen[]> {
    const filas = await db().nota.findMany({
      where: {
        edicion: {
          slug: edicionSlug,
          ...edicionesLegibles(await edicionEnFoco()),
        },
      },
      orderBy: { orden: "asc" },
      select: CAMPOS_RESUMEN,
    });
    return filas.map(aResumen);
  },

  async publicadas(): Promise<EdicionResumen[]> {
    const filas = await db().edicion.findMany({
      where: {
        publicaEn: { not: null, lte: new Date() },
        // Con notas: una edición vacía no es un número del diario, y ya se la
        // excluye de la elección automática por lo mismo.
        notas: { some: {} },
      },
      orderBy: { publicaEn: "desc" },
    });
    return filas.map((e) => ({
      slug: e.slug,
      mes: e.mes,
      numero: e.numero,
      anio: e.anio,
      etiqueta: e.etiqueta ?? undefined,
    }));
  },

  async buscables(): Promise<NotaBuscable[]> {
    const edicion = await edicionActualFila();
    const filas = await db().nota.findMany({
      where: { edicionId: edicion.id },
      orderBy: { orden: "asc" },
      select: { ...CAMPOS_RESUMEN, textoPlano: true },
    });
    return filas.map((f) => ({ ...aResumen(f), textoPlano: f.textoPlano }));
  },
};
