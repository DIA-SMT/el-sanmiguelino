import "server-only";
import { db } from "@/lib/db";
import { ADMINS_CIDITUC } from "@/lib/auth/config";

/**
 * Quién entró por Cidituc y qué puede hacer.
 *
 * Lleva `server-only` —que no todos los repos tienen— por lo mismo que
 * `suscripciones.ts`: es una lista nominal de vecinos identificados con su
 * `id_persona`, y no puede llegar al navegador por un import distraído.
 *
 * Importa `ADMINS_CIDITUC` de `auth/config` y eso **no cierra ciclo**:
 * `config.ts` no importa nada, es hoja. Lo que este archivo no puede importar es
 * `auth/dal` ni `auth/roles`, porque `roles.ts` importa a éste.
 *
 * Por eso `Rol` se declara acá abajo estructuralmente y no se importa: el tipo
 * canónico vive en `roles.ts`, y ese archivo comprueba que coincidan.
 */

/** Los roles, en el orden en que crece el permiso. Duplicado a propósito de
 *  `roles.ts` para no cerrar un ciclo de imports; allá hay un chequeo de tipos
 *  que rompe la compilación si las dos listas dejan de coincidir. */
export type RolGuardado = "lector" | "editor" | "admin";

export interface UsuarioDelPanel {
  id: string;
  nombre: string;
  rol: RolGuardado;
  bloqueado: boolean;
  /** Cuándo se registró: la primera vez que entró. No se pisa nunca. */
  creadoEn: string;
  /** ISO y no `Date`: es lo que cruza al cliente como JSON, y `tiempoRelativo`
   *  espera un string. */
  ultimoIngreso: string;
  cambiadoPor: string | null;
  cambiadoEn: string | null;
}

/** Lo mínimo que necesita `permisoDe()`. Sin nombre: no lo mira. */
export interface PermisoGuardado {
  /** El texto CRUDO de la base. La validación contra los roles conocidos es una
   *  sola y vive en `roles.ts`, que es donde el texto deja de ser una fila de
   *  Postgres. Duplicarla acá daría dos bordes que se pueden desincronizar. */
  rol: string;
  bloqueado: boolean;
}

const HAY_BASE = Boolean(process.env.DATABASE_URL);

/* --------------------------------------------------------------- lectura */

/** La fila de permisos de una persona, o `null` si nunca entró. */
export async function permisoGuardado(
  id: string,
): Promise<PermisoGuardado | null> {
  return db().usuario.findUnique({
    where: { id },
    select: { rol: true, bloqueado: true },
  });
}

/** Las columnas que el panel muestra de una persona. Escritas una vez porque
 *  el listado y las dos escrituras tienen que devolver exactamente lo mismo:
 *  si una se olvida un campo, la fila vuelve del servidor a medio llenar. */
const COLUMNAS_DEL_PANEL = {
  id: true,
  nombre: true,
  rol: true,
  bloqueado: true,
  creadoEn: true,
  ultimoIngreso: true,
  cambiadoPor: true,
  cambiadoEn: true,
} as const;

/**
 * Todos, del que se registró más recién al más viejo. Para el panel.
 *
 * **El orden es por fecha de registro y no por último ingreso**, que es lo que
 * hacía antes. La diferencia importa: ordenada por ingreso, la lista se
 * rebaraja sola cada vez que alguien abre el diario, así que volver a la
 * persona que estabas mirando es buscarla de nuevo. Por alta, el orden es
 * estable y contesta la pregunta que de verdad se le hace a esta pantalla:
 * quién se sumó último.
 *
 * El otro orden no se pierde: la pantalla lo ofrece y lo resuelve en memoria,
 * porque la lista llega entera igual —las cuentas de los chips la necesitan— y
 * una segunda consulta para reordenar lo que ya está en la mano es un viaje al
 * pedo.
 */
export async function listarUsuarios(): Promise<UsuarioDelPanel[]> {
  const filas = await db().usuario.findMany({
    orderBy: { creadoEn: "desc" },
    select: COLUMNAS_DEL_PANEL,
  });
  return filas.map(paraElPanel);
}

/** De la fila de Postgres a lo que cruza al cliente: los `Date` como ISO, y el
 *  rol crudo validado contra los que este código conoce. */
