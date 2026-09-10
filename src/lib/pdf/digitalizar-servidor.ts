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
 * OCR y maquetado comparten un presupuesto de 240 segundos. La acción que
 * llama tiene 300, para conservar margen de guardado y de respuesta.
 *
 * Las tres dependencias pesadas ya estaban instaladas: `pdfjs-dist` lo usa el
 * visor del diario, `sharp` lo trae Next para optimizar imágenes y
 * `@napi-rs/canvas` viene con pdf.js, que es el que lo pide para poder dibujar
 * fuera del navegador. Los tres están declarados en `serverExternalPackages`:
 * son binarios nativos y empaquetarlos no funciona.
 */

import path from "node:path";
import {
  digitalizarPagina,
  lineasDePagina,
  type FiguraPagina,
  type ItemTexto,
  type PaginaDigitalizada,
} from "@/lib/pdf/estructura";
import { diagnosticarPagina, necesitaOcr } from "@/lib/pdf/calidad";
import {
  extraerTextoConOcr,
  itemsDesdeOcr,
  ocrHabilitado,
} from "@/lib/pdf/ocr-openrouter";
import { zonasDeInfografia, type ZonaVectorial } from "@/lib/pdf/vectores";
import { maquetarConModelo } from "@/lib/pdf/maquetador";
import { consultaOpenRouter, modeloQueMaqueta } from "@/lib/pdf/maquetador-openrouter";
import { subirImagen } from "@/lib/storage";

/** Debajo de esto no es una figura: es un logo, una viñeta o un filete. En
 *  puntos cuadrados; la foto más chica del diario mide 296×171 = 50.616. */
const AREA_MINIMA = 8000;

/** Ancho máximo de una figura guardada. Las fotos del impreso vienen a 150 DPI,
 *  así que una a todo el ancho de una A3 son 1.577 px de origen: recortar a
 *  1.600 no pierde nada y le pone techo a lo que se sube. */
const ANCHO_MAXIMO = 1600;

/** Techo a cuánto se agranda una infografía al rasterizarla. Una zona angosta
 *  llevada a 1.600 px de ancho serían 20 veces el original: mucho archivo para
 *  nada, porque el vector se ve nítido bastante antes. */
const ESCALA_MAXIMA = 4;

/** Cuánto se espera a que el bucket entregue el PDF. */
const TIMEOUT_MS = 30_000;

/**
 * Dónde están los decodificadores y las tipografías que pdf.js pide por ruta.
 *
 * En Vercel `process.cwd()` es `/var/task`, que es justamente la raíz de la
 * función donde Next deja los paquetes externos. Los archivos de datos se
 * fuerzan además en `outputFileTracingIncludes` (`next.config.ts`): pdf.js los
 * abre por ruta en tiempo de ejecución, así que el trazado automático no los
 * ve y no los empaqueta. Sin ellos el PDF se parsea igual pero las fotos salen
 * vacías, **sin ningún error**.
 */
