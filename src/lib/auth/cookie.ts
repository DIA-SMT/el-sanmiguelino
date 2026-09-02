/**
 * Lo mínimo de la sesión que necesita el proxy: el nombre de la cookie y un
 * chequeo estructural del token.
 *
 * Vive aparte de `session.ts` a propósito. El proxy corre antes que todo y la
 * documentación de Next avisa que puede llegar a desplegarse aparte del
 * render, así que no conviene que arrastre `node:crypto` ni `next/headers`.
 * Acá no hay ninguna de las dos cosas.
 */

export const SESSION_COOKIE = "sanmiguelino_session";

/**
 * Versión del formato del token. Subirla invalida todas las sesiones vivas, que
 * es justamente lo que hay que poder hacer al cambiar el payload.
 *
 * Subió a 2 el 2026-09-01, al entrar el ingreso real de Cidituc. El payload no
 * cambió de forma, pero sí de significado: el `id` pasó de ser el
 * `cidituc-demo-001` que repartía el mock a ser el `id_persona` de una persona
 * real. Una sesión emitida por el mock, firmada con el mismo secreto y el mismo
 * nombre de cookie, seguiría validando — y ahora `permisoDe()` la resuelve
 * contra la lista del entorno y la tabla de usuarios. Un renglón para que
 * ninguna sobreviva.
 */
export const VERSION_TOKEN = 2;

/** Ocho horas. Antes eran 30 días y sin `exp` adentro del token: el vencimiento
 *  vivía sólo en el `maxAge` de la cookie, o sea del lado del cliente, así que
 *  un token copiado servía para siempre. */
export const TTL_SESION_SEG = 60 * 60 * 8;

function base64urlADecodificable(valor: string): string {
  const base64 = valor.replace(/-/g, "+").replace(/_/g, "/");
  const sobra = base64.length % 4;
  return sobra === 0 ? base64 : base64 + "=".repeat(4 - sobra);
}

/**
 * ¿La cookie está vencida o es de un formato viejo?
 *
 * Es un chequeo **estructural**: decodifica el payload y mira versión y
 * vencimiento, sin verificar la firma. Eso es a propósito y hay que tenerlo
 * claro: esto es UX, no seguridad. Sirve para que el proxy pueda distinguir
 * "no hay cookie" de "hay una cookie muerta" y borrarla, que es lo que evita
 * el bucle infinito entre /login y /diario. La firma la verifica
 * `verificarToken()` del lado del servidor, y el permiso lo resuelve el rol.
 */
export function cookieMuerta(valor: string | undefined): boolean {
  if (!valor) return true;
  const payload = valor.split(".")[0];
  if (!payload) return true;

  try {
    const bytes = Uint8Array.from(
      atob(base64urlADecodificable(payload)),
      (c) => c.charCodeAt(0),
    );
    const datos = JSON.parse(new TextDecoder().decode(bytes));
    if (datos?.v !== VERSION_TOKEN) return true;
    if (typeof datos.exp !== "number") return true;
    return datos.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}
