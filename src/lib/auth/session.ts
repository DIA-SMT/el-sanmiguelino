import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { Usuario } from "@/lib/types";

export const SESSION_COOKIE = "sanmiguelino_session";

// En producción definir SESSION_SECRET en el entorno.
const SECRET = process.env.SESSION_SECRET ?? "dev-secret-cambiar-en-produccion";

function firmar(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function crearToken(usuario: Usuario): string {
  const payload = Buffer.from(JSON.stringify(usuario), "utf8").toString("base64url");
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
    const usuario = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof usuario?.id === "string" && typeof usuario?.nombre === "string") {
      return { id: usuario.id, nombre: usuario.nombre };
    }
    return null;
  } catch {
    return null;
  }
}

/** Usuario de la sesión actual (server components y route handlers). */
export async function getUsuario(): Promise<Usuario | null> {
  const jar = await cookies();
  return verificarToken(jar.get(SESSION_COOKIE)?.value);
}
