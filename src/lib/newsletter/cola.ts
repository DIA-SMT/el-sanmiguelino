/**
 * Las reglas de la cola del newsletter que no necesitan base ni servidor:
 * la hora de Tucumán, cuánto esperar entre reintentos y qué error vale la pena
 * reintentar.
 *
 * Es puro a propósito, igual que `enlaces.ts`: se prueba con Node suelto, y lo
 * importan tanto el servidor como el editor del panel (que necesita la misma
 * cuenta de la hora para mostrar "sale el martes a las 10:00").
 */

/** Argentina no tiene horario de verano desde 2009: siempre UTC−3. Se fija el
 *  desplazamiento en vez de depender de la base de husos horarios del sistema,
 *  que en un servidor puede no estar. */
const DESPLAZAMIENTO = "-03:00";
export const ZONA = "America/Argentina/Tucuman";

/** El tope hacia adelante para programar. Más que esto es casi seguro un error
 *  de tipeo en el año. */
export const MAXIMO_DIAS_ADELANTE = 60;

/**
 * Una fecha y una hora escritas en Tucumán ("2026-11-10", "10:00"), como
 * instante. `null` si no es una fecha real (31 de febrero, 25:00).
 */
export function horaDeTucuman(fecha: string, hora: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) {
    return null;
  }
  const d = new Date(`${fecha}T${hora}:00${DESPLAZAMIENTO}`);
  if (Number.isNaN(d.getTime())) return null;
  // `Date` acepta "2026-02-31" y lo corre al 3 de marzo: se rechaza si, de
  // vuelta en Tucumán, no da lo mismo que se escribió.
  const vuelta = enTucuman(d);
  return vuelta.fecha === fecha && vuelta.hora === hora ? d : null;
}

/** Un instante, como fecha y hora de Tucumán para un `<input>`. */
export function enTucuman(d: Date): { fecha: string; hora: string } {
  const local = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const iso = local.toISOString();
  return { fecha: iso.slice(0, 10), hora: iso.slice(11, 16) };
}

/** "martes 10 de noviembre, 10:00", en la hora de Tucumán. */
export function fechaLegible(d: Date | string): string {
  const fecha = typeof d === "string" ? new Date(d) : d;
  const dia = new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA,
    weekday: "long",
    day: "numeric",
    month: "long",
  })
    .format(fecha)
    // Algunos motores escriben "martes, 10 de noviembre": en "sale el martes
    // 10" la coma sobra.
    .replace(",", "");
  const hora = new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(fecha);
  return `${dia}, ${hora}`;
}

/** "10:35", en la hora de Tucumán. */
export function horaLegible(d: Date | string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(typeof d === "string" ? new Date(d) : d);
}

export type ProblemaDeHora = "pasada" | "muy-lejos";

/**
 * Si se puede programar para ese momento. Un minuto de gracia hacia atrás:
 * quien elige "10:00" a las 10:00:30 quiere decir "ahora".
 */
export function revisarHora(
  cuando: Date,
  ahora = new Date(),
): ProblemaDeHora | null {
  if (cuando.getTime() < ahora.getTime() - 60_000) return "pasada";
  if (cuando.getTime() > ahora.getTime() + MAXIMO_DIAS_ADELANTE * 86_400_000) {
    return "muy-lejos";
  }
  return null;
}

/* ------------------------------------------------------------ reintentos */

/** Cuántas veces se intenta mandar a una persona antes de darlo por fallido. */
export const MAXIMO_INTENTOS = 4;

/** Espera antes del intento 2, 3 y 4, en minutos. */
const ESPERAS_MIN = [5, 30, 120];

/** Cuándo volver a intentar, después de `intentos` intentos fallidos. `null`
 *  si ya no se reintenta. */
export function proximoIntento(intentos: number, ahora = new Date()): Date | null {
  if (intentos >= MAXIMO_INTENTOS) return null;
  const espera = ESPERAS_MIN[Math.min(intentos - 1, ESPERAS_MIN.length - 1)];
  return new Date(ahora.getTime() + Math.max(espera, 1) * 60_000);
}

/** Cuánto se frena toda la cola cuando el problema es la cuenta del diario y
 *  no un destinatario. */
export const PAUSA_POR_CUENTA_MIN = 15;

/* ----------------------------------------------------------------- errores */

/**
 * Qué hacer con un error del servidor de correo:
 *
 * - **transitorio**: se cortó la conexión, Google pidió esperar (4xx). Se
 *   reintenta más tarde.
 * - **destinatario**: el servidor rechazó esa dirección (5xx). Reintentar no
 *   cambia nada: se da por fallido.
 * - **cuenta**: Google rechazó la cuenta del diario o llegó a su tope diario.
 *   No es culpa de nadie de la lista: se frena todo el envío un rato, sin
 *   gastarle intentos a nadie.
 */
export type ClaseDeError = "transitorio" | "destinatario" | "cuenta";

export function clasificarError(e: unknown): {
  clase: ClaseDeError;
  mensaje: string;
} {
  const codigo = (e as { code?: string } | null)?.code;
  const respuesta = (e as { responseCode?: number } | null)?.responseCode;
  const texto = String((e as { response?: string } | null)?.response ?? "");

  if (codigo === "EAUTH" || respuesta === 535 || respuesta === 534) {
    return {
      clase: "cuenta",
      mensaje:
        "Google rechazó la cuenta o la contraseña de aplicación del correo del diario.",
    };
  }
  // 550 5.4.5 / 421 4.7.0 con "limit": la cuenta llegó a su tope de envíos.
  if (/limit|quota|rate/i.test(texto) && (respuesta === 550 || respuesta === 421 || respuesta === 454)) {
    return {
      clase: "cuenta",
      mensaje: "La cuenta del diario llegó a su tope de envíos por ahora.",
    };
  }
  if (
    codigo === "ETIMEDOUT" ||
    codigo === "ECONNECTION" ||
    codigo === "ESOCKET" ||
    codigo === "ECONNRESET" ||
    codigo === "EDNS"
  ) {
    return {
      clase: "transitorio",
      mensaje: "No se pudo conectar con el servidor de correo.",
    };
  }
  if (respuesta && respuesta >= 400 && respuesta < 500) {
    return {
      clase: "transitorio",
      mensaje: "El servidor de correo pidió esperar.",
    };
  }
  if (respuesta && respuesta >= 500) {
    return {
      clase: "destinatario",
      mensaje: "El servidor de correo no aceptó la dirección.",
    };
  }
  return { clase: "transitorio", mensaje: "No se pudo enviar el correo." };
}
