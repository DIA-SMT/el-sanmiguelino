import "server-only";

/**
 * Digitalizar el PDF de una edición, del lado del servidor.
 *
 * Este módulo es la mitad sucia de la digitalización: la que sabe de pdf.js, de
 * decodificar imágenes y de subirlas al bucket. La mitad limpia —decidir qué es
 * un título, un párrafo o una cita— vive en `estructura.ts`, que es pura y no
 * sabe de nada de esto.
 *
 * **Corre en el servidor aunque el PDF nunca pase por el servidor al subirse.**
 * No es una contradicción: el navegador escribe directo en el bucket porque en
 * Vercel un request no puede pesar más de 4,5 MB, pero una vez ahí el objeto
 * queda en una URL pública y el servidor se lo puede bajar cuando quiera. Eso
 * es lo que hace que "volver a digitalizar" sea un botón y no una resubida.
 *
 * Medido contra el número de agosto —8 páginas A3, 29 imágenes, 6,2 MB— el
 * trabajo completo tarda **4,9 segundos**: bajar, parsear, decodificar cada
 * foto, recodificarla en WebP y subirla. De ahí sale el `maxDuration` de la
 * acción que lo llama.
 *
 * Las dos dependencias pesadas ya estaban instaladas: `pdfjs-dist` lo usa el
 * visor del diario y `sharp` lo trae Next para optimizar imágenes.
 */

import { createRequire } from "node:module";
import {
  digitalizarPagina,
  type FiguraPagina,
  type ItemTexto,
  type PaginaDigitalizada,
} from "@/lib/pdf/estructura";
import { subirImagen } from "@/lib/storage";

/** Debajo de esto no es una figura: es un logo, una viñeta o un filete. En
 *  puntos cuadrados; la foto más chica del diario mide 296×171 = 50.616. */
const AREA_MINIMA = 8000;

/** Ancho máximo de una figura guardada. Las fotos del impreso vienen a 150 DPI,
 *  así que una a todo el ancho de una A3 son 1.577 px de origen: recortar a
 *  1.600 no pierde nada y le pone techo a lo que se sube. */
const ANCHO_MAXIMO = 1600;

/** Cuánto se espera a que el bucket entregue el PDF. */
const TIMEOUT_MS = 30_000;

/**
 * Dónde están los decodificadores y las tipografías que pdf.js pide por ruta.
 *
 * Se resuelve desde el paquete y no con `process.cwd()` porque en una función
 * de Vercel el directorio de trabajo no es el del repositorio. Y para que estos
 * archivos EXISTAN allá hay que forzarlos en `outputFileTracingIncludes`
 * (`next.config.ts`): pdf.js los abre por ruta en tiempo de ejecución, así que
 * el trazado automático de Next no los ve y no los empaqueta. Sin ellos el PDF
 * se parsea igual pero las fotos salen vacías, **sin ningún error**.
 */
function raizDePdfjs(): string {
  const require = createRequire(import.meta.url);
  return require.resolve("pdfjs-dist/package.json").replace(/[\\/]package\.json$/, "");
}

/** Multiplica dos matrices de transformación del PDF. */
function componer(m: number[], o: number[]): number[] {
  return [
    m[0] * o[0] + m[2] * o[1],
    m[1] * o[0] + m[3] * o[1],
    m[0] * o[2] + m[2] * o[3],
    m[1] * o[2] + m[3] * o[3],
    m[0] * o[4] + m[2] * o[5] + m[4],
    m[1] * o[4] + m[3] * o[5] + m[5],
  ];
}

interface ImagenCruda {
  width: number;
  height: number;
  kind: number;
  data: Uint8Array | Uint8ClampedArray;
}

/** Los píxeles de una imagen del PDF, ya decodificados. `page.objs` resuelve
 *  por callback y puede no resolver nunca si el objeto no existe, así que va
 *  con reloj: una edición entera no se puede colgar por una foto rota. */
function pixeles(pagina: unknown, id: string): Promise<ImagenCruda | null> {
  return new Promise((resolver) => {
    const reloj = setTimeout(() => resolver(null), 10_000);
    try {
      (pagina as { objs: { get(i: string, cb: (v: unknown) => void): void } }).objs.get(
        id,
        (valor) => {
          clearTimeout(reloj);
          resolver((valor as ImagenCruda) ?? null);
        },
      );
    } catch {
      clearTimeout(reloj);
      resolver(null);
    }
  });
}

export interface ResultadoDigitalizacion {
  paginas: PaginaDigitalizada[];
  /** Cuántas figuras se subieron al bucket. */
  figuras: number;
  /** Cuánto tardó, para poder ver si se está acercando al tope de la función. */
  segundos: number;
}

/**
 * Baja el PDF de una edición y lo convierte en páginas digitalizadas.
 *
 * No escribe nada en la base: devuelve el resultado para que lo guarde
 * `guardarDigitalizacion()`. Sí sube las figuras al bucket, porque los bloques
 * necesitan la dirección definitiva de cada imagen y no hay forma de armarlos
 * antes.
 */
