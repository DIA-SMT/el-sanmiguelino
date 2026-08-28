import "server-only";
import { db } from "@/lib/db";

/**
 * Quién quiere el diario en papel.
 *
 * Es el único lugar del proyecto donde se guardan **datos personales de un
 * vecino** —nombre, edad, correo y domicilio—. El registro de Migue está hecho
 * a propósito para lo contrario, no guardar quién pregunta; acá el dato ES la
 * persona, porque hay que llevarle el diario a su casa.
 *
 * Por eso vive aparte y con `server-only`: nada de esto puede llegar al
 * navegador por un import distraído.
 */

export interface Suscripcion {
  id: string;
  nombre: string;
  edad: number | null;
  email: string;
  direccion: string;
  fecha: string;
}

export type ResultadoSuscripcion =
  | { ok: true; yaEstaba: false }
  /** Ya había una suscripción con ese correo. NO es un error: apretar el botón
   *  dos veces no puede parecer una falla del sitio. */
  | { ok: true; yaEstaba: true };

export async function suscribir(datos: {
  nombre: string;
  edad: number | null;
  email: string;
  direccion: string;
  usuarioId: string;
}): Promise<ResultadoSuscripcion> {
  const email = datos.email.trim().toLowerCase();
  const existente = await db().suscripcion.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existente) {
    // Se actualizan los datos: si alguien se anota de nuevo es porque se mudó
    // o se equivocó, y la última vez que lo escribió es la buena.
    await db().suscripcion.update({
      where: { email },
      data: {
        nombre: datos.nombre,
        edad: datos.edad,
        direccion: datos.direccion,
        usuarioId: datos.usuarioId,
      },
    });
    return { ok: true, yaEstaba: true };
  }
  await db().suscripcion.create({ data: { ...datos, email } });
  return { ok: true, yaEstaba: false };
}

/** Todas, de la más nueva a la más vieja. Para el panel. */
export async function listarSuscripciones(): Promise<Suscripcion[]> {
  const filas = await db().suscripcion.findMany({
    orderBy: { fecha: "desc" },
    select: {
      id: true,
      nombre: true,
      edad: true,
      email: true,
      direccion: true,
      fecha: true,
    },
  });
  return filas.map((f) => ({ ...f, fecha: f.fecha.toISOString() }));
}
