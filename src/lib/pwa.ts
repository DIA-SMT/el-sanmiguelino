/**
 * Lo que la página le pide al service worker (`public/sw.js`).
 *
 * Es un solo mensaje. El worker es el dueño de las cachés y el único que las
 * borra; la página sólo avisa.
 */

/**
 * Borra las páginas del diario guardadas para leer sin conexión. Va al cerrar
 * sesión: lo guardado es lo que vio quien estaba adentro, con su nombre en la
 * cabecera, y en un teléfono compartido lo abriría el siguiente.
 *
 * `getRegistration()` y no `ready`: `ready` no resuelve nunca si no hay worker,
 * y el cierre de sesión se quedaría esperando. Se le habla al worker ACTIVO y no
 * al `controller`, que es null en una página abierta con recarga forzada aunque
 * las cachés sigan ahí.
 */
export async function olvidarPaginasGuardadas(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registro = await navigator.serviceWorker.getRegistration();
  registro?.active?.postMessage("olvidar-paginas");
}
