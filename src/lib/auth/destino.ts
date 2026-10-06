/**
 * A dónde se vuelve después de ingresar.
 *
 * Desde que leer es libre, el ingreso se pide en el medio de algo: comentar una
 * nota, votar, preguntarle a Migue, anotarse para el papel. Volver a la tapa
 * después de pasar por Cidituc es perder el lugar justo cuando la persona hizo
 * el esfuerzo de ingresar. Así que el destino viaja entero —ruta, `?` y `#`— y
 * se usa en tres lugares que tienen que decir lo mismo: los enlaces de
 * "Ingresar", la página `/login` y el callback de Cidituc. Sin `server-only`
 * porque los enlaces son componentes de cliente.
 */

export const DESTINO_POR_DEFECTO = "/diario";

/** Un origen que no existe, para que `URL` resuelva una ruta relativa y se
 *  pueda comparar si el resultado sigue siendo "de acá". */
const ORIGEN = "https://diario.invalid";

/**
 * ¿Es un destino de este sitio? Si no, la tapa.
 *
 * Se resuelve con `URL` y se exige que quede en el mismo origen. Con mirar el
 * texto no alcanza: `//otro.sitio`, `/\otro.sitio` o una barra seguida de un
 * tabulador son direcciones absolutas para el navegador aunque empiecen con
 * barra, y aceptarlas haría del ingreso un redirector abierto desde el dominio
 * municipal.
 *
 * Tampoco se vuelve a `/auth`, `/api` ni `/login`: volver al arranque del
 * ingreso lo relanza, y volver a `/login` es dar una vuelta en círculo.
 */
export function destinoSeguro(valor: string | null | undefined): string {
  if (!valor || !valor.startsWith("/")) return DESTINO_POR_DEFECTO;
  let url: URL;
  try {
    url = new URL(valor, ORIGEN);
  } catch {
    return DESTINO_POR_DEFECTO;
  }
  if (url.origin !== ORIGEN) return DESTINO_POR_DEFECTO;
  if (/^\/(?:auth|api|login)(?:\/|$)/.test(url.pathname)) {
    return DESTINO_POR_DEFECTO;
  }
  /*
   * El origen se mira ANTES de que `URL` normalice la ruta, y la normalización
   * puede fabricar una dirección de otro sitio: `/.//evil.com`, `/..//evil.com`
   * o `/%2e//evil.com` quedan en este origen al resolverse, pero su ruta
   * normalizada es `//evil.com`, que el navegador lee como OTRO sitio. Así que
   * el resultado se vuelve a resolver y tiene que seguir siendo de acá.
   */
  const destino = url.pathname + url.search + url.hash;
  if (destino.startsWith("//") || new URL(destino, ORIGEN).origin !== ORIGEN) {
    return DESTINO_POR_DEFECTO;
  }
  return destino;
}

/** El enlace a la pantalla de ingreso que, al terminar, vuelve a `destino`. */
export function rutaDeIngreso(destino: string): string {
  const seguro = destinoSeguro(destino);
  return seguro === DESTINO_POR_DEFECTO
    ? "/login"
    : `/login?volverA=${encodeURIComponent(seguro)}`;
}
