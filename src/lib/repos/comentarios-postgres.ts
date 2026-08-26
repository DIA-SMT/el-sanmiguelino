import type {
  Comentario,
  ComentarioModerable,
  EstadoComentario,
} from "@/lib/types";

/**
 * Motor Postgres de comentarios y votos.
 *
 * Es una **fábrica** y no un objeto ya construido: recibe el cliente de Prisma
 * en vez de importarlo. Dos razones, y la segunda es la que manda.
 *
 * La primera es de diseño: el repo no sale a buscar un singleton global, así
 * que se lo puede apuntar a otra base sin tocarlo.
 *
 * La segunda es concreta. `scripts/verificar-comentarios.mjs` corre con Node
 * suelto, fuera de Next, y ahí el alias `@/` no existe. Si este archivo
 * importara `@/lib/db`, ese import de VALOR no se podría resolver y el
 * contrato sólo se podría verificar contra el mock —justo el motor que no
 * importa—. Los únicos imports de acá son de tipo, y esos se borran.
 *
 * El contrato es exactamente el de `comentariosMockRepo`. La prueba de que la
 * traducción es fiel es que `npm run verificar:comentarios` pase contra los dos
 * sin cambiarle una aserción.
 */

/** Lo mínimo del cliente de Prisma que este repo usa. Se declara estructural
 *  para no arrastrar el tipo generado, que cambia con cada `prisma generate`. */
interface ClienteComentarios {
  comentario: {
    findMany(args: unknown): Promise<FilaComentario[]>;
    findFirst(args: unknown): Promise<FilaComentario | null>;
    findUnique(args: unknown): Promise<FilaComentario | null>;
    create(args: unknown): Promise<FilaComentario>;
    update(args: unknown): Promise<FilaComentario>;
  };
  voto: {
    findMany(args: unknown): Promise<FilaVoto[]>;
    delete(args: unknown): Promise<unknown>;
    upsert(args: unknown): Promise<unknown>;
  };
}

interface FilaComentario {
  id: string;
  notaSlug: string;
  usuarioId: string;
  usuarioNombre: string;
  texto: string;
  fecha: Date;
  estado: string;
  ocultadoPor: string | null;
  ocultadoEn: Date | null;
  motivoBaja: string | null;
  votos?: FilaVoto[];
}

interface FilaVoto {
  comentarioId: string;
  usuarioId: string;
  valor: number;
}

/** Los votos vienen como filas y el contrato pide contadores. Se cuentan acá y
 *  no con un `groupBy` aparte para no hacer dos viajes: el listado de una nota
 *  trae sus votos en el mismo `include`. */
function contar(votos: FilaVoto[], usuarioId: string) {
  let likes = 0;
  let dislikes = 0;
  let miVoto: 1 | -1 | null = null;
  for (const v of votos) {
    if (v.valor === 1) likes++;
    else dislikes++;
    if (v.usuarioId === usuarioId) miVoto = v.valor === 1 ? 1 : -1;
  }
  return { likes, dislikes, miVoto };
}

function proyectar(fila: FilaComentario, usuarioId: string): Comentario {
  return {
    id: fila.id,
    notaSlug: fila.notaSlug,
    usuarioId: fila.usuarioId,
    usuarioNombre: fila.usuarioNombre,
    texto: fila.texto,
    // El contrato dice ISO string, no Date: es lo que consume `tiempoRelativo`
    // y lo que viaja por JSON al cliente.
    fecha: fila.fecha.toISOString(),
    estado: fila.estado as EstadoComentario,
    ...contar(fila.votos ?? [], usuarioId),
  };
}

function proyectarModerable(
  fila: FilaComentario,
  usuarioId: string,
): ComentarioModerable {
  return {
    ...proyectar(fila, usuarioId),
    // null en la base, undefined en el contrato: el mock omite estos campos
    // cuando no hay baja, y `JSON.stringify` de un null y de un ausente no dan
    // lo mismo del otro lado.
    ocultadoPor: fila.ocultadoPor ?? undefined,
    ocultadoEn: fila.ocultadoEn?.toISOString(),
    motivoBaja: fila.motivoBaja ?? undefined,
  };
}

const CON_VOTOS = { votos: true } as const;