function paraElPanel(fila: {
  id: string;
  nombre: string;
  rol: string;
  bloqueado: boolean;
  creadoEn: Date;
  ultimoIngreso: Date;
  cambiadoPor: string | null;
  cambiadoEn: Date | null;
}): UsuarioDelPanel {
  return {
    ...fila,
    rol: normalizar(fila.rol),
    creadoEn: fila.creadoEn.toISOString(),
    ultimoIngreso: fila.ultimoIngreso.toISOString(),
    cambiadoEn: fila.cambiadoEn?.toISOString() ?? null,
  };
}

/**
 * De un puñado de `id_persona`, cuáles están en el padrón y cuáles bloqueados.
 *
 * Existe para la pantalla de moderación, que ofrece bloquear a quien escribió
 * un comentario y necesita saber dos cosas antes de dibujar el botón: si esa
 * persona existe acá —los comentarios de la época del login de mentira traen
 * ids que no son de nadie— y si no está bloqueada ya.
 *
 * Devuelve un mapa y no una lista: la pantalla pregunta por id, y "no está en
 * el mapa" es exactamente "no está en el padrón". Una consulta sola para toda
 * la lista, no una por comentario.
 */
export async function bloqueosDe(
  ids: string[],
): Promise<Map<string, boolean>> {
  const unicos = [...new Set(ids)].filter(Boolean);
  if (unicos.length === 0) return new Map();
  const filas = await db().usuario.findMany({
    where: { id: { in: unicos } },
    select: { id: true, bloqueado: true },
  });
  return new Map(filas.map((f) => [f.id, f.bloqueado]));
}

/** Mismo criterio que `roles.ts`: lo desconocido cae a "lector", lo menos. */
function normalizar(crudo: string): RolGuardado {
  return crudo === "admin" || crudo === "editor" || crudo === "lector"
    ? crudo
    : "lector";
}

/* -------------------------------------------------------------- escritura */

/**
 * Anota el ingreso. **Nunca tira**, ni siquiera si la base no está.
 *
 * Mismo criterio que `registrarConsulta()` en `repos/migue.ts`: que la persona
 * entre vale más que que nosotros tengamos la fila. Y acá hay un argumento
 * propio, más fuerte: si el ingreso dependiera de la base, con Supabase caído
 * nadie conseguiría sesión —tampoco el administrador que está en
 * `CIDITUC_ADMINS`—, y la red anti-lockout no serviría justo cuando se la
 * necesita.
 *
 * Se **espera** el upsert en vez de dispararlo y seguir: en serverless la
 * función puede terminar apenas se manda la respuesta, y una promesa suelta se
 * cancela a mitad de camino.
 *
 * Devuelve si la persona está bloqueada, para que el callback no le emita
 * sesión. Si no se pudo consultar devuelve `false`: "no sé" no puede cerrarle la
 * puerta a nadie.
 */
export async function registrarIngreso(datos: {
  id: string;
  nombre: string;
}): Promise<{ bloqueado: boolean }> {
  if (!HAY_BASE) return { bloqueado: false };
  try {
    const fila = await db().usuario.upsert({
      where: { id: datos.id },
      // `creadoEn` no se escribe: lo pone el default de la columna, y así queda
      // claro que esta fecha se fija una sola vez.
      create: { id: datos.id, nombre: datos.nombre },
      // En el update van SÓLO estos dos campos. Sumar `rol` o `bloqueado` acá
      // haría que cada ingreso reponga el permiso de fábrica: un administrador
      // volvería a lector y un bloqueado se desbloquearía solo. Falla en
      // silencio —anda perfecto hasta que la persona vuelve a entrar— y deja el
      // panel entero de adorno. Y sumar `creadoEn` borraría la fecha de alta de
      // todo el padrón, un ingreso por vez.
      update: { nombre: datos.nombre, ultimoIngreso: new Date() },
      select: { bloqueado: true },
    });
    return { bloqueado: fila.bloqueado };
  } catch (error) {
    // En producción se traga; en desarrollo avisa, porque si no el registro
    // puede estar roto durante semanas sin que nadie se entere.
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[usuarios] no se pudo registrar el ingreso:",
        error instanceof Error ? error.message : error,
      );
    }
    return { bloqueado: false };
  }
}

export type ResultadoCambio =
  | { ok: true; usuario: UsuarioDelPanel }
  | {
      ok: false;
      motivo:
        /** No existe la fila: esa persona nunca ingresó. */
        | "inexistente"
        /** Está en `CIDITUC_ADMINS`, así que la tabla no lo puede tocar. */
        | "es-del-entorno"
        /** Dejaría al diario sin ningún administrador efectivo. */
        | "ultimo-admin"
        /** Nadie se bloquea a sí mismo. */
        | "uno-mismo";
    };

