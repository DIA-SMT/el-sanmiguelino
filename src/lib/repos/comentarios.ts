import type { Comentario } from "@/lib/types";

/**
 * Repo de comentarios y votos, in-memory. Implementa el contrato que después
 * cumplirá la capa Postgres + Prisma. Singleton en globalThis para sobrevivir
 * al hot-reload de desarrollo.
 *
 * PENDIENTE DE CONFIRMAR con el municipio: política de moderación (publicación
 * directa vs. aprobación previa). Hoy publica directo.
 */

interface ComentarioRow {
  id: string;
  notaSlug: string;
  usuarioId: string;
  usuarioNombre: string;
  texto: string;
  fecha: string;
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
      },
      {
        id: "c2",
        notaSlug: "parque-9-de-julio-museo-a-cielo-abierto",
        usuarioId: "cidituc-vec-021",
        usuarioNombre: "Lucía Herrera",
        texto:
          "Estaría bueno que armen visitas guiadas los fines de semana para recorrer todas las esculturas con este contexto histórico.",
        fecha: hace(5),
      },
      {
        id: "c3",
        notaSlug: "nuevo-sistema-transporte-publico",
        usuarioId: "cidituc-vec-033",
        usuarioNombre: "Ramiro Díaz",
        texto:
          "Por fin saber cuándo llega el colectivo sin adivinar. Ojalá las pantallas lleguen pronto a las paradas de la zona sur.",
        fecha: hace(12),
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
  return { ...row, likes, dislikes, miVoto };
}

export const comentariosRepo = {
  async listar(notaSlug: string, usuarioId: string): Promise<Comentario[]> {
    return store.comentarios
      .filter((c) => c.notaSlug === notaSlug)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .map((c) => proyectar(c, usuarioId));
  },

  /** Comentario más reciente de toda la edición, para destacar en portada. */
  async ultimoDeEdicion(
    notaSlugs: string[],
    usuarioId: string,
  ): Promise<Comentario | null> {
    const row = store.comentarios
      .filter((c) => notaSlugs.includes(c.notaSlug))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
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
};
