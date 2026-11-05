import "server-only";
import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import type { CorreoArmado } from "@/lib/newsletter/plantilla";
import { clasificarError, type ClaseDeError } from "@/lib/newsletter/cola";

/**
 * Por acá sale todo correo del diario.
 *
 * **Las pruebas del panel salen siempre** que estén las credenciales de la
 * cuenta. **A los vecinos** —el correo para confirmar una suscripción y el
 * newsletter a la lista— sólo se les escribe si además está prendido
 * `NEWSLETTER_ENVIO_REAL=1`. Esa variable es la autorización explícita del
 * municipio para empezar a escribirles, y no se prende al pasar. Sin ella, la
 * confirmación queda "simulada" en `correos_salientes`, y el newsletter
 * recorre la cola entera pero cada destinatario queda "simulado": se puede
 * probar el envío completo sin que le llegue nada a nadie.
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

/** Si el municipio autorizó escribirles a los vecinos. Ver arriba. */
export function envioALosVecinosAutorizado(): boolean {
  return process.env.NEWSLETTER_ENVIO_REAL === "1";
}

/** Lo que sale de verdad cuando hay credenciales: las pruebas siempre, y lo que
 *  le llega a un vecino sólo con la autorización de arriba. */
function tiposQueSalen(): readonly TipoDeCorreo[] {
  return envioALosVecinosAutorizado()
    ? ["prueba", "confirmacion", "boletin"]
    : ["prueba"];
}

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
  return modoDeCorreo() === "smtp" && tiposQueSalen().includes(tipo);
}

/**
 * Google Workspace deja mandar unos 2000 correos por día y por cuenta. Contando
 * todo —pruebas, confirmaciones y newsletters—, la cola frena antes de llegar,
 * con margen para que las confirmaciones de quien se anota ese día sigan
 * saliendo. Lo que no salió hoy sale mañana: nadie se queda sin su correo.
 */
export function topeDiario(): number {
  const n = Number(process.env.NEWSLETTER_TOPE_DIARIO);
  return Number.isInteger(n) && n > 0 ? n : 1800;
}

function transporte(c: { usuario: string; clave: string }, pool = false) {
  const puerto = Number(process.env.CORREO_SMTP_PUERTO) || 465;
  return nodemailer.createTransport({
    host: process.env.CORREO_SMTP_HOST || "smtp.gmail.com",
    port: puerto,
    secure: puerto === 465,
    auth: { user: c.usuario, pass: c.clave },
    // La cola manda varios en una misma llamada: con una conexión abierta se
    // ahorra el saludo y el TLS de cada uno. Una sola, para no parecerle a
    // Google una ráfaga.
    ...(pool ? { pool: true, maxConnections: 1 } : {}),
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
 * Manda (o simula) un correo suelto y lo deja anotado en `correos_salientes`:
 * las pruebas y las confirmaciones. Nunca tira por un error del servidor de
 * correo: lo devuelve, y queda guardado con el correo.
 *
 * El newsletter a la lista NO pasa por acá: va por la cola (`abrirCorreo`),
 * que anota a cada destinatario en `boletin_envios` sin copiar el mensaje.
 */
export async function enviarCorreo(datos: {
  para: string;
  correo: CorreoArmado;
  tipo: TipoDeCorreo;
  boletinId?: string;
  autorId?: string;
}): Promise<ResultadoDeEnvio> {
  const c = credenciales();
  const sale = Boolean(c) && tiposQueSalen().includes(datos.tipo);

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
      error = clasificarError(e).mensaje;
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

export type ResultadoDeEnvioEnCola =
  | { estado: "enviado" | "simulado" }
  | { estado: "fallido"; clase: ClaseDeError; mensaje: string };

/**
 * Una conexión para mandar varios newsletters seguidos, desde la cola.
 *
 * Si el municipio no autorizó escribirles a los vecinos, o no hay cuenta
 * conectada, `mandar` no sale a ningún lado y devuelve "simulado".
 *
 * Cada correo lleva su propia baja de un clic (`List-Unsubscribe` +
 * `List-Unsubscribe-Post`, RFC 8058): Gmail y Yahoo la exigen a quien manda en
 * cantidad, y es el botón «Anular suscripción» que muestran junto al
 * remitente. Va a la dirección firmada de esa persona.
 */
export function abrirCorreo(): {
  real: boolean;
  mandar: (datos: {
    para: string;
    correo: CorreoArmado;
    bajaUnClic: string;
  }) => Promise<ResultadoDeEnvioEnCola>;
  cerrar: () => void;
} {
  const c = credenciales();
  if (!c || !saleDeVerdad("boletin")) {
    return {
      real: false,
      mandar: async () => ({ estado: "simulado" }),
      cerrar: () => {},
    };
  }
  const t = transporte(c, true);
  return {
    real: true,
    mandar: async ({ para, correo, bajaUnClic }) => {
      try {
        await t.sendMail({
          from: { name: REMITENTE.nombre, address: c.usuario },
          to: para,
          subject: correo.asunto,
          html: correo.html,
          text: correo.texto,
          headers: {
            "List-Unsubscribe": `<${bajaUnClic}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
        return { estado: "enviado" };
      } catch (e) {
        return { estado: "fallido", ...clasificarError(e) };
      }
    },
    cerrar: () => t.close(),
  };
}

/** Cuántos correos salieron de verdad en las últimas 24 horas, de todo tipo.
 *  Es lo que se compara con `topeDiario()`. */
export async function enviadosUltimas24h(ahora = new Date()): Promise<number> {
  const desde = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
  const [sueltos, boletines] = await Promise.all([
    db().correoSaliente.count({
      where: { estado: "enviado", fecha: { gte: desde } },
    }),
    db().envioBoletin.count({
      where: { estado: "enviado", enviadoEn: { gte: desde } },
    }),
  ]);
  return sueltos + boletines;
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
