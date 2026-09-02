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

/* ------------------------------------------------------------------------
 * Las páginas ya dibujadas
 *
 * **Esto es lo que hace que pasar de hoja no se sienta lento**, y el número que
 * lo justifica está medido contra el PDF de septiembre de 2026 (A4, 8,7 MB, 8
 * páginas) en escritorio, a 1104 px de ancho de hoja:
 *
 * | página | megapíxeles | dibujar |
 * |--------|-------------|---------|
 * | 4      | 6,89        | 409 ms  |
 * | 6      | 6,89        | 134 ms  |
 * | 5      | 2,50        | 136 ms  |
 * | 8      | 1,72        | 313 ms  |
 *
 * Lo importante de esa tabla es que **no hay ninguna relación con los
 * píxeles**: 6,89 MP costaron 134 ms en una página y 1,72 MP costaron 313 ms en
 * otra. El costo es el CONTENIDO —cuántas ilustraciones, fuentes e imágenes hay
 * que decodificar— y por eso el primer intento de arreglar esto, bajarle la
 * resolución al canvas, no mejoró nada y sólo perdía nitidez. Se probó y se
 * tiró.
 *
 * Lo que sí se puede es correr ese trabajo de lugar. El giro de página dura
 * 1150 ms y anima en el mismo hilo, así que 130-400 ms de dibujado encima
 * hacían que la hoja nueva apareciera recién cuando el giro terminaba: se veía
 * como una transición lenta. Dibujando la hoja siguiente MIENTRAS el lector lee
 * la actual, al pasar de página ya está lista y sólo hay que copiarla —15-25 ms
 * medidos—.
 * --------------------------------------------------------------------- */

/**
 * Cuántas hojas dibujadas se guardan.
 *
 * Tres: la que se está leyendo, la siguiente y la anterior. En escritorio son
 * unos 27 MB cada una (6,9 MP a 4 bytes), o sea ~83 MB, que es mucho pero
 * acotado y no crece; en un teléfono la hoja mide 360 px y son 3 MB cada una.
 *
 * Que sea un número chico no es tacañería: un caché sin tope, en un diario de
 * 24 páginas, se come 650 MB y lo mata el navegador.
 */
const MAXIMO_DIBUJOS = 3;

/** Clave del dibujo: la misma página a otro ancho es otro dibujo. */
function claveDeDibujo(url: string, pagina: number, ancho: number): string {
  return `${url}|${pagina}|${ancho}`;
}

/**
 * Los dibujos, en orden de uso.
 *
 * Guarda la PROMESA, igual que `documentos`, y por la misma razón más una: si
 * el lector pasa de página mientras la siguiente se está dibujando por
 * adelantado, se engancha al dibujado en curso en lugar de empezar otro.
 */
const dibujos = new Map<string, Promise<HTMLCanvasElement>>();

/**
 * Dibuja una página en un canvas propio, o devuelve el que ya estaba.
 *
 * El canvas NO está en el documento: es de este módulo. Quien lo pide lo copia
 * al suyo con `drawImage`. Copiar en lugar de mudar el elemento es a propósito:
 * durante el giro de página conviven la hoja que sale y la que entra, y un
 * elemento no puede estar en dos lugares.
 */
export async function dibujarPagina(
  url: string,
  pagina: number,
  ancho: number,
  densidad: number,
): Promise<HTMLCanvasElement> {
  const clave = claveDeDibujo(url, pagina, ancho);
  const hecho = dibujos.get(clave);
  if (hecho) {
    // Recién usada: pasa al final de la fila para que no la desalojen.
    dibujos.delete(clave);
    dibujos.set(clave, hecho);
    return hecho;
  }

  const tarea = (async () => {
    const documento = await abrirPdf(url);
    const hoja = await documento.getPage(pagina);
    const natural = hoja.getViewport({ scale: 1 });
    const vista = hoja.getViewport({
      scale: (ancho / natural.width) * densidad,
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(vista.width);
    canvas.height = Math.floor(vista.height);
    // Se le pasa el CANVAS y no su contexto 2D: ver `PaginaPdf`. Con los dos,
    // pdf.js 6 deja la promesa colgada para siempre.
    await hoja.render({ canvas, viewport: vista }).promise;
    return canvas;
  })();

  tarea.catch(() => dibujos.delete(clave));
  dibujos.set(clave, tarea);
  return tarea;
}

/**
 * Deja sólo las hojas cercanas a la que se está leyendo.
 *
 * Se llama al mostrar una página, después de pedir las vecinas. Desaloja por
 * DISTANCIA y no por antigüedad: quien lee la página 7 no va a volver a la 2
 * antes que a la 6, aunque la 2 la haya visto después.
 */
export function olvidarHojasLejanas(
  url: string,
  paginaActual: number,
  ancho: number,
): void {
  if (dibujos.size <= MAXIMO_DIBUJOS) return;

  const cercanas = new Set(
    [paginaActual, paginaActual + 1, paginaActual - 1].map((p) =>
      claveDeDibujo(url, p, ancho),
    ),
  );
  for (const clave of dibujos.keys()) {
    if (!cercanas.has(clave)) dibujos.delete(clave);
  }
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
