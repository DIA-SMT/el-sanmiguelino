"use client";

/**
 * Cargar pdf.js, una sola vez y sólo cuando hace falta.
 *
 * pdf.js son 450 KB de JavaScript. Se importa **dinámicamente** para que
 * quede en su propio chunk: un lector que abre una edición de notas escritas
 * —agosto, septiembre— no se lo baja nunca. Sólo las páginas del facsímil lo
 * piden.
 *
 * El worker, los decodificadores wasm y las tipografías estándar se sirven
 * desde `/pdfjs/`, que copia `scripts/copiar-pdfjs.mjs` en postinstall. No se
 * importan desde el paquete a propósito: son archivos que pdf.js pide por URL
 * en tiempo de ejecución, así que el bundler no puede resolverlos y la forma de
 * que estén es ponerlos en `public/`.
 */

import type * as Pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";

let biblioteca: Promise<typeof Pdfjs> | null = null;

function cargarBiblioteca(): Promise<typeof Pdfjs> {
  biblioteca ??= import("pdfjs-dist").then((pdfjs) => {
    // La versión del worker tiene que ser EXACTAMENTE la de la biblioteca.
    // Como los dos salen del mismo paquete y el archivo se copia en
    // postinstall, no pueden separarse.
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
    return pdfjs;
  });
  return biblioteca;
}

/**
 * Los documentos ya abiertos, por dirección.
 *
 * Pasar de página desmonta el visor y monta otro, y sin esto cada hoja volvería
 * a abrir y a parsear el mismo PDF de treinta megas. El caché vive en el módulo,
 * así que sobrevive a la navegación del cliente —que es toda la navegación del
 * diario— y se pierde al recargar, que es cuando corresponde.
 *
 * Guarda la promesa y no el documento: dos páginas que se piden al mismo tiempo
 * comparten una sola apertura en lugar de largar dos.
 */
const documentos = new Map<string, Promise<PDFDocumentProxy>>();

export function abrirPdf(url: string): Promise<PDFDocumentProxy> {
  const abierto = documentos.get(url);
  if (abierto) return abierto;

  const tarea = cargarBiblioteca().then((pdfjs) =>
    pdfjs.getDocument({
      url,
      // Decodificadores de JPEG 2000 y JBIG2. **Un PDF de imprenta usa JPEG
      // 2000 para las fotos casi siempre**: sin esto la página sale con el
      // texto y sin las imágenes, y sin ningún error a la vista.
      wasmUrl: "/pdfjs/wasm/",
      // Las 14 tipografías estándar del formato, que un PDF puede nombrar sin
      // incrustarlas, y las tablas de codificación.
      standardFontDataUrl: "/pdfjs/standard_fonts/",
      cMapUrl: "/pdfjs/cmaps/",
      cMapPacked: true,
    }).promise,
  );

  // Si falla, no queda cacheado el fracaso: el lector recarga y se vuelve a
  // intentar. Un `catch` que sólo limpia y vuelve a tirar.
  tarea.catch(() => documentos.delete(url));

  documentos.set(url, tarea);
  return tarea;
}

/** Cuántas páginas tiene un PDF que todavía no se subió. Lo usa el panel para
 *  no tener que contar del lado del servidor, que significaría bajar y parsear
 *  el archivo entero en cada carga. */
export async function contarPaginas(archivo: File): Promise<number> {
  const pdfjs = await cargarBiblioteca();
  const datos = new Uint8Array(await archivo.arrayBuffer());
  const tarea = pdfjs.getDocument({ data: datos });
  try {
    return (await tarea.promise).numPages;
  } finally {
    // Se cierra siempre: son treinta megas parseados que ya no hacen falta —el
    // visor del diario abre el suyo desde la URL pública— y con un worker
    // propio detrás. Va en `finally` para que un PDF roto tampoco lo deje
    // colgado.
    await tarea.destroy();
  }
}

/** La capa de texto de pdf.js, para que la hoja se pueda seleccionar y leer
 *  con un lector de pantalla. Se expone acá porque el visor la necesita y la
 *  biblioteca se carga una sola vez. */
export async function claseCapaTexto() {
  return (await cargarBiblioteca()).TextLayer;
}
