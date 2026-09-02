import { cache } from "react";
import { notFound } from "next/navigation";
import { ADMIN_HABILITADO } from "@/lib/auth/config";
import { getUsuario } from "@/lib/auth/session";
import { permisoDe, type Rol } from "@/lib/auth/roles";
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
  /**
   * Bloqueado en la tabla de usuarios.
   *
   * Se resuelve en cada request y no viaja en el token: es lo que hace que
   * bloquear a alguien surta efecto en el pedido siguiente, y no cuando se le
   * vence la cookie ocho horas después.
   */
  bloqueado: boolean;
  /** El rol vino de `CIDITUC_ADMINS` y la tabla no lo puede cambiar. */
  porEntorno: boolean;
}

/** Sesión con su permiso resuelto, o null si no hay nadie. */
export const sesionActual = cache(async (): Promise<Sesion | null> => {
  const usuario = await usuarioActual();
  if (!usuario) return null;
  // El orden es load-bearing: la cookie se lee ANTES de resolver el permiso.
  // Leer cookies es lo que vuelve dinámica la ruta, y es lo que evita que /admin
  // se hornee como 404 estático al compilar — ver `requerirAdmin()`.
  return { usuario, ...(await permisoDe(usuario.id)) };
});

/**
 * ¿Puede participar? Comentar, votar, preguntarle a Migue, suscribirse.
 *
 * Devuelve el motivo en vez de un `Response` porque las rutas que la usan arman
 * su propio JSON, y para que este archivo no tenga que importar `next/server`.
 * Cada llamador mapea: `sin-sesion` → 401 —que es lo que responden hoy— y
 * `bloqueado` → 403. Que sean dos códigos distintos importa: el proxy ya devuelve
 * 401 para "no autenticado", y el cliente tiene que poder decir otra cosa.
 *
 * Existe porque las rutas de `/api` llaman a `getUsuario()` en directo y saltean
 * este archivo, así que sin esto el bloqueo no tendría dientes justo donde la
 * persona bloqueada *hace* algo.
 */
export async function sesionParaParticipar(): Promise<
  | { ok: true; usuario: Usuario }
  | { ok: false; motivo: "sin-sesion" | "bloqueado" }
> {
  const sesion = await sesionActual();
  if (!sesion) return { ok: false, motivo: "sin-sesion" };
  if (sesion.bloqueado) return { ok: false, motivo: "bloqueado" };
  return { ok: true, usuario: sesion.usuario };
}

/**
 * Nota sobre desarrollo: acá hubo una excepción que dejaba entrar al panel a
 * cualquier sesión fuera de producción. Tenía sentido mientras el login era un
 * mock que le daba la misma identidad a todo el mundo —pedir un rol habría sido
 * teatro—. Con el ingreso real de Cidituc la identidad es verificable también en
 * desarrollo, así que la excepción se borró: la regla es una sola en los dos
 * lados. Para trabajar en el panel, poné tu `id_persona` en `CIDITUC_ADMINS`.
 */

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
  return ADMIN_HABILITADO && sesion.rol === "admin" && !sesion.bloqueado;
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
  if (!ADMIN_HABILITADO) notFound();
  // El bloqueo va AL LADO del rol y no en vez de: son dos preguntas distintas.
  // Un administrador bloqueado tiene que perder el panel en el pedido
  // siguiente, no cuando se le venza la cookie ocho horas despues.
  if (sesion.bloqueado) notFound();
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
    if (!ADMIN_HABILITADO) return new Response(null, { status: 404 });
    if (sesion.bloqueado) return new Response(null, { status: 404 });
    if (sesion.rol !== "admin") return new Response(null, { status: 404 });
    return handler(sesion, ...args);
  };
}
