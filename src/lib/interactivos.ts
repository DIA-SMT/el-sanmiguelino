/**
 * Qué se puede incrustar en una nota.
 *
 * La redacción arma elementos interactivos para cada suplemento —la línea de
 * tiempo de septiembre, el mapa de esculturas de julio— y los aloja en el Portal
 * de Datos del municipio. Este módulo es la única puerta por la que entran al
 * diario, y la usan los tres que tienen que decir lo mismo: el editor (para
 * avisar antes de guardar), la acción del servidor (que es el control de
 * verdad) y la nota (que vuelve a mirar antes de dibujar, porque los scripts de
 * digitalización escriben en la base sin pasar por la acción).
 *
 * **Es una lista cerrada de sitios, a propósito.** Un recuadro incrustado no
 * puede leer nuestras cookies ni nuestra página, pero puede MOSTRAR cualquier
 * cosa adentro de una página oficial del diario: un falso "Ingresá con
 * Ciudadano Digital" en un sitio ajeno se vería como del municipio. Con una
 * cuenta de administrador comprometida, eso sería un ataque de una línea. Por
 * eso los sitios van por nombre exacto —nada de `*.gob.ar`— y en el código,
 * no en un campo del panel: sumar uno es una decisión que se revisa.
 *
 * No va `server-only`: el editor del panel también la necesita.
 */

/** Los sitios cuyos interactivos se pueden meter adentro de una nota. */
export const SITIOS_INCRUSTABLES = [
  // El Portal de Datos del municipio. Probado el 2026-10-05 contra la línea de
  // tiempo: no manda X-Frame-Options ni frame-ancestors, y la página no
  // intenta salirse del recuadro.
  "smtendatos.gob.ar",
] as const;

/**
 * La dirección, normalizada, si se puede incrustar; null si no.
 *
 * Exige `https` y un sitio de la lista por nombre exacto. Con eso quedan afuera
 * `javascript:`, `data:` y `http:` —que además el navegador bloquearía por
 * contenido mixto— y cualquier sitio que imite al municipio.
 *
 * Acepta también el código que da el botón "Insertar" de muchas herramientas
 * (`<iframe src="…">`) y se queda con la dirección: es lo que la redacción va a
 * copiar y pegar, y pedirle que lo desarme a mano es buscar errores.
 */
export function urlIncrustable(entrada: string): string | null {
  const texto = entrada.trim();
  const delCodigo = /<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i.exec(texto)?.[1];
  const candidata = (delCodigo ?? texto).trim();

  let url: URL;
  try {
    url = new URL(candidata);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!(SITIOS_INCRUSTABLES as readonly string[]).includes(url.hostname)) {
    return null;
  }
  return url.toString();
}

/** El alto del recuadro, por nombre y no en píxeles: un número en un campo del
 *  panel es configuración, y lo que la redacción decide es si el interactivo es
 *  chico o grande. */
export type AltoInteractivo = "normal" | "alto";
