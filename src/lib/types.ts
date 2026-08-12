/** Entidades del diario. La persistencia real (Postgres + Prisma) se define
 *  con el equipo; mientras tanto los repos in-memory implementan estas formas. */

export interface Usuario {
  /** id del usuario en Cidituc */
  id: string;
  nombre: string;
}

export type BloqueNota =
  | { tipo: "parrafo"; texto: string }
  | { tipo: "subtitulo"; texto: string }
  | { tipo: "cita"; texto: string; autor: string; cargo?: string };

export interface Nota {
  slug: string;
  seccion: string;
  titulo: string;
  bajada: string;
  cuerpo: BloqueNota[];
  imagen?: {
    /** epígrafe en itálica bajo la imagen */
    epigrafe: string;
    alt: string;
    /** ruta bajo /public (ej. "/notas/foto.jpg"); si el archivo no existe
     *  todavía, se renderiza el placeholder editorial */
    src?: string;
  };
}

export interface Edicion {
  slug: string;
  /** ej.: "Agosto de 2026" */
  mes: string;
  numero: number;
  anio: number;
  etiqueta?: string;
  notas: Nota[];
}

export interface Comentario {
  id: string;
  notaSlug: string;
  usuarioId: string;
  usuarioNombre: string;
  texto: string;
  fecha: string; // ISO
  likes: number;
  dislikes: number;
  /** voto del usuario que consulta: 1, -1 o null */
  miVoto: 1 | -1 | null;
}
