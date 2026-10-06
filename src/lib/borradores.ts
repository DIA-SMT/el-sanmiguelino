/**
 * El borrador de un comentario que no se pudo publicar porque se venció la
 * sesión. Vive en sessionStorage —se va con la pestaña— y se recupera al volver
 * del ingreso (ver `ColumnaDelLector`).
 *
 * Va con la firma de quien lo escribió y sólo se le devuelve a esa firma: en
 * una computadora compartida, el que ingresa después en la misma pestaña no
 * puede encontrarse el texto sin publicar del anterior, listo para salir con su
 * nombre. Y al cerrar sesión se borran todos (`olvidarBorradores`, desde
 * `UserChip`): la firma abreviada no es única, dos personas pueden firmar igual.
 *
 * Todo con try/catch: el almacenamiento puede no estar (ventana privada, datos
 * del sitio bloqueados), y eso no puede romper nada.
 */

const PREFIJO = "sm-borrador:";
const clave = (notaSlug: string) => `${PREFIJO}${notaSlug}`;

export function guardarBorrador(notaSlug: string, firma: string, texto: string) {
  try {
    sessionStorage.setItem(clave(notaSlug), JSON.stringify({ firma, texto }));
  } catch {}
}

/** Lo saca siempre, y lo devuelve sólo si es de `firma`. */
export function sacarBorrador(notaSlug: string, firma: string): string | null {
  try {
    const guardado = sessionStorage.getItem(clave(notaSlug));
    sessionStorage.removeItem(clave(notaSlug));
    if (!guardado) return null;
    const { firma: deQuien, texto } = JSON.parse(guardado) as {
      firma?: unknown;
      texto?: unknown;
    };
    return deQuien === firma && typeof texto === "string" ? texto : null;
  } catch {
    return null;
  }
}

export function olvidarBorradores() {
  try {
    for (const k of Object.keys(sessionStorage)) {
      if (k.startsWith(PREFIJO)) sessionStorage.removeItem(k);
    }
  } catch {}
}

/** Ya se publicó: el borrador no tiene que volver a aparecer. */
export function olvidarBorrador(notaSlug: string) {
  try {
    sessionStorage.removeItem(clave(notaSlug));
  } catch {}
}
