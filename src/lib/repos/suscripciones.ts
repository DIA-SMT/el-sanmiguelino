import "server-only";
import { db } from "@/lib/db";
import { SITIO_URL } from "@/lib/compartir";
import { enviarCorreo } from "@/lib/correo/enviar";
import {
  firmarEnlace,
  secretoDeEnlaces,
  verificarEnlace,
} from "@/lib/newsletter/enlaces";
import { armarConfirmacion } from "@/lib/newsletter/plantilla";

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
 * **Desde el 2026-11-03 cada suscripción tiene estado** —pendiente, activa o
 * baja— y su historial de consentimiento (`EventoSuscripcion`). Sólo se le
 * escribe a quien confirmó con el enlace del correo (doble confirmación), y
 * las que venían del papel arrancan pendientes.
 *
 * Por eso vive aparte y con `server-only`: nada de esto puede llegar al
 * navegador por un import distraído.
 */

export type EstadoSuscripcion = "pendiente" | "activa" | "baja";

export const ESTADOS: EstadoSuscripcion[] = ["activa", "pendiente", "baja"];

/** Lo que no se conoce cae en "pendiente": nunca se le escribe a alguien por
 *  un valor raro en la base. */
function aEstado(valor: string): EstadoSuscripcion {
  return valor === "activa" || valor === "baja" ? valor : "pendiente";
}

export interface Suscripcion {
  id: string;
  nombre: string;
  email: string;
  fecha: string;
  estado: EstadoSuscripcion;
  confirmadaEn: string | null;
  bajaEn: string | null;
}

export type ResultadoSuscripcion =
  | {
      ok: true;
      /** Ya había una suscripción con ese correo. NO es un error: apretar el
       *  botón dos veces no puede parecer una falla del sitio. */
      yaEstaba: boolean;
      /** Ya confirmó: no hay nada más que hacer. */
      activa: boolean;
      /** "enviado": le salió el correo para confirmar. "en-espera": todavía no
       *  hay proveedor de correo, así que se le pide antes del primer envío. */
      confirmacion: "enviado" | "en-espera" | "no-hace-falta";
    }
  /** Ese correo ya lo anotó OTRA cuenta, y no se toca. Ver `suscribir`. */
  | { ok: false; motivo: "ajena" };

/** El correo para confirmar, según el modo de envío. Ver `correo/enviar.ts`. */
async function pedirConfirmacion(s: {
  id: string;
  nombre: string;
  email: string;
}): Promise<"enviado" | "en-espera"> {
  const token = firmarEnlace(secretoDeEnlaces(), "confirmar", s.id);
  const envio = await enviarCorreo({
    para: s.email,
    correo: armarConfirmacion({
      nombre: s.nombre,
      enlace: `${SITIO_URL.origin}/newsletter/confirmar?t=${token}`,
    }),
    tipo: "confirmacion",
  });
  /*
   * Hoy el correo para confirmar queda simulado en la bandeja del panel (sólo
   * salen las pruebas: ver `correo/enviar.ts`), así que no se anota como
   * pedido: ni `confirmacionPedidaEn` ni el evento. Cuando se abra el envío, a
   * todas las pendientes se les manda el de verdad, y el historial tiene que
   * decir lo que pasó, no lo que se simuló.
   */
  if (envio.estado !== "enviado") return "en-espera";
  await db().$transaction([
    db().suscripcion.update({
      where: { id: s.id },
      data: { confirmacionPedidaEn: new Date() },
    }),
    db().eventoSuscripcion.create({
      data: {
        suscripcionId: s.id,
        tipo: "confirmacion-pedida",
        via: "formulario",
      },
    }),
  ]);
  return "enviado";
}

/** Entre un correo para confirmar y el siguiente, por lo menos esto. Si no, el
 *  botón del formulario sería una manera de llenarle la bandeja a alguien. */
const FRENO_CONFIRMACION_MS = 10 * 60 * 1000;

