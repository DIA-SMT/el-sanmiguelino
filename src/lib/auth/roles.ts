import { cache } from "react";
import { ADMINS_CIDITUC } from "@/lib/auth/config";

export type Rol = "lector" | "editor" | "admin";

/**
 * El rol de un usuario.
 *
 * **No sale del token.** El token lleva identidad y vencimiento, nada más, y es
 * una decisión deliberada: un permiso guardado adentro de un token firmado es
 * permanente, no revocable y no auditable. Bajar a alguien de administrador no
 * haría absolutamente nada hasta rotar el secreto de firma, y rotarlo desloguea a
 * todos los lectores del diario. Se resuelve del lado del servidor en cada
 * request, memoizado por render con `cache()`.
 *
 * De dónde sale hoy: de `CIDITUC_ADMINS`, la lista de `id_persona` que carga el
 * municipio en el entorno. Cidituc autentica pero **no dice quién administra el
 * diario**, así que esa lista es la fuente de verdad provisoria hasta que haya
 * una tabla propia. Vacía por default: sin nombres cargados no hay ningún
 * administrador, que es el default correcto.
 *
 * El id que se compara es el `id_persona` que devolvió el backend de Cidituc en
 * el ingreso, no algo que haya escrito el navegador: la sesión sólo se emite tras
 * validar el token contra el backend municipal.
 */
export const rolDe = cache(async (usuarioId: string): Promise<Rol> => {
  return ADMINS_CIDITUC.has(usuarioId) ? "admin" : "lector";
});
