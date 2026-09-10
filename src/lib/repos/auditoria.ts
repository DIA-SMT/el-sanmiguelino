import "server-only";
import { db } from "@/lib/db";

/**
 * El registro de lo que hace cada administrador en el panel.
 *
 * Nació de una desaparición sin explicación: el 2026-09-07 un comentario dejó de
 * estar y el diario sólo sabía que ya no estaba. Con el borrado definitivo
 * recién estrenado, esa duda deja de ser tolerable.
 *
 * **La regla, y es la única que hay que recordar: toda acción del panel que
 * ESCRIBE, anota.** Se llama a `anotar()` después de que la escritura salió
 * bien, con la sesión que la acción ya tiene en la mano. Si se agrega una Server
 * Action nueva y no anota, el registro no falla ni avisa — simplemente queda un
 * agujero, y eso es exactamente lo que este archivo vino a evitar. Antes de dar
 * por terminada una acción nueva: ¿anota?
 *
 * **Nunca tira, y eso es deliberado**, igual que `registrarIngreso()` y
 * `registrarConsulta()`. Si la base rechaza el registro, la moderación ya
 * ocurrió: hacerla fallar después de haber escrito dejaría al administrador
 * creyendo que no pasó nada sobre algo que sí pasó, que es peor que un renglón
 * que falta. En desarrollo avisa por consola, porque si no un registro roto
 * puede pasar semanas sin que nadie se entere.
 *
 * Lleva `server-only` por lo mismo que `usuarios.ts`: es una lista nominal de
 * quién hizo qué, y no puede llegar al navegador por un import distraído.
 */

/** Sin base no hay registro, y tampoco hay nada que registrar: el panel se
 *  degrada a sólo lectura. */
const HAY_BASE = Boolean(process.env.DATABASE_URL);

/**
 * Las acciones que se anotan, con la clase de cosa que tocan.
 *
 * Están acá y no sueltas en cada llamada por dos razones: la pantalla necesita
 * la lista completa para armar sus filtros —una acción que no figure acá deja
 * filas sin chip— y el nombre queda escrito una sola vez, así que no hay forma
 * de anotar "comentario.baja" en un lado y "comentario.bajado" en otro.
 */
export const ACCIONES = {
  "comentario.baja": { objeto: "comentario", nombre: "Bajó un comentario" },
  "comentario.revision": {
    objeto: "comentario",
    nombre: "Mandó a revisión",
  },
  "comentario.restitucion": {
    objeto: "comentario",
    nombre: "Volvió a publicar",
  },
  "comentario.borrado": {
    objeto: "comentario",
    nombre: "Borró un comentario",
    grave: true,
  },
  "usuario.rol": { objeto: "usuario", nombre: "Cambió un rol" },
  "usuario.bloqueo": {
    objeto: "usuario",
    nombre: "Bloqueó una cuenta",
    grave: true,
  },
  "usuario.desbloqueo": { objeto: "usuario", nombre: "Desbloqueó una cuenta" },
  "nota.guardada": { objeto: "nota", nombre: "Guardó una nota" },
  "edicion.creada": { objeto: "edicion", nombre: "Creó una edición" },
  "edicion.editada": { objeto: "edicion", nombre: "Editó una edición" },
  "edicion.publicada": { objeto: "edicion", nombre: "Puso en la calle" },
  "edicion.borrada": {
    objeto: "edicion",
    nombre: "Borró una edición",
    grave: true,
  },
  "edicion.pdf": { objeto: "edicion", nombre: "Cargó un PDF" },
  "edicion.pdf.quitado": {
    objeto: "edicion",
    nombre: "Quitó un PDF",
    grave: true,
  },
  "edicion.digitalizada": { objeto: "edicion", nombre: "Digitalizó un PDF" },
  /* El fallo también se anota. Una digitalización que revienta deja la edición
     como estaba, así que no se ve en ningún lado: el administrador ve un cartel
     rojo que se va con la próxima recarga y nadie más se entera. Y es
     justamente el caso donde hace falta saber qué pasó, porque el error nace
     dentro del PDF y no se puede reproducir mirando la pantalla. */
  "edicion.digitalizada.fallo": {
    objeto: "edicion",
    nombre: "Falló al digitalizar",
    grave: true,
  },
  "suscripciones.descarga": {
    objeto: "suscripciones",
    nombre: "Descargó el padrón",
    grave: true,
  },
} as const;

