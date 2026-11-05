import "server-only";
import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import type { CorreoArmado } from "@/lib/newsletter/plantilla";

/**
 * Por acá sale todo correo del diario.
 *
 * **Hoy sólo salen de verdad las pruebas del panel** (`TIPOS_QUE_SALEN`), y
 * sólo si están cargadas las credenciales de la cuenta. Lo demás —el correo
 * para confirmar una suscripción, el newsletter a la lista— se guarda en
 * `correos_salientes` con estado "simulado" y el panel lo muestra tal cual
 * habría llegado. Abrir el envío a los vecinos es una decisión aparte (etapa
 * 2): mientras tanto no hay manera de que un correo le llegue a un suscriptor
 * por error.
 *
 * **Cómo sale:** por el SMTP de Google con la cuenta `sanmiguelino@smt.gob.ar`.
 * smt.gob.ar usa Google Workspace y su SPF ya incluye `_spf.google.com`, así que
 * lo que manda esa cuenta pasa SPF y DMARC sin tocar el DNS. La clave es una
 * "contraseña de aplicación" de esa cuenta (pide la verificación en dos pasos
 * prendida), y va sólo en las variables del servidor:
 *
 *   CORREO_SMTP_USUARIO=sanmiguelino@smt.gob.ar
 *   CORREO_SMTP_CLAVE=<contraseña de aplicación>
 *
 * Sin las dos, todo queda simulado, como antes.
 */

/** Quién firma los correos. Lo decidió el municipio el 2026-11-03. */
export const REMITENTE = {
  nombre: "El Sanmiguelino",
  correo: "sanmiguelino@smt.gob.ar",
} as const;

export type TipoDeCorreo = "prueba" | "confirmacion" | "boletin";

/** Lo que sale de verdad cuando hay credenciales. Sumar acá "confirmacion" o
 *  "boletin" es empezar a escribirles a los vecinos: no se hace al pasar. */
const TIPOS_QUE_SALEN: readonly TipoDeCorreo[] = ["prueba"];

/** "smtp" si están las credenciales; "prueba" si no, y nada sale. */
export type ModoDeCorreo = "smtp" | "prueba";

function credenciales(): { usuario: string; clave: string } | null {
  const usuario = process.env.CORREO_SMTP_USUARIO?.trim();
  // Google muestra la contraseña de aplicación en grupos de cuatro con
  // espacios; se aceptan pegados así.
  const clave = process.env.CORREO_SMTP_CLAVE?.replace(/\s+/g, "");
  return usuario && clave ? { usuario, clave } : null;
}

export function modoDeCorreo(): ModoDeCorreo {
  return credenciales() ? "smtp" : "prueba";
}

/** Si un correo de este tipo sale de verdad con la configuración de hoy. */
export function saleDeVerdad(tipo: TipoDeCorreo): boolean {
  return modoDeCorreo() === "smtp" && TIPOS_QUE_SALEN.includes(tipo);
}

function transporte(c: { usuario: string; clave: string }) {
  return nodemailer.createTransport({
    host: process.env.CORREO_SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.CORREO_SMTP_PUERTO) || 465,
    secure: (Number(process.env.CORREO_SMTP_PUERTO) || 465) === 465,
    auth: { user: c.usuario, pass: c.clave },
    // Una función de Vercel se corta a los 10 s: mejor fallar con un mensaje
    // que quedarse colgado.
    connectionTimeout: 4000,
    greetingTimeout: 4000,
    socketTimeout: 7000,
  });
}

export type ResultadoDeEnvio =
  | { id: string; estado: "simulado" | "enviado" }
  | { id: string; estado: "fallido"; error: string };

/**
 * Manda (o simula) un correo y lo deja anotado. Nunca tira por un error del
 * servidor de correo: lo devuelve, y queda guardado con el correo.
 */
export async function enviarCorreo(datos: {
  para: string;
  correo: CorreoArmado;
  tipo: TipoDeCorreo;
  boletinId?: string;
  autorId?: string;
}): Promise<ResultadoDeEnvio> {
  const c = credenciales();
  const sale = Boolean(c) && TIPOS_QUE_SALEN.includes(datos.tipo);

  let estado: "simulado" | "enviado" | "fallido" = "simulado";
  let error: string | null = null;
  if (sale && c) {
    try {
      await transporte(c).sendMail({
        from: { name: REMITENTE.nombre, address: c.usuario },
        to: datos.para,
        subject: datos.correo.asunto,
        html: datos.correo.html,
        text: datos.correo.texto,
      });
      estado = "enviado";
    } catch (e) {
      estado = "fallido";
      error = explicar(e);
    }
  }

  const fila = await db().correoSaliente.create({
    data: {
      tipo: datos.tipo,
      para: datos.para,
      asunto: datos.correo.asunto,
      html: datos.correo.html,
      texto: datos.correo.texto,
      proveedor: sale ? "smtp" : "prueba",
      estado,
      error,
      boletinId: datos.boletinId ?? null,
      autorId: datos.autorId ?? null,
    },
    select: { id: true },
  });
  return estado === "fallido"
    ? { id: fila.id, estado, error: error ?? "No se pudo enviar." }
    : { id: fila.id, estado };
}

/** El error del servidor de correo, en una línea que sirva para arreglarlo. */
function explicar(e: unknown): string {
  const codigo = (e as { code?: string; responseCode?: number })?.code;
  const respuesta = (e as { responseCode?: number })?.responseCode;
  if (codigo === "EAUTH" || respuesta === 535) {
    return "Google rechazó la cuenta o la contraseña de aplicación del correo del diario.";
  }
  if (codigo === "ETIMEDOUT" || codigo === "ECONNECTION" || codigo === "ESOCKET") {
    return "No se pudo conectar con el servidor de correo. Probá de nuevo en un rato.";
  }
  if (respuesta && respuesta >= 500) {
    return "El servidor de correo no aceptó el mensaje. Revisá la dirección.";
  }
  return "No se pudo enviar el correo.";
}

export interface CorreoGuardado {
  id: string;
  fecha: string;
  tipo: string;
  para: string;
  asunto: string;
  estado: string;
}

/** Los últimos correos, para la bandeja del panel. */
export async function listarCorreos(tope = 30): Promise<CorreoGuardado[]> {
  const filas = await db().correoSaliente.findMany({
    orderBy: { fecha: "desc" },
    take: tope,
    select: {
      id: true,
      fecha: true,
      tipo: true,
      para: true,
      asunto: true,
      estado: true,
    },
  });
  return filas.map((f) => ({ ...f, fecha: f.fecha.toISOString() }));
}

export async function obtenerCorreo(id: string) {
  const fila = await db().correoSaliente.findUnique({ where: { id } });
  return fila ? { ...fila, fecha: fila.fecha.toISOString() } : null;
}

/** Cuántos correos de prueba pidió alguien en la última hora. Es el freno del
 *  botón «Enviar prueba»: con la cuenta conectada, cada uno es un correo. */
export async function pruebasRecientes(autorId: string): Promise<number> {
  return db().correoSaliente.count({
    where: {
      tipo: "prueba",
      autorId,
      fecha: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
}