async function pedirConfirmacionConFreno(
  id: string,
): Promise<"enviado" | "en-espera"> {
  const s = await db().suscripcion.findUniqueOrThrow({
    where: { id },
    select: { id: true, nombre: true, email: true, confirmacionPedidaEn: true },
  });
  if (
    s.confirmacionPedidaEn &&
    Date.now() - s.confirmacionPedidaEn.getTime() < FRENO_CONFIRMACION_MS
  ) {
    return "enviado";
  }
  return pedirConfirmacion(s);
}

/** Si el correo para confirmar no sale, la suscripción igual queda guardada
 *  (pendiente): se le pide de nuevo antes del primer envío. Que falle el correo
 *  no puede hacer fallar el anotarse. */
function fallaDeConfirmacion(error: unknown): "en-espera" {
  console.error(
    "[newsletter] no salió el correo para confirmar:",
    error instanceof Error ? error.message : error,
  );
  return "en-espera";
}

export async function suscribir(datos: {
  nombre: string;
  email: string;
  usuarioId: string;
}): Promise<ResultadoSuscripcion> {
  const email = datos.email.trim().toLowerCase();
  const existente = await db().suscripcion.findUnique({
    where: { email },
    select: { id: true, usuarioId: true, estado: true },
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
    const estado = aEstado(existente.estado);
    // La misma persona anotándose de nuevo: la última vez que escribió su
    // nombre es la buena. Si se había dado de baja vuelve, pero pendiente:
    // tiene que confirmar otra vez.
    if (estado === "baja") {
      await db().$transaction([
        db().suscripcion.update({
          where: { email },
          data: { nombre: datos.nombre, estado: "pendiente", bajaEn: null },
        }),
        db().eventoSuscripcion.create({
          data: {
            suscripcionId: existente.id,
            tipo: "reactivacion",
            via: "formulario",
          },
        }),
      ]);
    } else {
      await db().suscripcion.update({
        where: { email },
        data: { nombre: datos.nombre },
      });
    }
    if (estado === "activa") {
      return {
        ok: true,
        yaEstaba: true,
        activa: true,
        confirmacion: "no-hace-falta",
      };
    }
    const confirmacion = await pedirConfirmacionConFreno(existente.id).catch(
      fallaDeConfirmacion,
    );
    return { ok: true, yaEstaba: true, activa: false, confirmacion };
  }
  // `direccion` es una columna obligatoria de cuando era el papel: va vacía.
  const nueva = await db().suscripcion.create({
    data: {
      nombre: datos.nombre,
      email,
      usuarioId: datos.usuarioId,
      direccion: "",
      eventos: { create: { tipo: "alta", via: "formulario" } },
    },
    select: { id: true, nombre: true, email: true },
  });
  const confirmacion = await pedirConfirmacion(nueva).catch(
    fallaDeConfirmacion,
  );
  return { ok: true, yaEstaba: false, activa: false, confirmacion };
}

/** Lo que dice un enlace del correo, sin hacer nada. Para la página que
 *  pregunta antes de actuar. */
export async function leerEnlace(
  proposito: "confirmar" | "baja",
  token: string | undefined,
): Promise<
  | { ok: true; id: string; email: string; estado: EstadoSuscripcion }
  | { ok: false; estado: "invalido" | "vencido" | "no-existe" }
> {
  const lectura = verificarEnlace(secretoDeEnlaces(), proposito, token);
  if (!lectura.ok) return { ok: false, estado: lectura.motivo };
  const fila = await db().suscripcion.findUnique({
    where: { id: lectura.suscripcionId },
    select: { id: true, email: true, estado: true },
  });
  if (!fila) return { ok: false, estado: "no-existe" };
  return {
    ok: true,
    id: fila.id,
    email: fila.email,
    estado: aEstado(fila.estado),
  };
}

export type ResultadoDeEnlace =
  | { estado: "hecho" | "ya-estaba" | "estaba-de-baja"; email: string }
  | { estado: "invalido" | "vencido" | "no-existe" };

/**
 * Confirmar con el enlace del correo: de "pendiente" a "activa".
 *
 * Sólo desde "pendiente". Un enlace viejo de confirmación no puede devolver a
 * la lista a alguien que después se dio de baja: para volver, se anota de
 * nuevo y confirma de nuevo.
 */
export async function confirmar(
  token: string | undefined,
): Promise<ResultadoDeEnlace> {
  const leido = await leerEnlace("confirmar", token);
  if (!leido.ok) return { estado: leido.estado };
  if (leido.estado === "activa") {
    return { estado: "ya-estaba", email: leido.email };
  }
  if (leido.estado === "baja") {
    return { estado: "estaba-de-baja", email: leido.email };
  }
  // El estado va en el filtro: si dos pestañas confirman a la vez, una sola
  // cambia la fila y una sola anota el evento.
  const cambio = await db().$transaction(async (tx) => {
    const r = await tx.suscripcion.updateMany({
      where: { id: leido.id, estado: "pendiente" },
      data: { estado: "activa", confirmadaEn: new Date() },
    });
    if (r.count > 0) {
      await tx.eventoSuscripcion.create({
        data: { suscripcionId: leido.id, tipo: "confirmacion", via: "enlace" },
      });
    }
    return r.count > 0;
  });
  return { estado: cambio ? "hecho" : "ya-estaba", email: leido.email };
}

/** Dar de baja, desde cualquier estado. Repetirlo no hace nada y devuelve
 *  false. */
export async function darDeBaja(
  id: string,
  via: "enlace" | "un-click" | "panel",
): Promise<boolean> {
  return db().$transaction(async (tx) => {
    const r = await tx.suscripcion.updateMany({
      where: { id, estado: { not: "baja" } },
      data: { estado: "baja", bajaEn: new Date() },
    });
    if (r.count > 0) {
      await tx.eventoSuscripcion.create({
        data: { suscripcionId: id, tipo: "baja", via },
      });
    }
    return r.count > 0;
  });
}

/** La baja con el enlace del correo. */
export async function darDeBajaConEnlace(
  token: string | undefined,
  via: "enlace" | "un-click",
): Promise<ResultadoDeEnlace> {
  const leido = await leerEnlace("baja", token);
  if (!leido.ok) return { estado: leido.estado };
  const cambio = await darDeBaja(leido.id, via);
  return { estado: cambio ? "hecho" : "ya-estaba", email: leido.email };
}

/** Todas, o las de un estado, de la más nueva a la más vieja. Para el panel. */
export async function listarSuscripciones(
  estado?: EstadoSuscripcion,
): Promise<Suscripcion[]> {
  const filas = await db().suscripcion.findMany({
    where: estado ? { estado } : undefined,
    orderBy: { fecha: "desc" },
    select: {
      id: true,
      nombre: true,
      email: true,
      fecha: true,
      estado: true,
      confirmadaEn: true,
      bajaEn: true,
    },
  });
  return filas.map((f) => ({
    ...f,
    estado: aEstado(f.estado),
    fecha: f.fecha.toISOString(),
    confirmadaEn: f.confirmadaEn?.toISOString() ?? null,
    bajaEn: f.bajaEn?.toISOString() ?? null,
  }));
}

/** Cuántas hay en cada estado. */
export async function contarPorEstado(): Promise<
  Record<EstadoSuscripcion, number>
> {
  const grupos = await db().suscripcion.groupBy({
    by: ["estado"],
    _count: { _all: true },
  });
  const cuentas: Record<EstadoSuscripcion, number> = {
    activa: 0,
    pendiente: 0,
    baja: 0,
  };
  for (const g of grupos) cuentas[aEstado(g.estado)] += g._count._all;
  return cuentas;
}

/** El nombre, para la línea del registro de auditoría. */
export async function nombreDeSuscripcion(id: string): Promise<string | null> {
  const fila = await db().suscripcion.findUnique({
    where: { id },
    select: { nombre: true },
  });
  return fila?.nombre ?? null;
}
