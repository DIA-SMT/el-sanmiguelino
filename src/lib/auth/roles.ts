import { cache } from "react";
import { ES_SSO_REAL } from "@/lib/auth/config";

export type Rol = "lector" | "editor" | "admin";

/**
 * El rol de un usuario.
 *
 * **No sale del token.** El token lleva identidad y vencimiento, nada más, y
 * es una decisión deliberada: un permiso guardado adentro de un token firmado
 * es permanente, no revocable y no auditable. Bajar a alguien de administrador
 * en Cidituc no haría absolutamente nada hasta rotar el secreto de firma, y
 * rotarlo desloguea a todos los lectores del diario. Se resuelve por consulta
 * del lado servidor en cada request, memoizada por render con `cache()`.
 *
 * Hoy devuelve siempre "lector", y eso es lo correcto: mientras el login sea
 * un POST sin credenciales que devuelve la misma identidad para todo el mundo,
 * cualquier rama que otorgue permisos se los otorga a cualquiera. La primera
 * condición corta antes de mirar nada más.
 */
export const rolDe = cache(async (usuarioId: string): Promise<Rol> => {
  // Sin SSO real no hay identidad verificable, así que no hay privilegio
  // posible. Va primero a propósito: ninguna configuración posterior —ni una
  // lista de ids, ni una fila en la base— puede saltearse esta guarda.
  if (!ES_SSO_REAL) return "lector";

  // Etapa 4: acá va la consulta a la tabla de usuarios en Supabase, que pasa a
  // ser la fuente de verdad provisoria hasta que Cidituc entregue el rol en el
  // perfil. Mientras tanto, el default sigue cerrado.
  void usuarioId;
  return "lector";
});
