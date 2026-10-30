import "server-only";
import { db } from "@/lib/db";

/**
 * Quién se anotó al newsletter de El Sanmiguelino.
 *
 * Es el único lugar del proyecto donde se guardan **datos personales de un
 * vecino** —nombre y correo—. El registro de Migue está hecho a propósito para
 * lo contrario, no guardar quién pregunta; acá el dato ES la persona, porque
 * hay que escribirle.
 *
 * **Hasta el 2026-10-30 era la suscripción al papel**, con domicilio y edad.
 * El municipio decidió no repartir ejemplares y pasar a un newsletter, y
 * quienes ya estaban anotados siguen en la lista (lo decidió el usuario). Las
 * columnas `direccion` y `edad` quedan en la tabla para no migrar; lo nuevo
 * guarda la dirección vacía, y ni el panel ni la descarga las muestran.
 *
 * Por eso vive aparte y con `server-only`: nada de esto puede llegar al
 * navegador por un import distraído.
 */

export interface Suscripcion {
  id: string;
  nombre: string;
  email: string;
  fecha: string;
}

export type ResultadoSuscripcion =
  | { ok: true; yaEstaba: false }
  /** Ya había una suscripción con ese correo. NO es un error: apretar el botón
   *  dos veces no puede parecer una falla del sitio. */
  | { ok: true; yaEstaba: true }
  /** Ese correo ya lo anotó OTRA cuenta, y no se toca. Ver `suscribir`. */
  | { ok: false; motivo: "ajena" };

export async function suscribir(datos: {
  nombre: string;
  email: string;
  usuarioId: string;
}): Promise<ResultadoSuscripcion> {
  const email = datos.email.trim().toLowerCase();
  const existente = await db().suscripcion.findUnique({
    where: { email },
    select: { usuarioId: true },
  });
  if (existente) {
    /*
     * Sólo la MISMA cuenta que se anotó puede cambiar sus datos.
     *
     * Antes se actualizaba sin preguntar de quién era —"si alguien se anota de
     * nuevo es porque se mudó"—, y eso dejaba un agujero: cualquiera con
     * sesión que supiera el correo de otra persona le cambiaba la dirección y,
     * de paso, se quedaba con la suscripción, porque pasaba a figurar con SU
     * cuenta. El dueño dejaba de recibir el diario sin enterarse y sin rastro
     * de quién lo había hecho.
     *
     * Las filas de antes del 2026-09-01 traen el id que repartía el login de
     * prueba y no coinciden con nadie: esas quedan como están, que es lo
     * seguro. Si alguna de esas personas se muda, la cambia el municipio.
     */
    if (existente.usuarioId !== datos.usuarioId) {
      return { ok: false, motivo: "ajena" };
    }
    // La misma persona anotándose de nuevo: la última vez que escribió su
    // nombre es la buena.
    await db().suscripcion.update({
      where: { email },
      data: { nombre: datos.nombre },
    });
    return { ok: true, yaEstaba: true };
  }
  // `direccion` es una columna obligatoria de cuando era el papel: va vacía.
  await db().suscripcion.create({
    data: {
      nombre: datos.nombre,
      email,
      usuarioId: datos.usuarioId,
      direccion: "",
    },
  });
  return { ok: true, yaEstaba: false };
}

/** Todas, de la más nueva a la más vieja. Para el panel. */
export async function listarSuscripciones(): Promise<Suscripcion[]> {
  const filas = await db().suscripcion.findMany({
    orderBy: { fecha: "desc" },
    select: { id: true, nombre: true, email: true, fecha: true },
  });
  return filas.map((f) => ({ ...f, fecha: f.fecha.toISOString() }));
}
