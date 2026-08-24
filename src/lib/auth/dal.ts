import { cache } from "react";
import { notFound } from "next/navigation";
import { ADMIN_HABILITADO } from "@/lib/auth/config";
import { getUsuario } from "@/lib/auth/session";
import { rolDe, type Rol } from "@/lib/auth/roles";
import type { Usuario } from "@/lib/types";

/**
 * Capa de acceso a datos de sesión. Todo lo que necesite saber quién está del
 * otro lado pasa por acá, y no por `getUsuario()` suelto.
 *
 * La razón de que exista: en el App Router el layout **no es un límite de
 * seguridad**. No se vuelve a ejecutar en las navegaciones del cliente, y no
 * corre para las Server Actions ni para los route handlers. Poner la guardia
 * sólo en `admin/layout.tsx` deja las acciones expuestas. Cada punto de
 * entrada tiene que pedir permiso por su cuenta, y esto lo hace barato.
 */

/** El usuario de la sesión, memoizado por render. */
export const usuarioActual = cache(getUsuario);

export interface Sesion {
  usuario: Usuario;
  rol: Rol;
}

/** Sesión con su rol resuelto, o null si no hay nadie. */
export const sesionActual = cache(async (): Promise<Sesion | null> => {
  const usuario = await usuarioActual();
  if (!usuario) return null;
  return { usuario, rol: await rolDe(usuario.id) };
});

/**
 * Exige administrador o corta con 404.
 *
 * 404 y no 403 a propósito: un 403 confirma que la ruta existe. Mientras el
 * panel no esté listo para producción, lo que no existe no se anuncia.
 */
export async function requerirAdmin(): Promise<Sesion> {
  if (!ADMIN_HABILITADO) notFound();
  const sesion = await sesionActual();
  if (!sesion || sesion.rol !== "admin") notFound();
  return sesion;
}

/**
 * Envuelve un route handler para que no se ejecute sin permiso.
 *
 * Devuelve un handler, no una respuesta que el llamador tenga que acordarse de
 * retornar: si la guardia falla, el handler original nunca se invoca. Un
 * `verificarAdmin()` que devuelve un `Response` para que otro lo propague se
 * olvida una vez y queda abierto.
 */
export function conAdmin<T extends unknown[]>(
  handler: (sesion: Sesion, ...args: T) => Promise<Response>,
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    if (!ADMIN_HABILITADO) {
      return new Response(null, { status: 404 });
    }
    const sesion = await sesionActual();
    if (!sesion || sesion.rol !== "admin") {
      return new Response(null, { status: 404 });
    }
    return handler(sesion, ...args);
  };
}
