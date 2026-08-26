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
 * ¿El panel puede pedir rol de administrador de verdad?
 *
 * Sólo en producción. Fuera de ella no tiene sentido: el login es un mock que
 * devuelve la misma identidad a cualquiera que apriete el botón, así que
 * exigir un rol sería teatro —la única forma de tenerlo sería inventárselo, y
 * un rol inventado no distingue a nadie de nadie—.
 *
 * La consecuencia deliberada es que **en desarrollo cualquier sesión válida
 * entra al panel**, y en producción **el panel no existe** hasta que haya SSO
 * real. Las dos mitades son la misma decisión: mientras la identidad no se
 * pueda verificar, o el panel es local o no es.
 */
const EXIGE_ROL = process.env.NODE_ENV === "production";

/**
 * ¿Quien está del otro lado puede entrar al panel? Sin cortar nada.
 *
 * Misma regla que `requerirAdmin()`, en versión pregunta. Existe para los
 * casos donde no hay que negar el acceso sino decidir qué mostrar —la vista
 * previa de una edición futura en el diario, por ejemplo—, y donde tirar un 404
 * sería absurdo.
 */
export async function esAdmin(): Promise<boolean> {
  const sesion = await sesionActual();
  if (!sesion) return false;
  if (!EXIGE_ROL) return true;
  return ADMIN_HABILITADO && sesion.rol === "admin";
}

/**
 * Exige permiso para el panel, o corta con 404.
 *
 * 404 y no 403 a propósito: un 403 confirma que la ruta existe. Lo que no está
 * listo no se anuncia.
 *
 * La sesión se lee ANTES del interruptor, y eso no es cosmético: leer la
 * cookie es una API dinámica de Next, y es lo que evita que `/admin` se
 * prerenderice como un 404 estático al compilar. Con el orden al revés, la
 * guardia cortaba antes de tocar cookies, Next horneaba la página y prender el
 * interruptor después ya no servía de nada sin volver a desplegar.
 */
export async function requerirAdmin(): Promise<Sesion> {
  const sesion = await sesionActual();
  if (!sesion) notFound();
  if (!EXIGE_ROL) return sesion;
  if (!ADMIN_HABILITADO) notFound();
  if (sesion.rol !== "admin") notFound();
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
    const sesion = await sesionActual();
    if (!sesion) return new Response(null, { status: 404 });
    if (EXIGE_ROL) {
      if (!ADMIN_HABILITADO) return new Response(null, { status: 404 });
      if (sesion.rol !== "admin") return new Response(null, { status: 404 });
    }
    return handler(sesion, ...args);
  };
}