export async function digitalizarPdf(
  url: string,
  edicionSlug: string,
): Promise<ResultadoDigitalizacion> {
  const arranque = Date.now();

  const respuesta = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!respuesta.ok) {
    throw new Error(
      `No se pudo bajar el PDF del bucket (${respuesta.status}). ` +
        "Sin el archivo no hay nada que digitalizar.",
    );
  }
  const datos = new Uint8Array(await respuesta.arrayBuffer());

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const raiz = raizDePdfjs();
  // Se guarda la TAREA y no sólo el documento: `destroy()` vive en la tarea de
  // carga, no en el documento, y es lo que apaga el worker al terminar.
  const tarea = pdfjs.getDocument({
    data: datos,
    // Los decodificadores de JPEG 2000 y JBIG2 —un PDF de imprenta usa JPEG
    // 2000 para las fotos casi siempre—, las tipografías estándar y las tablas
    // de codificación.
    wasmUrl: `${raiz}/wasm/`,
    standardFontDataUrl: `${raiz}/standard_fonts/`,
    cMapUrl: `${raiz}/cmaps/`,
    cMapPacked: true,
  });
  const documento = await tarea.promise;

  const { default: sharp } = await import("sharp");

  const paginas: PaginaDigitalizada[] = [];
  let figurasSubidas = 0;

  try {
    for (let n = 1; n <= documento.numPages; n++) {
      const pagina = await documento.getPage(n);
      const vista = pagina.getViewport({ scale: 1 });
      // Puebla `commonObjs` con las tipografías Y da la lista de imágenes: las
      // dos cosas salen de la misma llamada, y sin ella los nombres de fuente
      // son códigos internos y no se puede distinguir una negrita.
      const operadores = await pagina.getOperatorList();
      const contenido = await pagina.getTextContent();

      /* ------------------------------------------------------------ texto */

      const items: ItemTexto[] = [];
      for (const it of contenido.items) {
        if (!("str" in it) || !it.str.trim()) continue;
        const [a, b, , d, e, f] = it.transform;
        let fuente = it.fontName;
        try {
          const objeto = (await pagina.commonObjs.get(it.fontName)) as {
            name?: string;
          } | null;
          // El PDF nombra a las tipografías con un prefijo de subconjunto de
          // seis letras y un `+`: `RPMMEK+Poppins-Bold`. No dice nada y cambia
          // entre archivos.
          fuente = objeto?.name?.replace(/^[A-Z]{6}\+/, "") ?? it.fontName;
        } catch {
          /* se queda con el nombre interno */
        }
        items.push({
          x: e,
          // El PDF mide desde abajo; `estructura` lee de arriba hacia abajo.
          y: Math.round((vista.height - f) * 10) / 10,
          ancho: it.width,
          tam: Math.round(Math.hypot(b, d) * 10) / 10,
          fuente,
          texto: it.str,
          // Girada: la matriz no tiene componente horizontal. En el impreso lo
          // está el crédito del fotógrafo, contra el borde de la página.
          rotado: Math.abs(a) < 0.01,
        });
      }

      /* ---------------------------------------------------------- figuras */

      const colocadas: { id: string; x: number; y: number; ancho: number; alto: number }[] =
        [];
      let matriz = [1, 0, 0, 1, 0, 0];
      const pila: number[][] = [];
      for (let i = 0; i < operadores.fnArray.length; i++) {
        const op = operadores.fnArray[i];
        const args = operadores.argsArray[i] as unknown[];
        if (op === pdfjs.OPS.save) pila.push(matriz);
        else if (op === pdfjs.OPS.restore) matriz = pila.pop() ?? matriz;
        else if (op === pdfjs.OPS.transform) matriz = componer(matriz, args as number[]);
        // `paintImageXObject` es el único que hace falta: pdf.js 6 unificó ahí
        // el dibujado de imágenes, sea cual sea el formato de origen.
        else if (op === pdfjs.OPS.paintImageXObject) {
          const ancho = Math.abs(matriz[0]);
          const alto = Math.abs(matriz[3]);
          if (ancho * alto < AREA_MINIMA) continue;
          colocadas.push({
            id: String(args[0]),
            x: Math.round(matriz[4]),
            y: Math.round(vista.height - matriz[5] - alto),
            ancho: Math.round(ancho),
            alto: Math.round(alto),
          });
        }
      }

      const figuras: FiguraPagina[] = [];
      const vistos = new Set<string>();
      for (const c of colocadas) {
        // El mismo objeto dibujado dos veces es una sola figura.
        if (vistos.has(c.id)) continue;
        vistos.add(c.id);

        const cruda = await pixeles(pagina, c.id);
        if (!cruda?.data || !cruda.width || !cruda.height) continue;

        // `kind` 2 es RGB de 3 bytes por píxel y 3 es RGBA de 4. Es lo que
        // devuelve pdf.js una vez decodificada, sea cual sea el formato de
        // origen. Cualquier otra cosa —una máscara de un bit— se saltea.
        const canales = cruda.kind === 3 ? 4 : 3;
        if (cruda.data.length !== cruda.width * cruda.height * canales) continue;

        const webp = await sharp(Buffer.from(cruda.data), {
          raw: { width: cruda.width, height: cruda.height, channels: canales as 3 | 4 },
        })
          .resize({ width: Math.min(ANCHO_MAXIMO, cruda.width) })
          .webp({ quality: 82 })
          .toBuffer();

        // Se reusa `subirImagen()` con un File armado acá: valida por bytes
        // mágicos, elige el nombre del lado del servidor y no pisa nada. Es el
        // mismo camino que una foto que sube un redactor.
        const { url: direccion } = await subirImagen(
          new File([new Uint8Array(webp)], `p${n}.webp`, { type: "image/webp" }),
          `${edicionSlug}-p${n}`,
        );
        figurasSubidas++;

        figuras.push({
          src: direccion,
          x: c.x,
          y: c.y,
          ancho: c.ancho,
          alto: c.alto,
        });
      }

      paginas.push(
        digitalizarPagina({
          pagina: n,
          ancho: vista.width,
          alto: vista.height,
          items,
          figuras,
        }),
      );
    }
  } finally {
    // Son varios megas parseados y un worker propio detrás. Va en `finally`
    // para que un PDF roto tampoco los deje colgados en la función.
    await tarea.destroy();
  }

  return {
    paginas,
    figuras: figurasSubidas,
    segundos: Math.round((Date.now() - arranque) / 100) / 10,
  };
}