/**
 * ¿Cuántos administradores quedarían si se aplicara este cambio?
 *
 * Efectivos = los de `CIDITUC_ADMINS` **más** las filas con `rol = "admin"` y
 * `bloqueado = false`. Con la lista del entorno cargada esta regla no muerde
 * nunca; muerde justo cuando el municipio decide confiar sólo en el panel, que
 * es cuando hace falta.
 */
async function quedaraAlgunAdmin(
  tx: Parameters<Parameters<ReturnType<typeof db>["$transaction"]>[0]>[0],
  id: string,
  seguiraSiendoAdmin: boolean,
): Promise<boolean> {
  if (ADMINS_CIDITUC.size > 0) return true;
  if (seguiraSiendoAdmin) return true;
  const otros = await tx.usuario.count({
    where: { rol: "admin", bloqueado: false, id: { not: id } },
  });
  return otros > 0;
}

/**
 * Las dos escrituras comparten guardias, y las guardias viven **acá adentro** y
 * no en la Server Action ni en la pantalla.
 *
 * Es la lección de `dal.ts` aplicada a la escritura: los puntos de entrada se
 * multiplican solos —hoy un formulario, mañana un route handler, un script— y
 * una invariante puesta en el punto de entrada se pierde en el primero que se
 * agregue. La pantalla deshabilita el botón para **explicar**, no para impedir.
 *
 * Tampoco puede vivir en Postgres: "al menos una fila con rol admin"
 * necesitaría un trigger, y aunque lo tuviera no conocería `CIDITUC_ADMINS`, que
 * es la mitad del conjunto. La invariante es mixta entorno + tabla, así que sólo
 * puede vivir en la aplicación.
 *
 * Va en una transacción `Serializable` porque la carrera es real: dos
 * administradores degradándose a la vez cuentan uno al otro, los dos pasan, y
 * quedan cero. En el `READ COMMITTED` que Postgres usa por default el `count`
 * previo no bloquea nada.
 */
async function cambiar(
  id: string,
  quien: string,
  aplicar: (actual: { rol: RolGuardado; bloqueado: boolean }) => {
    rol?: RolGuardado;
    bloqueado?: boolean;
  },
  esBloqueoPropio: boolean,
): Promise<ResultadoCambio> {
  if (ADMINS_CIDITUC.has(id)) return { ok: false, motivo: "es-del-entorno" };
  if (esBloqueoPropio && id === quien) return { ok: false, motivo: "uno-mismo" };

  return db().$transaction(
    async (tx) => {
      const fila = await tx.usuario.findUnique({
        where: { id },
        select: { rol: true, bloqueado: true },
      });
      if (!fila) return { ok: false as const, motivo: "inexistente" as const };

      const actual = { rol: normalizar(fila.rol), bloqueado: fila.bloqueado };
      const cambios = aplicar(actual);
      const rolFinal = cambios.rol ?? actual.rol;
      const bloqueadoFinal = cambios.bloqueado ?? actual.bloqueado;

      const seguiraSiendoAdmin = rolFinal === "admin" && !bloqueadoFinal;
      if (!(await quedaraAlgunAdmin(tx, id, seguiraSiendoAdmin))) {
        return { ok: false as const, motivo: "ultimo-admin" as const };
      }

      const guardada = await tx.usuario.update({
        where: { id },
        data: {
          rol: rolFinal,
          bloqueado: bloqueadoFinal,
          cambiadoPor: quien,
          cambiadoEn: new Date(),
        },
        select: COLUMNAS_DEL_PANEL,
      });

      return { ok: true as const, usuario: paraElPanel(guardada) };
    },
    { isolationLevel: "Serializable" },
  );
}

export function cambiarRol(
  id: string,
  rol: RolGuardado,
  quien: string,
): Promise<ResultadoCambio> {
  return cambiar(id, quien, () => ({ rol }), false);
}

export function cambiarBloqueo(
  id: string,
  bloqueado: boolean,
  quien: string,
): Promise<ResultadoCambio> {
  // El chequeo de "uno mismo" sólo aplica al BLOQUEO, y sólo al ponerlo:
  // degradarse está permitido si queda otro administrador —lo cubre la regla del
  // último admin—, pero bloquearse es autoexpulsión inmediata sin ninguna
  // lectura razonable. Desbloquearse a uno mismo no puede pasar: si estabas
  // bloqueado no entraste al panel.
  return cambiar(id, quien, () => ({ bloqueado }), bloqueado);
}
