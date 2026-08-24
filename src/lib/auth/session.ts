import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  TTL_SESION_SEG,
  VERSION_TOKEN,
} from "@/lib/auth/cookie";
import type { Usuario } from "@/lib/types";

// Se re-exporta para no romper a quien ya lo importaba desde acá.
export { SESSION_COOKIE };

const FALLBACK_DESARROLLO = "dev-secret-cambiar-en-produccion";
const LARGO_MINIMO = 32;

/**
 * El secreto de firma, resuelto en cada uso y no al importar el módulo.
 *
 * En producción **tira** si falta o si es corto, en vez de caer a un valor por
 * defecto. El fallback anterior estaba escrito en el repositorio: cualquiera
 * que leyera el código podía firmar un token válido sin tocar el servidor. Un
 * default cómodo en un módulo de sesión no es una comodidad, es una llave
 * publicada.
 *
 * Es lazy porque tirar al importar rompería el build: los módulos se evalúan
 * al compilar, cuando la variable de entorno de producción todavía no está.
 */
function secreto(): string {
  const valor = process.env.SESSION_SECRET;
  if (valor && valor.length >= LARGO_MINIMO) return valor;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `SESSION_SECRET falta o es más corto que ${LARGO_MINIMO} caracteres. ` +
        "Sin un secreto propio, cualquiera puede firmar una sesión válida.",
    );
  }
  return FALLBACK_DESARROLLO;
}

/** Lo que viaja firmado. El rol NO está acá a propósito: ver `roles.ts`. */
interface Payload {
  v: number;
  id: string;
  nombre: string;
  /** vencimiento, en segundos desde epoch */
  exp: number;
}

function firmar(payload: string): string {
  return createHmac("sha256", secreto()).update(payload).digest("base64url");
}

export function crearToken(usuario: Usuario): string {
  const datos: Payload = {
    v: VERSION_TOKEN,
    id: usuario.id,
    nombre: usuario.nombre,
    exp: Math.floor(Date.now() / 1000) + TTL_SESION_SEG,
  };
  const payload = Buffer.from(JSON.stringify(datos), "utf8").toString(
    "base64url",
  );
  return `${payload}.${firmar(payload)}`;
}

export function verificarToken(token: string | undefined): Usuario | null {
  if (!token) return null;
  const [payload, firma] = token.split(".");
  if (!payload || !firma) return null;

  const esperada = firmar(payload);
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const datos = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (datos?.v !== VERSION_TOKEN) return null;
    if (typeof datos.exp !== "number" || datos.exp * 1000 <= Date.now()) {
      return null;
    }
    if (typeof datos.id !== "string" || typeof datos.nombre !== "string") {
      return null;
    }
    // Proyección explícita, nunca el objeto parseado tal cual: si mañana el
    // payload trae un campo nuevo, no entra sin pasar por acá. Una guardia
    // escrita sobre un campo que nadie validó falla abierta.
    return { id: datos.id, nombre: datos.nombre };
  } catch {
    return null;
  }
}

/** Usuario de la sesión actual (server components y route handlers). */
export async function getUsuario(): Promise<Usuario | null> {
  const jar = await cookies();
  return verificarToken(jar.get(SESSION_COOKIE)?.value);
}