function raizDePdfjs(): string {
  return path.join(process.cwd(), "node_modules", "pdfjs-dist");
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

/** pdf.js puede entregar el id numérico de una fuente en vez de su nombre. */
function nombreDeFuente(valor: unknown): string {
  const texto = typeof valor === "string" ? valor : String(valor ?? "");
  return texto.replace(/^[A-Z]{6}\+/, "");
}

/**
 * La acción del panel es una decisión explícita de quien está editando el
 * número, así que puede usar el maquetador con visión cuando hay una clave.
 * En producción queda activo por defecto y `MAQUETADOR=0` es el interruptor de
 * emergencia; en desarrollo exige `MAQUETADOR=1` para no gastar una llamada
 * por accidente. El script de consola conserva su opt-in separado.
 */
function maquetadorDelPanelHabilitado(): boolean {
  const permitido =
    process.env.NODE_ENV === "production"
      ? process.env.MAQUETADOR !== "0"
      : process.env.MAQUETADOR === "1";
  return permitido && Boolean(process.env.OPENROUTER_API_KEY);
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

/** Lo mínimo que se le pide a una página de pdf.js para poder dibujarla. Se
 *  declara acá porque el módulo se importa dinámico y no hay un tipo a mano. */
interface PaginaDibujable {
  getViewport(opciones: {
    scale: number;
    offsetX?: number;
    offsetY?: number;
  }): unknown;
  render(parametros: unknown): { promise: Promise<void> };
}

/**
 * Renderiza un rectángulo de una página y lo devuelve en WebP.
 *
 * No se dibuja la hoja entera para recortarla después: el `offset` del viewport
 * corre el origen, así que el lienzo mide sólo la zona y la página cae encima
 * ya encuadrada. Una A3 completa a esta escala son 64 MB de píxeles y acá son
 * 6, que en una función de Vercel es la diferencia entre andar y no.
 *
 * El blanco del principio no es decorativo. El PDF **no pinta el papel**: lo que
 * no dibuja queda transparente, y una infografía de líneas negras sobre nada se
 * ve como una plancha negra en cuanto alguien la abre en modo oscuro.
 */
async function rasterizarZona(
  pagina: PaginaDibujable,
  zona: ZonaVectorial,
): Promise<Buffer> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const { default: sharp } = await import("sharp");

  const escala = Math.min(ANCHO_MAXIMO / zona.ancho, ESCALA_MAXIMA);
  const ancho = Math.round(zona.ancho * escala);
  const alto = Math.round(zona.alto * escala);
  const vista = pagina.getViewport({
    scale: escala,
    offsetX: -zona.x * escala,
    offsetY: -zona.y * escala,
  });

  const lienzo = createCanvas(ancho, alto);
  const contexto = lienzo.getContext("2d");
  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, ancho, alto);
  // pdf.js declara el lienzo del DOM porque es donde vive casi siempre; acá el
  // que dibuja es Skia, que es justamente el motor que el propio pdf.js usa
  // cuando corre en Node.
  await pagina.render({
    canvasContext: contexto,
    viewport: vista,
    canvas: lienzo,
  }).promise;

  const crudo = contexto.getImageData(0, 0, ancho, alto).data;
  return await sharp(
    Buffer.from(crudo.buffer, crudo.byteOffset, crudo.byteLength),
    { raw: { width: ancho, height: alto, channels: 4 } },
  )
    .webp({ quality: 82 })
    .toBuffer();
}

/** Renderiza la hoja completa para el OCR. Se limita la escala para que una
 * página A3 no consuma decenas de megabytes en una función de servidor. */
async function imagenCompletaDePagina(
  pagina: PaginaDibujable,
  ancho: number,
): Promise<string> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const escala = Math.min(1600 / ancho, 2.5);
  const vista = pagina.getViewport({ scale: escala }) as { width: number; height: number };
  const lienzo = createCanvas(Math.round(vista.width), Math.round(vista.height));
  const contexto = lienzo.getContext("2d");
  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, lienzo.width, lienzo.height);
  await pagina.render({ canvasContext: contexto, viewport: vista, canvas: lienzo }).promise;
  return lienzo.toBuffer("image/png").toString("base64");
}

function compacto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** Evita publicar dos veces una línea que ya estaba en la capa nativa. */
function ocrQueFalta(items: ItemTexto[], ocr: ItemTexto[]): ItemTexto[] {
  const nativos = items.map((item) => compacto(item.texto)).filter((texto) => texto.length >= 4);
  return ocr.filter((item) => {
    const texto = compacto(item.texto);
    if (texto.length < 4) return false;
    return !nativos.some(
      (nativo) =>
        nativo === texto ||
        (nativo.length > 20 && nativo.includes(texto)) ||
        (texto.length > 20 && texto.includes(nativo)),
    );
  });
}