export type Accion = keyof typeof ACCIONES;

/** Las clases de cosa, para los filtros de la pantalla. Se derivan de la tabla
 *  de arriba en vez de escribirse dos veces. */
export const OBJETOS = [
  ...new Set(Object.values(ACCIONES).map((a) => a.objeto)),
] as string[];

export interface AnotacionNueva {
  accion: Accion;
  /** El slug o el id de lo tocado. Queda aunque la fila ya no exista. */
  objetoId?: string | null;
  /** La línea que se lee en la pantalla, ya escrita. */
  resumen: string;
  /** Lo que ayude a entender. **Nunca contenido moderado**: ver el módulo. */
  detalle?: Record<string, unknown>;
}

export interface RegistroDelPanel {
  id: string;
  /** ISO: es lo que cruza al cliente y lo que espera `tiempoRelativo`. */
  fecha: string;
  autorId: string;
  autorNombre: string;
  accion: string;
  objeto: string;
  objetoId: string | null;
  resumen: string;
  detalle: Record<string, unknown> | null;
  /**
   * Se llevó algo puesto: un borrado, un bloqueo, datos de vecinos que salieron
   * del sistema. La pantalla las marca para que se encuentren de un vistazo.
   *
   * Lo decide el servidor con la tabla de arriba y viaja resuelto, para que la
   * pantalla no tenga una segunda lista de claves que se pueda desincronizar
   * con ésta.
   */
  grave: boolean;
}

/** Si una acción se llevó algo puesto. Lo desconocido no es grave: una acción
 *  que esta versión no conoce se muestra igual, sin inventarle un color. */
function esGrave(accion: string): boolean {
  const conocida = ACCIONES[accion as Accion] as
    | { grave?: boolean }
    | undefined;
  return conocida?.grave === true;
}

/**
 * Anota una acción. La sesión la pone quien llama: **el autor sale de la sesión
 * y jamás del formulario**, por lo mismo que el moderador de una baja.
 */
export async function anotar(
  quien: { id: string; nombre: string },
  anotacion: AnotacionNueva,
): Promise<void> {
  if (!HAY_BASE) return;
  try {
    await db().registroPanel.create({
      data: {
        autorId: quien.id,
        autorNombre: quien.nombre,
        accion: anotacion.accion,
        objeto: ACCIONES[anotacion.accion].objeto,
        objetoId: anotacion.objetoId ?? null,
        resumen: anotacion.resumen,
        detalle: anotacion.detalle ?? undefined,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[auditoría] no se pudo anotar:",
        anotacion.accion,
        error instanceof Error ? error.message : error,
      );
    }
  }
}

/**
 * Lo último que pasó, para la pantalla.
 *
 * Trae un tope y no todo: el registro crece para siempre —no se limpia, y ese
 * es el punto de un registro— así que la pantalla pide una tanda y el resto
 * queda en la base. Con el volumen de un diario mensual, 300 filas son varios
 * meses de trabajo.
 */
export async function listarRegistro(tope = 300): Promise<RegistroDelPanel[]> {
  if (!HAY_BASE) return [];
  const filas = await db().registroPanel.findMany({
    orderBy: { fecha: "desc" },
    take: tope,
  });
  return filas.map((f) => ({
    id: f.id,
    fecha: f.fecha.toISOString(),
    autorId: f.autorId,
    autorNombre: f.autorNombre,
    accion: f.accion,
    objeto: f.objeto,
    objetoId: f.objetoId,
    detalle:
      f.detalle && typeof f.detalle === "object" && !Array.isArray(f.detalle)
        ? (f.detalle as Record<string, unknown>)
        : null,
    resumen: f.resumen,
    grave: esGrave(f.accion),
  }));
}

/** Cuántas filas hay en total. La pantalla lo necesita para poder decir que lo
 *  que muestra es una tanda y no todo — el mismo problema que ya tuvo la tabla
 *  de consultas de Migue, donde dos números distintos convivían sin explicación. */
export async function contarRegistro(): Promise<number> {
  if (!HAY_BASE) return 0;
  return db().registroPanel.count();
}
