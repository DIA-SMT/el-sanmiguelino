import { existsSync } from "node:fs";
import path from "node:path";

/** true si la imagen declarada en la nota existe físicamente en /public.
 *  Solo para uso en Server Components. */
export function imagenDisponible(src?: string): src is string {
  if (!src) return false;
  return existsSync(path.join(process.cwd(), "public", src));
}