export function crearComentariosPostgresRepo(db: ClienteComentarios) {
  return {
    /** Lo que ve un lector: sólo lo publicado. */
    async listar(notaSlug: string, usuarioId: string): Promise<Comentario[]> {
      const filas = await db.comentario.findMany({
        where: { notaSlug, estado: "publicado" },
        orderBy: { fecha: "desc" },
        include: CON_VOTOS,
      });
      return filas.map((f) => proyectar(f, usuarioId));
    },

    /**
     * El último comentario visible de toda la edición, para la portada.
     *
     * Filtra por estado igual que `listar()`. Sin ese filtro, dar de baja un
     * comentario lo escondía de su nota y lo dejaba destacado en la tapa.
     */
    async ultimoDeEdicion(
      notaSlugs: string[],
      usuarioId: string,
    ): Promise<Comentario | null> {
      if (notaSlugs.length === 0) return null;
      const fila = await db.comentario.findFirst({
        where: { notaSlug: { in: notaSlugs }, estado: "publicado" },
        orderBy: { fecha: "desc" },
        include: CON_VOTOS,
      });
      return fila ? proyectar(fila, usuarioId) : null;
    },

    async crear(datos: {
      notaSlug: string;
      usuarioId: string;
      usuarioNombre: string;
      texto: string;
    }): Promise<Comentario> {
      const fila = await db.comentario.create({
        data: { ...datos, estado: "publicado" },
        include: CON_VOTOS,
      });
      return proyectar(fila, datos.usuarioId);
    },

    /** valor null quita el voto; 1/-1 lo fija (reemplaza el contrario). */
    async votar(
      comentarioId: string,
      usuarioId: string,
      valor: 1 | -1 | null,
    ): Promise<Comentario | null> {
      const existe = await db.comentario.findUnique({
        where: { id: comentarioId },
      });
      if (!existe) return null;

      if (valor === null) {
        // Puede no haber voto que borrar —quitar dos veces seguidas—, y eso no
        // es un error: el estado final es el mismo.
        await db.voto
          .delete({ where: { comentarioId_usuarioId: { comentarioId, usuarioId } } })
          .catch(() => undefined);
      } else {
        await db.voto.upsert({
          where: { comentarioId_usuarioId: { comentarioId, usuarioId } },
          create: { comentarioId, usuarioId, valor },
          update: { valor },
        });
      }

      const fila = await db.comentario.findUnique({
        where: { id: comentarioId },
        include: CON_VOTOS,
      });
      return fila ? proyectar(fila, usuarioId) : null;
    },

    // --- Moderación --------------------------------------------------------

    /**
     * Lo que ve el administrador: **todo**, publicado y oculto, de toda la
     * edición o de una nota. Los ocultos primero no: primero los recientes, que
     * es el orden en que se modera.
     */
    async listarParaModeracion(opciones?: {
      notaSlug?: string;
      estado?: EstadoComentario;
      moderadorId?: string;
    }): Promise<ComentarioModerable[]> {
      const { notaSlug, estado, moderadorId = "" } = opciones ?? {};
      const filas = await db.comentario.findMany({
        where: {
          ...(notaSlug ? { notaSlug } : {}),
          ...(estado ? { estado } : {}),
        },
        orderBy: { fecha: "desc" },
        include: CON_VOTOS,
      });
      return filas.map((f) => proyectarModerable(f, moderadorId));
    },

    async darDeBaja(
      comentarioId: string,
      moderadorId: string,
      motivo?: string,
    ): Promise<ComentarioModerable | null> {
      const existe = await db.comentario.findUnique({
        where: { id: comentarioId },
      });
      if (!existe) return null;
      const fila = await db.comentario.update({
        where: { id: comentarioId },
        data: {
          estado: "oculto",
          ocultadoPor: moderadorId,
          ocultadoEn: new Date(),
          motivoBaja: motivo ?? null,
        },
        include: CON_VOTOS,
      });
      return proyectarModerable(fila, moderadorId);
    },

    async restituir(
      comentarioId: string,
      moderadorId: string,
    ): Promise<ComentarioModerable | null> {
      const existe = await db.comentario.findUnique({
        where: { id: comentarioId },
      });
      if (!existe) return null;
      const fila = await db.comentario.update({
        where: { id: comentarioId },
        data: {
          estado: "publicado",
          // El rastro de la baja anterior se limpia: si vuelve a bajarse, se
          // escribe de nuevo. El historial completo de moderación es otra
          // tabla, y todavía no hace falta.
          ocultadoPor: null,
          ocultadoEn: null,
          motivoBaja: null,
        },
        include: CON_VOTOS,
      });
      return proyectarModerable(fila, moderadorId);
    },
  };
}
