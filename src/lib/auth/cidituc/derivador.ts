/**
 * La URL de la pantalla de ingreso municipal.
 *
 * El `#` no es decorativo: el derivador usa HashRouter y sin él te expulsa a
 * `ciudaddigital.smt.gob.ar`, que es otro sitio. Por eso `CIDITUC_DERIVADOR_URL`
 * lleva el **origen solo** y el `#/login` lo pone acá: una variable de entorno
 * con un `#` adentro es un accidente esperando —en un `.env` sin comillas, el `#`
 * abre comentario y se come el resto de la línea, así que se pierde `/login` y
 * queda una URL que parece bien hasta que alguien la usa—.
 *
 * Es pura y no importa nada a propósito: `scripts/verificar-cidituc.mjs` corre
 * **esta misma función**, no una copia que algún día queda vieja.
 */
export function urlDelDerivador(
  origen: string,
  clave: string,
  nonce: string,
): string {
  const url = new URL(origen);
  url.hash = `/login?${new URLSearchParams({ next: clave, state: nonce })}`;
  return url.toString();
}
