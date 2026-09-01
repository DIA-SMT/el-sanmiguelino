/**
 * Gate de Cidituc: ACTIVO. La landing (/), /login y las rutas del ingreso son
 * públicas; el diario completo requiere sesión.
 *
 * Para desarrollo se puede apagar con `AUTH_CIDITUC=0`. Ojo: apagarlo deja pasar
 * a todo el mundo *sin sesión*, así que tampoco hay usuario — no es una forma de
 * entrar al panel, es una forma de leer el diario sin ingresar.
 */
export const AUTH_CIDITUC_OBLIGATORIA = process.env.AUTH_CIDITUC !== "0";

function limpio(valor: string | undefined): string {
  return valor?.trim() ?? "";
}

/**
 * La pantalla de ingreso del municipio. Va el **origen solo**, sin `#`: el
 * `#/login` lo agrega `urlDelDerivador()`.
 *
 * Y es a propósito. La URL completa lleva un `#`, que en un `.env` sin comillas
 * abre comentario y se come `/login`: queda una URL que parece bien hasta que
 * alguien la usa. Manteniendo el fragmento en el código, esa trampa no existe.
 */
export const CIDITUC_DERIVADOR = limpio(process.env.CIDITUC_DERIVADOR_URL);

/** El backend contra el que se valida el token. Sin barra final. */
export const CIDITUC_API = limpio(process.env.CIDITUC_API_URL).replace(
  /\/+$/,
  "",
);

/** La URL de retorno. Tiene que ser **la misma** registrada en el derivador. */
export const CIDITUC_CALLBACK = limpio(process.env.CIDITUC_CALLBACK_URL);

/** La clave con la que el derivador nos identifica: `?next=<clave>`. */
export const CIDITUC_CLAVE =
  limpio(process.env.CIDITUC_CLAVE_APP) || "sanmiguelino";

/**
 * ¿Está la integración completa como para mandar a alguien a Cidituc?
 *
 * Es una comprobación de configuración, no un control de seguridad, y la
 * diferencia importa: acá ya no hay un login mock detrás. Con esto en `false` no
 * existe *ninguna* manera de conseguir una sesión, porque el único emisor es el
 * callback y el callback exige un token que valida el backend municipal. Antes
 * hacía falta un interruptor con credencial porque el mock repartía identidades
 * a cualquiera; ahora el que no se puede falsificar es el token.
 */
export const CIDITUC_CONFIGURADO =
  process.env.CIDITUC_HABILITADO === "1" &&
  Boolean(CIDITUC_DERIVADOR && CIDITUC_API && CIDITUC_CALLBACK);

/**
 * Los `id_persona` de Cidituc que administran el diario, separados por coma.
 *
 * Es la fuente de verdad **provisoria**: Cidituc autentica pero no dice quién es
 * administrador, así que esa lista la pone el municipio hasta que exista una
 * tabla propia. Vacía por default, que es lo correcto — sin nombres cargados no
 * hay ningún administrador.
 *
 * Va en el entorno y no en el código para que agregar o sacar a alguien no
 * necesite un commit, y para que la lista no quede publicada en el repositorio.
 */
export const ADMINS_CIDITUC: ReadonlySet<string> = new Set(
  limpio(process.env.CIDITUC_ADMINS)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);

/**
 * Interruptor de existencia de /admin. Sin esto, esas rutas responden 404 —no un
 * redirect, para no anunciar que existen—.
 *
 * Son tres llaves independientes y en AND: la sesión tiene que venir de un token
 * que validó el backend de Cidituc, el `id_persona` tiene que estar en
 * `CIDITUC_ADMINS`, y además esto tiene que estar prendido. Desplegar el repo tal
 * cual, sin tocar variables: /admin es 404 para todos.
 */
export const ADMIN_HABILITADO = process.env.ADMIN_HABILITADO === "1";
