import "server-only";
import { cache } from "react";
import { ADMINS_CIDITUC } from "@/lib/auth/config";
import { permisoGuardado, type RolGuardado } from "@/lib/repos/usuarios";

/**
 * `server-only` es nuevo acá y no es la convención uniforme del repo: se pone
 * porque este archivo ahora arrastra un repositorio con datos personales.
 */

export type Rol = "lector" | "editor" | "admin";

/**
 * El tipo canónico es `Rol`, pero `repos/usuarios.ts` declara el suyo para no
 * cerrar un ciclo de imports. Estas dos líneas no generan código: son la prueba
 * de que las dos listas coinciden, y si alguien suma un rol en un solo lado, esto
 * no compila.
 */
const _mismoRol: RolGuardado = null as unknown as Rol;
const _mismoRolAlReves: Rol = null as unknown as RolGuardado;
void _mismoRol;
void _mismoRolAlReves;

export interface Permiso {
  rol: Rol;
  bloqueado: boolean;
  /** El rol vino de `CIDITUC_ADMINS`. La tabla no lo puede cambiar, así que el
   *  panel tampoco lo ofrece: un control que guarda y no cambia nada es peor que
   *  uno que no existe. */
  porEntorno: boolean;
}

/**
 * Los roles conocidos, como objeto tipado y no como arreglo suelto: si mañana se
 * suma un valor a `Rol` y nadie lo agrega acá, esto no compila.
 */
const ROLES: Record<Rol, true> = { lector: true, editor: true, admin: true };

/**
 * El borde entre el texto crudo de la base y el tipo. Existe uno solo y está acá.
 *
 * `Object.hasOwn` y no `crudo in ROLES`: `in` también dice que sí para las claves
 * del prototipo, así que un rol guardado como "toString" pasaría.
 *
 * Lo desconocido cae a "lector" —lo menos— y no se afirma con `as`. El esquema
 * *promete* que van a aparecer valores que este código no conoce: `rol` es texto
 * y no enum justamente para que sumar uno no sea una migración con lock. Una
 * guardia escrita sobre un campo que nadie validó falla abierta.
 */
function rolConocido(crudo: string): Rol {
  return Object.hasOwn(ROLES, crudo) ? (crudo as Rol) : "lector";
}

const HAY_BASE = Boolean(process.env.DATABASE_URL);

/**
 * Qué puede hacer una persona.
 *
 * **No sale del token.** El token lleva identidad y vencimiento, nada más: un
 * permiso guardado adentro de un token firmado es permanente, no revocable y no
 * auditable, y rotar el secreto de firma para revocarlo desloguea a todos los
 * lectores del diario. Se resuelve del lado del servidor en cada request,
 * memoizado por render con `cache()`. Eso es lo que hace que bajar a alguien de
 * administrador —o bloquearlo— tenga efecto en el pedido siguiente, y no dentro
 * de ocho horas.
 *
 * De dónde sale, y en este orden:
 *
 * 1. **`CIDITUC_ADMINS`**, y gana ANTES de tocar la base. Dejó de ser la fuente
 *    provisoria: ahora es la red anti-lockout permanente. Una red que necesita
 *    que Supabase responda no es una red — con la base caída, o con un clic
 *    equivocado en la pantalla de usuarios, tiene que seguir habiendo alguien
 *    que pueda entrar a arreglarlo. Por eso a alguien de esta lista tampoco se le
 *    puede poner `bloqueado`: si se pudiera, la pantalla sería la forma de dejar
 *    al diario sin administradores por accidente.
 * 2. **Sin base, `lector`.** `db()` tira si falta `DATABASE_URL`, y el repo está
 *    armado a propósito para poder clonarse y mirar el diario sin credenciales.
 *    Preguntar acá es lo que mantiene el ingreso andando en un clon limpio; y con
 *    `CIDITUC_ADMINS` cargada se sigue entrando al panel.
 * 3. **La tabla.** Sin fila, `lector`: es alguien que todavía no ingresó.
 *
 * El id que se compara es el `id_persona` que devolvió el backend de Cidituc, no
 * algo que haya escrito el navegador.
 */
export const permisoDe = cache(async (usuarioId: string): Promise<Permiso> => {
  if (ADMINS_CIDITUC.has(usuarioId)) {
    return { rol: "admin", bloqueado: false, porEntorno: true };
  }

  if (!HAY_BASE) return { rol: "lector", bloqueado: false, porEntorno: false };

  try {
    const fila = await permisoGuardado(usuarioId);
    if (!fila) return { rol: "lector", bloqueado: false, porEntorno: false };
    return {
      rol: rolConocido(fila.rol),
      bloqueado: fila.bloqueado,
      porEntorno: false,
    };
  } catch (error) {
    // **Nunca se propaga**, y el radio de explosión es más grande de lo que
    // parece. Un throw acá sale como 500 en /admin —saltea el `notFound()` de
    // `requerirAdmin()`, que es toda la política de no anunciar lo que no está
    // listo— y, vía `esAdmin()` → `edicionEnFoco()`, voltea la capa de lectura
    // entera del diario para cualquiera que tenga puesta la cookie de vista
    // previa.
    //
    // Se cae del lado seguro de cada eje, y en cada eje es uno distinto:
    // - `rol: "lector"`: una caída de la base no reparte permisos.
    // - `bloqueado: false`: "no sé" vale para TODAS las personas a la vez, así
    //   que asumir bloqueo cerraría el diario a la ciudad entera por una
    //   consulta fallida. No es una preferencia, es aritmética.
    console.error(
      `No se pudo resolver el permiso de ${usuarioId} contra la base:`,
      error instanceof Error ? error.message : error,
    );
    return { rol: "lector", bloqueado: false, porEntorno: false };
  }
});
