import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Los enlaces de los correos: confirmar la suscripción y darse de baja.
 *
 * Van **firmados** y no guardados en la base: el token es el id de la
 * suscripción, para qué sirve y hasta cuándo, con una firma HMAC encima. Nadie
 * puede armar el enlace de otra persona sin el secreto del servidor, y no hay
 * una tabla de tokens que limpiar ni que se pueda filtrar.
 *
 * - **Confirmar** vence a los 30 días. Pasado ese tiempo la persona se anota de
 *   nuevo y le llega otro.
 * - **La baja no vence nunca.** Un correo de hace dos años tiene que poder dar
 *   de baja igual: es lo mínimo que se le debe a quien ya no quiere recibirlos.
 *
 * El propósito va dentro de la firma, así que un enlace de baja no sirve para
 * confirmar ni al revés.
 *
 * Las funciones de abajo reciben el secreto por parámetro y no leen el entorno:
 * así se prueban con Node suelto. `secretoDeEnlaces()` es la que lo resuelve en
 * el servidor.
 */

export type Proposito = "confirmar" | "baja";

const LETRA: Record<Proposito, string> = { confirmar: "c", baja: "b" };
const DIA_SEG = 24 * 60 * 60;
const VIGENCIA_CONFIRMAR_SEG = 30 * DIA_SEG;

/** Separa estas firmas de las de la sesión, que usan el mismo secreto. */
const DOMINIO = "sanmiguelino:newsletter:v1";

function firma(secreto: string, cuerpo: string): string {
  return createHmac("sha256", secreto)
    .update(`${DOMINIO}:${cuerpo}`)
    .digest("base64url");
}

export function firmarEnlace(
  secreto: string,
  proposito: Proposito,
  suscripcionId: string,
  ahora = new Date(),
): string {
  // 0 = no vence.
  const vence =
    proposito === "confirmar"
      ? Math.floor(ahora.getTime() / 1000) + VIGENCIA_CONFIRMAR_SEG
      : 0;
  const cuerpo = `${LETRA[proposito]}.${suscripcionId}.${vence.toString(36)}`;
  return `${cuerpo}.${firma(secreto, cuerpo)}`;
}

export type LecturaDeEnlace =
  | { ok: true; suscripcionId: string }
  | { ok: false; motivo: "invalido" | "vencido" };

export function verificarEnlace(
  secreto: string,
  proposito: Proposito,
  token: string | null | undefined,
  ahora = new Date(),
): LecturaDeEnlace {
  if (!token || token.length > 200) return { ok: false, motivo: "invalido" };
  const partes = token.split(".");
  if (partes.length !== 4) return { ok: false, motivo: "invalido" };
  const [letra, id, vence36, recibida] = partes;
  if (letra !== LETRA[proposito] || !id) return { ok: false, motivo: "invalido" };

  const esperada = Buffer.from(firma(secreto, `${letra}.${id}.${vence36}`));
  const dada = Buffer.from(recibida);
  if (dada.length !== esperada.length || !timingSafeEqual(dada, esperada)) {
    return { ok: false, motivo: "invalido" };
  }

  const vence = parseInt(vence36, 36);
  if (!Number.isFinite(vence)) return { ok: false, motivo: "invalido" };
  if (vence !== 0 && vence * 1000 <= ahora.getTime()) {
    return { ok: false, motivo: "vencido" };
  }
  return { ok: true, suscripcionId: id };
}

/**
 * El secreto de los enlaces: el mismo `SESSION_SECRET` de la sesión, separado
 * por el dominio de arriba. Con la misma regla que `session.ts`: en producción,
 * sin un secreto de verdad se corta en vez de firmar con una llave publicada.
 */
export function secretoDeEnlaces(): string {
  const valor = process.env.SESSION_SECRET;
  if (valor && valor.length >= 32) return valor;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET falta o es corto: no se firman enlaces.");
  }
  return "dev-secret-cambiar-en-produccion";
}
