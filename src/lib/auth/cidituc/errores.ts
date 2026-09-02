/**
 * Por qué alguien puede no haber entrado, y qué se le dice.
 *
 * Se distinguen a propósito: un genérico "no se pudo ingresar" no deja ninguna
 * pista de qué arreglar, y cada uno de estos se arregla en un lugar distinto —el
 * entorno, el derivador, el backend municipal, o el navegador de la persona—.
 *
 * Este módulo no importa nada. Es a propósito: lo lee la pantalla de ingreso
 * para mostrar el mensaje, y no tiene por qué arrastrar hasta ahí el transporte
 * HTTPS ni la configuración del servidor.
 */

/** Lo que puede decir la validación del token contra el backend. */
export type MotivoRechazo =
  /** Faltan variables: el sitio no está en condiciones de mandar a nadie. */
  | "sin-configurar"
  /** El backend contestó 401/403, o el token no tiene forma de token. */
  | "token-invalido"
  /** La persona existe pero figura dada de baja en Cidituc. */
  | "cuenta-inactiva"
  /** No hubo respuesta del backend, o vino una que no se entiende. */
  | "no-disponible";

export type ErrorIngreso =
  | MotivoRechazo
  /** El callback llegó sin `?auth=`. */
  | "sin-token"
  /** No teníamos cookie: pasaron los diez minutos, o el navegador no la mandó. */
  | "state-vencido"
  /** El derivador no nos devolvió el `state`. Es del lado de ellos. */
  | "state-ausente"
  /** Cookie y `state` no coinciden: dos pedidos pisándose (dos pestañas). */
  | "state-distinto"
  /**
   * Cidituc dijo que sí y nosotros no pudimos emitir la sesión.
   *
   * En los hechos significa una sola cosa: falta `SESSION_SECRET` o es más corto
   * que 32 caracteres, y `crearToken()` tira. Es el error más fácil de cometer
   * al cargar variables en un deploy nuevo, y sin este código sale como un 500 en
   * blanco **después** de que la persona se autenticó bien — el peor momento
   * posible para no explicar nada.
   */
  | "sesion-fallida"
  /**
   * Cidituc dice que la persona es quien dice ser, y el diario decide igual que
   * no entre.
   *
   * Autenticar no es autorizar: el bloqueo es nuestro, no de Cidituc, y por eso
   * no se le explica al vecino quién lo decidió ni por qué — eso se conversa,
   * no se pone en una pantalla.
   */
  | "bloqueado";

/** Qué ve la persona. El detalle técnico va al log del servidor, no a la pantalla. */
export const TEXTO_ERROR: Record<ErrorIngreso, string> = {
  "sin-configurar":
    "El ingreso con Cidituc todavía no está habilitado en este sitio.",
  "token-invalido":
    "Cidituc no reconoció la credencial. Probá ingresar de nuevo.",
  "cuenta-inactiva":
    "Tu cuenta de Cidituc figura como dada de baja. Consultá en Ciudadano Digital.",
  "no-disponible":
    "No pudimos comunicarnos con Cidituc. Volvé a intentar en unos minutos.",
  "sin-token": "El ingreso volvió sin credencial. Probá de nuevo.",
  "state-vencido":
    "La solicitud de ingreso venció. Volvé a empezar desde el botón.",
  "state-ausente": "El ingreso volvió incompleto. Probá de nuevo.",
  "state-distinto":
    "Había otro ingreso en curso. Cerrá las demás pestañas y probá de nuevo.",
  "sesion-fallida":
    "Cidituc te reconoció, pero no pudimos abrir tu sesión. Avisale a la Dirección de IA.",
  bloqueado:
    "Tu cuenta no puede ingresar al diario. Si te parece un error, escribinos.",
};

/**
 * El mensaje para lo que venga en `?error=`, o `null`.
 *
 * Sólo se muestran códigos conocidos: el valor sale de la barra de direcciones,
 * así que cualquiera puede escribir lo que quiera ahí. Devolverlo tal cual sería
 * dejar que un enlace preparado ponga el texto que se le antoje en nuestra
 * pantalla de ingreso.
 */
export function textoDeError(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  return Object.hasOwn(TEXTO_ERROR, valor)
    ? TEXTO_ERROR[valor as ErrorIngreso]
    : null;
}
