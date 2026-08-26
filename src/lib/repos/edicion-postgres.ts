import type { EdicionRepo } from "@/lib/repos/edicion";
import { db } from "@/lib/db";
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

/** La edición que se sirve. Ver el comentario de `actual` en el esquema: la
 *  unicidad la sostiene quien escribe, así que acá se ordena y se toma la
 *  primera en vez de asumir que hay exactamente una. */
async function edicionActualFila() {
  const edicion = await db().edicion.findFirst({
    where: { actual: true },
    orderBy: [{ anio: "desc" }, { numero: "desc" }],
  });
  if (!edicion) {
    throw new Error(
      "No hay ninguna edición marcada como actual en la base. " +
        "Correr `npm run db:seed`.",
    );
  }
  return edicion;
}

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

  async nota(slug: string): Promise<NotaCompleta | null> {
    const fila = await db().nota.findUnique({
      where: { slug },
      select: { ...CAMPOS_RESUMEN, cuerpo: true },
    });
    if (!fila) return null;
    return { ...aResumen(fila), cuerpo: aCuerpo(fila.cuerpo) };
  },

  async completas(slugs: string[]): Promise<NotaCompleta[]> {
    if (slugs.length === 0) return [];
    const filas = await db().nota.findMany({
      where: { slug: { in: slugs } },
      select: { ...CAMPOS_RESUMEN, cuerpo: true },
    });
    // Se respeta el orden PEDIDO, no el que devuelve la base: quien pide
    // ["b", "a"] espera recibirlas así, y la portada depende de eso para saber
    // cuál es la nota principal. `IN` no garantiza ningún orden.
    const porSlug = new Map(filas.map((f) => [f.slug, f]));
    return slugs
      .map((slug) => porSlug.get(slug))
      .filter((f): f is (typeof filas)[number] => Boolean(f))
      .map((f) => ({ ...aResumen(f), cuerpo: aCuerpo(f.cuerpo) }));
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

    const clave = slugOriginal ?? slug;
    const existente = await db().nota.findUnique({
      where: { slug: clave },
      select: { id: true },
    });

    if (existente) {
      // El slug puede haber cambiado: el ON UPDATE CASCADE del esquema hace
      // que los comentarios lo sigan en vez de quedar huérfanos.
      const fila = await db().nota.update({
        where: { slug: clave },
        data: { ...campos, slug },
        select: { ...CAMPOS_RESUMEN, cuerpo: true },
      });
      return { ...aResumen(fila), cuerpo: aCuerpo(fila.cuerpo) };
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
      select: { ...CAMPOS_RESUMEN, cuerpo: true },
    });
    return { ...aResumen(fila), cuerpo: aCuerpo(fila.cuerpo) };
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
