import type { Metadata } from "next";

/**
 * Cómo se ve el diario afuera: en Google y en la vista previa de un enlace
 * compartido por WhatsApp.
 *
 * Hasta que leer fue libre esto no existía, porque no hacía falta: un enlace a
 * una nota mostraba la pantalla de ingreso. Ahora el enlace abre la nota, y la
 * vista previa es lo primero que alguien ve de ella.
 */

/** La dirección del diario. Las imágenes de la vista previa tienen que ir con
 *  dirección completa, es la dirección canónica de cada nota y es la que se
 *  anuncia en el mapa del sitio.
 *
 *  Fija y no de una variable de entorno, a propósito: \`SITIO_URL\` ya existe y
 *  apunta al dominio viejo de Vercel —sólo le sirve a OpenRouter para atribuir
 *  el tráfico—, y una dirección canónica que redirige es justo lo que un
 *  buscador no quiere. Es el dominio al que \`next.config.ts\` manda el viejo. */
export const SITIO_URL = new URL("https://sanmiguelino.smt.gob.ar");

/** La imagen cuando la página no tiene foto propia: el ícono del diario. */
const IMAGEN_POR_DEFECTO = {
  url: "/iconos/icono-512.png",
  width: 512,
  height: 512,
  alt: "El Sanmiguelino",
};

/**
 * Lo común de toda vista previa. Next combina la metadata de cada segmento
 * reemplazando `openGraph` entero —no campo por campo—, así que una página que
 * define el suyo tiene que repetir esto (por eso es un objeto y no una sola
 * vez en el layout).
 */
export const OPEN_GRAPH_BASE = {
  siteName: "El Sanmiguelino",
  locale: "es_AR",
  type: "website" as const,
  images: [IMAGEN_POR_DEFECTO],
};

/** El texto de la vista previa: corto, entero y sin cortar una palabra. */
function resumen(texto: string, tope = 200): string {
  const limpio = texto.replace(/\s+/g, " ").trim();
  if (limpio.length <= tope) return limpio;
  return `${limpio.slice(0, limpio.lastIndexOf(" ", tope - 1))}…`;
}

/**
 * La foto de una nota sirve para la vista previa si es JPG o PNG. WebP queda
 * afuera: la subida lo acepta, pero no todas las aplicaciones lo muestran en la
 * vista previa, y una vista previa sin imagen es peor que una con el ícono.
 */
function fotoParaCompartir(src: string | undefined): string | null {
  if (!src) return null;
  const sinQuery = src.split("?")[0].toLowerCase();
  return /\.(jpe?g|png)$/.test(sinQuery) ? src : null;
}

/**
 * La metadata para compartir de una nota. Se arma con la nota que se puede
 * LEER —`getNota`, que respeta qué ediciones salieron—, nunca con la que se
 * edita: si no, un buscador se llevaría el título de una nota que todavía no
 * se publicó.
 */
export function metadataDeNota(nota: {
  slug: string;
  titulo: string;
  bajada: string;
  imagen?: { src?: string; alt: string };
  fotoDisponible: boolean;
}): Metadata {
  const descripcion = nota.bajada ? resumen(nota.bajada) : undefined;
  const foto = nota.fotoDisponible ? fotoParaCompartir(nota.imagen?.src) : null;
  const imagenes = foto
    ? [{ url: foto, alt: nota.imagen?.alt || nota.titulo }]
    : OPEN_GRAPH_BASE.images;
  return {
    title: nota.titulo,
    description: descripcion,
    alternates: { canonical: `/nota/${nota.slug}` },
    openGraph: {
      ...OPEN_GRAPH_BASE,
      type: "article",
      title: nota.titulo,
      description: descripcion,
      url: `/nota/${nota.slug}`,
      images: imagenes,
    },
    twitter: {
      card: foto ? "summary_large_image" : "summary",
      title: nota.titulo,
      description: descripcion,
      images: imagenes.map((i) => i.url),
    },
  };
}
