/**
 * Las direcciones del login de Ciudad Digital (repo `cidituc`,
 * `ciudaddigital.smt.gob.ar`).
 *
 * Ese login guarda el token en el navegador y no lo borra al devolver a la
 * persona: quien ya entró una vez vuelve sin poner la contraseña, y redirige
 * apenas ve un token guardado, sin confirmar que siga válido. Por eso, además
 * del ingreso, hay dos direcciones que lo borran con `?logout=1` —el sitio lo
 * lee en la query real, antes del `#`—: el reintento después de un token que no
 * sirvió, y el cierre de sesión, que vuelve al inicio del diario.
 *
 * El `#` no es decorativo: el login usa HashRouter. Por eso `CIDITUC_LOGIN_URL`
 * lleva el **origen solo** y el `#/login` lo pone acá: una variable de entorno
 * con un `#` adentro es un accidente esperando —en un `.env` sin comillas, el
 * `#` abre comentario y se come el resto de la línea, así que se pierde
 * `/login` y queda una URL que parece bien hasta que alguien la usa—.
 *
 * Es pura y no importa nada a propósito: `scripts/verificar-cidituc.mjs` corre
 * **estas mismas funciones**, no una copia que algún día queda vieja.
 */

/**
 * El ingreso. Con `limpiar`, el login borra antes el token que tenga guardado:
 * si no, uno vencido vuelve una y otra vez, y en una computadora compartida
 * quien reintenta choca con la cuenta de la persona anterior.
 */
export function urlDelLogin(
  origen: string,
  clave: string,
  nonce: string,
  limpiar = false,
): string {
  const url = new URL(origen);
  if (limpiar) url.searchParams.set("logout", "1");
  url.hash = `/login?${new URLSearchParams({ next: clave, state: nonce })}`;
  return url.toString();
}

/**
 * El cierre de la sesión de Ciudad Digital en este navegador. Con `salir=1` el
 * login, después de borrar el token, devuelve a la persona al inicio del diario
 * en vez de dejarla en su portada.
 */
export function urlDeSalida(origen: string, clave: string): string {
  const url = new URL(origen);
  url.searchParams.set("logout", "1");
  url.hash = `/login?${new URLSearchParams({ next: clave, salir: "1" })}`;
  return url.toString();
}