export interface ResultadoDigitalizacion {
  paginas: PaginaDigitalizada[];
  /** Cuántas figuras se subieron al bucket. */
  figuras: number;
  /** Cuánto tardó, para poder ver si se está acercando al tope de la función. */
  segundos: number;
  /** Cuántas páginas pudo reordenar el maquetador con visión. */
  maquetadas: number;
  /** Modelo usado, o null si la variable de producción no está configurada. */
  modeloMaquetado: string | null;
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
  const signal = AbortSignal.timeout(240_000);

  const respuesta = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
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
  let paginasMaquetadas = 0;
  const fallosDeMaquetado: { pagina: number; motivo: string }[] = [];
  const tareasDeMaquetado: Promise<void>[] = [];

  try {
    for (let n = 1; n <= documento.numPages; n++) {
      if (signal.aborted) {
        throw new Error("Se agotó el tiempo para digitalizar. No se guardaron cambios en las notas.");
      }
      const pagina = await documento.getPage(n);
      const vista = pagina.getViewport({ scale: 1 });
      // Puebla `commonObjs` con las tipografías Y da la lista de imágenes: las
      // dos cosas salen de la misma llamada, y sin ella los nombres de fuente
      // son códigos internos y no se puede distinguir una negrita.
      const operadores = await pagina.getOperatorList();
      const contenido = await pagina.getTextContent();

      /* ------------------------------------------------------------ texto */

      let items: ItemTexto[] = [];
      for (const it of contenido.items) {
        if (!("str" in it) || !it.str.trim()) continue;
        const [a, b, , d, e, f] = it.transform;
        let fuente = it.fontName;
        try {
          /*
           * `fontName` suele ser un id de texto, pero algunos PDFs dejan un
           * número interno (por ejemplo, 55876). pdf.js espera una cadena en
           * `commonObjs.get` y hace `.replace()` internamente, así que no se
           * debe llamar con ese id numérico.
           */
          const objeto =
            typeof it.fontName === "string" && it.fontName
              ? ((await pagina.commonObjs.get(it.fontName)) as {
                  name?: unknown;
                } | null)
              : null;
          /*
           * El PDF nombra a las tipografías con un prefijo de subconjunto de
           * seis letras y un `+`: `RPMMEK+Poppins-Bold`. No dice nada y cambia
           * entre archivos, así que se lo saca.
           *
           * **El nombre no siempre es texto.** Para algunas fuentes pdf.js
           * devuelve un número —un id interno—. Si no es texto se usa ese id
           * convertido a cadena, sin dejar que un `.replace()` sobre el valor
           * crudo corte la digitalización.
           */
          fuente = nombreDeFuente(objeto?.name ?? it.fontName);
        } catch {
          /* se queda con el nombre interno, ya normalizado como texto */
          fuente = nombreDeFuente(it.fontName);
        }
        items.push({
          x: e,
          // El PDF mide desde abajo; `estructura` lee de arriba hacia abajo.
          y: Math.round((vista.height - f) * 10) / 10,
          ancho: it.width,
          tam: Math.round(Math.hypot(b, d) * 10) / 10,
          /*
           * A texto, siempre.
           *
           * `it.fontName` tampoco es necesariamente una cadena: cuando el
           * nombre de la tipografía no se pudo resolver, pdf.js deja acá su id
           * interno, que es un número. Ese valor viaja hasta `estructura.ts`,
           * donde se lo trata como texto para decidir la familia y el peso, y
           * ahí revienta lejos de donde nació. `String()` corta esa cadena en el
           * único lugar que la conoce.
           */
          fuente: String(fuente ?? ""),
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

      /*
       * Las infografías dibujadas con trazos, que hasta acá no las miraba
       * nadie: ver `vectores.ts`.
       *
       * Se resuelve ANTES de recortar las imágenes porque una zona se traga la
       * ilustración que tiene de fondo: esa imagen es una capa de la
       * infografía y no una figura aparte, y publicarla suelta era publicar el
       * mismo dibujo dos veces —el segundo desvaído y sin sus cifras—.
       */
      const zonas = zonasDeInfografia({
        operadores,
        OPS: {
          save: pdfjs.OPS.save,
          restore: pdfjs.OPS.restore,
          transform: pdfjs.OPS.transform,
          constructPath: pdfjs.OPS.constructPath,
          endPath: pdfjs.OPS.endPath,
          paintFormXObjectBegin: pdfjs.OPS.paintFormXObjectBegin,
          paintFormXObjectEnd: pdfjs.OPS.paintFormXObjectEnd,
        },
        ancho: vista.width,
        alto: vista.height,
        imagenes: colocadas,
        textos: items,
      });
      const absorbidas = new Set(zonas.flatMap((z) => z.absorbidas));

      const figuras: FiguraPagina[] = [];
      const vistos = new Set<string>();
      for (const c of colocadas) {
        // El mismo objeto dibujado dos veces es una sola figura.
        if (vistos.has(c.id)) continue;
        vistos.add(c.id);
        // Y la ilustración de fondo de una infografía ya viaja adentro de ella.
        if (absorbidas.has(c.id)) continue;

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

      for (const zona of zonas) {
        const webp = await rasterizarZona(
          pagina as unknown as PaginaDibujable,
          zona,
        );
        const { url: direccion } = await subirImagen(
          new File([new Uint8Array(webp)], `p${n}-info.webp`, {
            type: "image/webp",
          }),
          `${edicionSlug}-p${n}-info`,
        );
        figurasSubidas++;

        figuras.push({
          src: direccion,
          x: zona.x,
          y: zona.y,
          ancho: zona.ancho,
          alto: zona.alto,
          infografia: true,
        });
      }

      /* La geometría arma la primera versión; las páginas ambiguas pasan al
       * maquetador con visión después del OCR, sin permitir que una respuesta
       * incompleta reemplace una salida válida. */
      let resultado = digitalizarPagina({
        pagina: n,
        ancho: vista.width,
        alto: vista.height,
        items,
        figuras,
      });
      let diagnostico = diagnosticarPagina({
        ancho: vista.width,
        alto: vista.height,
        items,
        figuras,
        resultado,
      });

      /*
       * Un PDF puede mostrar texto que no existe en getTextContent(): escaneos,
       * letras pasadas a curvas y rótulos dentro de una infografía. En esas
       * páginas el OCR se usa como rescate, nunca como fuente principal. Las
       * líneas recuperadas se agregan a las nativas y vuelven a pasar por el
       * mismo ordenamiento de columnas; así no se arma una segunda maqueta con
       * reglas distintas. Si el servicio falla, queda la salida anterior y un
       * aviso visible para revisión.
       */
      if (ocrHabilitado() && necesitaOcr(diagnostico)) {
        try {
          const imagen = await imagenCompletaDePagina(
            pagina as unknown as PaginaDibujable,
            vista.width,
          );
          const ocr = await extraerTextoConOcr({
            imagenBase64: imagen,
            pagina: n,
            formato: diagnostico.formato,
            signal,
          });
          if (ocr.ok) {
            const recuperadas = ocrQueFalta(items, itemsDesdeOcr(ocr.lineas, vista.width, vista.height));
            if (recuperadas.length > 0) {
              const combinadas = [...items, ...recuperadas];
              items = combinadas;
              resultado = digitalizarPagina({
                pagina: n,
                ancho: vista.width,
                alto: vista.height,
                items: combinadas,
                figuras,
              });
              resultado.avisos.push(
                `Se recuperaron ${recuperadas.length} renglones con OCR; revisar la página antes de publicarla.`,
              );
              diagnostico = diagnosticarPagina({
                ancho: vista.width,
                alto: vista.height,
                items: combinadas,
                figuras,
                resultado,
              });
              diagnostico.motivos.push("se usó OCR para recuperar texto no expuesto por el PDF");
            }
          } else {
            resultado.avisos.push(`El OCR no pudo recuperar la página: ${ocr.motivo}`);
          }
        } catch (error) {
          resultado.avisos.push(
            `El OCR no pudo recuperar la página: ${error instanceof Error ? error.message : "error desconocido"}`,
          );
        }
      }

      resultado.diagnostico = diagnostico;
      const paginaGuardada = { ...resultado, figuras };
      paginas.push(paginaGuardada);

      /*
       * Las cajas con columnas internas y las dobles páginas son el caso que
       * la geometría no puede resolver. Se mandan en paralelo para que varias
       * páginas no sumen sus latencias. Un título reconocible no garantiza un
       * orden correcto: se revisan todas las páginas de prosa. Si alguna
       * falla, el resultado completo se rechaza antes de guardar las notas.
       */
      if (
        maquetadorDelPanelHabilitado() &&
        resultado.clase === "prosa"
      ) {
        tareasDeMaquetado.push(
          (async () => {
            try {
              const [lineas, imagen] = await Promise.all([
                Promise.resolve(
                  lineasDePagina({
                    pagina: n,
                    ancho: vista.width,
                    alto: vista.height,
                    items,
                    figuras,
                  }),
                ),
                imagenCompletaDePagina(
                  pagina as unknown as PaginaDibujable,
                  vista.width,
                ),
              ]);
              const maqueta = await maquetarConModelo({
                lineas,
                imagenBase64: imagen,
                pagina: n,
                consultar: consultaOpenRouter({ signal }),
              });
              if (!maqueta.ok || !maqueta.cuerpo) {
                fallosDeMaquetado.push({ pagina: n, motivo: maqueta.motivo ?? "respuesta inválida" });
                paginaGuardada.avisos.push(
                  `El maquetador (${modeloQueMaqueta()}) no pudo reordenar la página: ${maqueta.motivo ?? "respuesta inválida"}.`,
                );
                return;
              }

              const fotos = paginaGuardada.cuerpo.filter((b) => b.tipo === "foto");
              paginaGuardada.cuerpo = [...maqueta.cuerpo, ...fotos];
              paginaGuardada.titulo = maqueta.titulo ?? "";
              paginaGuardada.bajada = maqueta.bajada ?? "";
              paginaGuardada.avisos.push(
                `La estructura se reordenó con ${modeloQueMaqueta()}; revisar la página antes de publicarla.`,
              );
              paginaGuardada.diagnostico = diagnosticarPagina({
                ancho: vista.width,
                alto: vista.height,
                items,
                figuras,
                resultado: paginaGuardada,
              });
              paginasMaquetadas++;
            } catch (error) {
              fallosDeMaquetado.push({ pagina: n, motivo: error instanceof Error ? error.message : "error desconocido" });
              paginaGuardada.avisos.push(
                `El maquetador no pudo usarse: ${error instanceof Error ? error.message : "error desconocido"}.`,
              );
            }
          })(),
        );
      }
    }

    await Promise.allSettled(tareasDeMaquetado);
    if (signal.aborted) {
      throw new Error("Se agotó el tiempo para digitalizar. No se guardaron cambios en las notas.");
    }
    if (fallosDeMaquetado.length > 0) {
      throw new Error(
        "No se guardó la nueva digitalización; las notas anteriores se conservan. " +
        fallosDeMaquetado.sort((a, b) => a.pagina - b.pagina)
          .map((f) => `Página ${f.pagina}: ${f.motivo}`).join(" "),
      );
    }
  } finally {
    // Son varios megas parseados y un worker propio detrás. Va en `finally`
    // para que un PDF roto tampoco los deje colgados en la función.
    await Promise.allSettled(tareasDeMaquetado);
    await tarea.destroy();
  }

  return {
    paginas,
    figuras: figurasSubidas,
    segundos: Math.round((Date.now() - arranque) / 100) / 10,
    maquetadas: paginasMaquetadas,
    modeloMaquetado: maquetadorDelPanelHabilitado() ? modeloQueMaqueta() : null,
  };
}
