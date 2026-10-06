/**
 * Lo que la página le avisa al service worker (`public/sw.js`).
 *
 * Son dos mensajes, y los dos son avisos: el worker es el dueño de las cachés
 * y decide qué hacer. La página no guarda ni borra nada por su cuenta.
 */

/**
 * El worker ACTIVO del sitio, y no el `controller` de la página: el
 * `controller` es null en una página abierta con recarga forzada aunque el
 * worker y sus cachés sigan ahí. `getRegistration()` y no `ready`, porque
 * `ready` no resuelve nunca si no hay worker, y quien lo espere se queda
 * colgado —el cierre de sesión, por ejemplo—.
 */
async function worker(): Promise<ServiceWorker | null> {
  if (!("serviceWorker" in navigator)) return null;
  const registro = await navigator.serviceWorker.getRegistration();
  return registro?.active ?? null;
}

/**
 * Borra las páginas del diario guardadas para leer sin conexión. Va al cerrar
 * sesión. Lo guardado es la versión sin sesión de cada página —sin nombre—,
 * así que esto es higiene: que en un teléfono compartido no quede la lista de
 * qué notas leyó quien estaba adentro.
 */
export async function olvidarPaginasGuardadas(): Promise<void> {
  (await worker())?.postMessage({ tipo: "olvidar-paginas" });
}

/**
 * Le dice al worker qué ruta está en pantalla. Con eso guarda las páginas que
 * se abren por navegación interna, que para el navegador no son navegaciones
 * sino pedidos RSC, y el worker los deja pasar sin guardarlos a propósito. El
 * porqué completo está en `public/sw.js`.
 */
export async function avisarRutaMostrada(ruta: string): Promise<void> {
  (await worker())?.postMessage({ tipo: "mostrando", ruta });
}
