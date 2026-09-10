import { getFontEmbedCSS, toCanvas } from "html-to-image";
import type { CapturaPapel } from "./superficie";

let fuentes: Promise<string> | undefined;

// Si un CDN externo no responde a tiempo, html-to-image puede abortar toda la
// captura. Un píxel transparente permite conservar la animación y deja que la
// página real siga cargando por debajo del papel.
const IMAGEN_FALLBACK = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1"><rect width="1" height="1" fill="transparent"/></svg>',
)}`;

/** Captura sólo la franja visible, incluso en notas de varias pantallas.
 * Todo ocurre en el navegador: no se envía el contenido a ningún servicio. */
export async function capturarPapel(hoja: HTMLElement): Promise<CapturaPapel> {
  const rect = hoja.getBoundingClientRect();
  const arriba = Math.max(0, rect.top);
  const alto = Math.min(window.innerHeight, rect.bottom) - arriba;
  if (rect.width < 1 || alto < 1) throw new Error("Hoja fuera de pantalla");
  fuentes ??= getFontEmbedCSS(hoja, { preferredFontFormat: "woff2" }).catch(() => {
    fuentes = undefined;
    return "";
  });
  const imagen = await toCanvas(hoja, {
    width: rect.width,
    height: alto,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
    fontEmbedCSS: await fuentes,
    includeQueryParams: true,
    imagePlaceholder: IMAGEN_FALLBACK,
    style: {
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      margin: "0",
      transform: `translateY(${Math.min(0, rect.top)}px)`,
      transformOrigin: "top left",
      boxShadow: "none",
      animation: "none",
    },
  });
  const muestra = document.createElement("canvas").getContext("2d");
  if (!muestra) throw new Error("Canvas no disponible");
  muestra.fillStyle = getComputedStyle(hoja).backgroundColor;
  muestra.fillRect(0, 0, 1, 1);
  const color = muestra.getImageData(0, 0, 1, 1).data;
  return {
    imagen, izquierda: rect.left, arriba, ancho: rect.width, alto,
    color: [color[0] / 255, color[1] / 255, color[2] / 255],
  };
}
