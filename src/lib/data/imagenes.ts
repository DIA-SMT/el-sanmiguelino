import { existsSync } from "node:fs";
import path from "node:path";

/**
 * true si la imagen declarada en la nota se puede mostrar.
 *
 * Dos orígenes conviven a propósito: las fotos históricas están committeadas
 * en /public y las que suba el admin van a vivir en el blob store. Una URL
 * remota se da por buena porque la garantiza quien la escribió — no se puede
 * chequear con `existsSync` y no vale la pena un fetch por imagen y por
 * render.
 *
 * Nombre, firma y type predicate se mantienen: los llamados repartidos por la
 * app no se tocan cuando cambie el origen.
 * Solo para uso en Server Components.
 */
export function imagenDisponible(src?: string): src is string {
  if (!src) return false;
  if (/^https?:\/\//.test(src)) return true;
  return existsSync(path.join(process.cwd(), "public", src));
}
