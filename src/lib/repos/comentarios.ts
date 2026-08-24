import type {
  Comentario,
  ComentarioModerable,
  EstadoComentario,
} from "@/lib/types";

/**
 * Repo de comentarios y votos, in-memory. Implementa el contrato que después
 * cumplirá la capa Postgres. Singleton en globalThis para sobrevivir al
 * hot-reload de desarrollo.
 *
 * Política de moderación, ya definida con el municipio: **los comentarios se
 * publican directo** y el administrador puede darlos de baja después.
 *
 * Un comentario dado de baja **no se borra**. Se le cambia el estado y queda
 * el rastro de quién y cuándo. Son dos razones: los votos que recibió siguen
 * colgando de él, y una publicación oficial que esconde la palabra de un
 * vecino tiene que poder decir quién lo decidió.
 */

interface ComentarioRow {
  id: string;
  notaSlug: string;
  usuarioId: string;
  usuarioNombre: string;
  texto: string;
  fecha: string;
  estado: EstadoComentario;
  ocultadoPor?: string;
  ocultadoEn?: string;
  motivoBaja?: string;
}

interface Store {
  comentarios: ComentarioRow[];
  /** clave `${comentarioId}:${usuarioId}` → 1 | -1 */
  votos: Map<string, 1 | -1>;
  seq: number;
}

function seed(): Store {
  const hace = (horas: number) =>
    new Date(Date.now() - horas * 3600_000).toISOString();
  return {
    comentarios: [
      {
        id: "c1",
        notaSlug: "parque-9-de-julio-museo-a-cielo-abierto",
        usuarioId: "cidituc-vec-014",
        usuarioNombre: "Jorge Paz",
        texto:
          "Hermosa nota. De chico iba con mi abuelo a ver el Laocoonte y no sabía la historia que había detrás. Gran trabajo el de la restauración.",
        fecha: hace(26),
        estado: "publicado",
      },
      {
        id: "c2",
        notaSlug: "parque-9-de-julio-museo-a-cielo-abierto",
        usuarioId: "cidituc-vec-021",
        usuarioNombre: "Lucía Herrera",
        texto:
          "Estaría bueno que armen visitas guiadas los fines de semana para recorrer todas las esculturas con este contexto histórico.",
        fecha: hace(5),
        estado: "publicado",
      },
      {
        id: "c3",
        notaSlug: "nuevo-sistema-transporte-publico",
        usuarioId: "cidituc-vec-033",
        usuarioNombre: "Ramiro Díaz",
        texto:
          "Por fin saber cuándo llega el colectivo sin adivinar. Ojalá las pantallas lleguen pronto a las paradas de la zona sur.",
        fecha: hace(12),
        estado: "publicado",
      },
    ],
    votos: new Map([
      ["c1:cidituc-vec-021", 1],
      ["c3:cidituc-vec-014", 1],
    ]),
    seq: 4,
  };
}

const g = globalThis as typeof globalThis & { __smComentarios?: Store };
const store: Store = (g.__smComentarios ??= seed());

function proyectar(row: ComentarioRow, usuarioId: string): Comentario {
  let likes = 0;
  let dislikes = 0;
  let miVoto: 1 | -1 | null = null;
  for (const [clave, valor] of store.votos) {
    const [comentarioId, votante] = clave.split(":");
    if (comentarioId !== row.id) continue;
    if (valor === 1) likes++;
    else dislikes++;
    if (votante === usuarioId) miVoto = valor;
  }
  return {
    id: row.id,
    notaSlug: row.notaSlug,
    usuarioId: row.usuarioId,
    usuarioNombre: row.usuarioNombre,
    texto: row.texto,
    fecha: row.fecha,
    likes,
    dislikes,
    miVoto,
    estado: row.estado,
  };
}

function proyectarModerable(
  row: ComentarioRow,
  usuarioId: string,
): ComentarioModerable {
  return {
    ...proyectar(row, usuarioId),
    ocultadoPor: row.ocultadoPor,
    ocultadoEn: row.ocultadoEn,
    motivoBaja: row.motivoBaja,
  };
}

const visible = (c: ComentarioRow) => c.estado === "publicado";
const porFecha = (a: ComentarioRow, b: ComentarioRow) =>
  b.fecha.localeCompare(a.fecha);

export const comentariosRepo = {
  /** Lo que ve un lector: sólo lo publicado. */
  async listar(notaSlug: string, usuarioId: string): Promise<Comentario[]> {
    return store.comentarios
      .filter((c) => c.notaSlug === notaSlug && visible(c))
      .sort(porFecha)
      .map((c) => proyectar(c, usuarioId));
  },

  /**
   * Comentario más reciente de toda la edición, para destacar en portada.
   *
   * Filtra por estado igual que `listar()`. Sin ese filtro, dar de baja un
   * comentario lo saca de su nota pero lo deja **destacado en la tapa**, que
   * es justo el lugar donde más se ve.
   */
  async ultimoDeEdicion(
    notaSlugs: string[],
    usuarioId: string,
  ): Promise<Comentario | null> {
    const row = store.comentarios
      .filter((c) => notaSlugs.includes(c.notaSlug) && visible(c))
      .sort(porFecha)[0];
    return row ? proyectar(row, usuarioId) : null;
  },

  async crear(datos: {
    notaSlug: string;
    usuarioId: string;
    usuarioNombre: string;
    texto: string;
  }): Promise<Comentario> {
    const row: ComentarioRow = {
      id: `c${store.seq++}`,
      fecha: new Date().toISOString(),
      estado: "publicado",
      ...datos,
    };
    store.comentarios.push(row);
    return proyectar(row, datos.usuarioId);
  },

  /** valor null quita el voto; 1/-1 lo fija (reemplaza el contrario). */
  async votar(
    comentarioId: string,
    usuarioId: string,
    valor: 1 | -1 | null,
  ): Promise<Comentario | null> {
    const row = store.comentarios.find((c) => c.id === comentarioId);
    if (!row) return null;
    const clave = `${comentarioId}:${usuarioId}`;
    if (valor === null) store.votos.delete(clave);
    else store.votos.set(clave, valor);
    return proyectar(row, usuarioId);
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
    return store.comentarios
      .filter((c) => (notaSlug ? c.notaSlug === notaSlug : true))
      .filter((c) => (estado ? c.estado === estado : true))
      .sort(porFecha)
      .map((c) => proyectarModerable(c, moderadorId));
  },

  async darDeBaja(
    comentarioId: string,
    moderadorId: string,
    motivo?: string,
  ): Promise<ComentarioModerable | null> {
    const row = store.comentarios.find((c) => c.id === comentarioId);
    if (!row) return null;
    row.estado = "oculto";
    row.ocultadoPor = moderadorId;
    row.ocultadoEn = new Date().toISOString();
    row.motivoBaja = motivo;
    return proyectarModerable(row, moderadorId);
  },

  async restituir(
    comentarioId: string,
    moderadorId: string,
  ): Promise<ComentarioModerable | null> {
    const row = store.comentarios.find((c) => c.id === comentarioId);
    if (!row) return null;
    row.estado = "publicado";
    // El rastro de la baja anterior se limpia: si vuelve a bajarse, se escribe
    // de nuevo. El historial completo de moderación es otra tabla, y todavía
    // no hace falta.
    delete row.ocultadoPor;
    delete row.ocultadoEn;
    delete row.motivoBaja;
    return proyectarModerable(row, moderadorId);
  },
};
