/**
 * Gate de Cidituc: ACTIVO. La landing (/) y /login son públicas; el diario
 * completo requiere sesión. Mientras no esté la integración real, el login usa
 * el adapter mock — ver src/lib/auth/cidituc.ts.
 * Para desarrollo se puede apagar el gate con AUTH_CIDITUC=0.
 */
export const AUTH_CIDITUC_OBLIGATORIA = process.env.AUTH_CIDITUC !== "0";

/**
 * ¿Estamos contra el SSO real de Cidituc, o contra el mock?
 *
 * No alcanza con una variable de configuración: se exige además la presencia
 * de un secreto de cliente, que sólo puede emitir el equipo de Cidituc. Un
 * interruptor que cualquiera puede prender no es un control de seguridad; una
 * credencial que no se tiene, sí.
 *
 * Mientras esto sea false, `rolDe()` devuelve siempre "lector" y no existe el
 * rol de administrador. Ese es el default seguro.
 */
export const ES_SSO_REAL =
  process.env.AUTH_CIDITUC_MODO === "sso" &&
  Boolean(process.env.CIDITUC_CLIENT_SECRET);

/**
 * Interruptor de existencia de /admin. Sin esto, esas rutas responden 404 —no
 * un redirect, para no anunciar que existen—. Va en AND con `ES_SSO_REAL`:
 * ninguna combinación de variables abre el panel mientras el login sea el mock.
 */
export const ADMIN_HABILITADO = process.env.ADMIN_HABILITADO === "1";
