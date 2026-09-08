/**
 * Digitaliza el PDF del impreso: de un archivo a las notas del diario.
 *
 *   node scripts/digitalizar.mjs <archivo.pdf> [carpeta-de-salida]
 *
 * **No toca la base ni la red.** Escribe un `paginas.json` y las figuras
 * recortadas en una carpeta, y ahí se pueden mirar antes de que existan en
 * ningún lado. Cargarlas es el paso siguiente y es otro script, a propósito:
 * la base de desarrollo y la de producción son la misma, así que entre
 * "convertir" y "publicar" tiene que haber una persona mirando.
 *
 * Lo que hace acá es sólo la parte que necesita pdf.js:
 *
 *  1. **El texto con su geometría.** Cada palabra con su posición, su cuerpo y
 *     su tipografía real. El nombre de la tipografía sale de `commonObjs`, que
 *     no está poblado hasta que se pide la lista de operadores: por eso se
 *     llama a `getOperatorList()` aunque no se dibuje nada.
 *  2. **Las figuras.** Se recorre la lista de operadores llevando la matriz de
 *     transformación para saber DÓNDE quedó colocada cada imagen, y los píxeles
 *     se sacan de `page.objs`, que los entrega ya decodificados —el PDF de
 *     imprenta usa JPEG 2000 para las fotos y sin los decodificadores wasm
 *     salen en blanco—.
 *  3. **Las infografías dibujadas.** Lo que el PDF no trae como imagen sino
 *     como trazos, con el texto pasado a curvas. `vectores.ts` dice qué
 *     rectángulo de la página es una infografía y acá se lo renderiza a un
 *     lienzo y se lo guarda como una figura más. Sin este paso, las páginas 6 y
 *     7 de agosto salían con seis fotos y ni una de sus cifras.
 *
 * Y después le pasa todo eso a `digitalizarPagina()`, que es puro y no sabe de
 * PDF: ahí vive la inteligencia y ahí se la puede leer.
 *
 * Las tres dependencias que usa ya estaban instaladas: `pdfjs-dist` para leer,
 * `sharp` para codificar —la trae Next para optimizar imágenes— y
 * `@napi-rs/canvas`, que es el lienzo con el que pdf.js dibuja fuera del
 * navegador.
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { config as cargarEnv } from "dotenv";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";
import {
  digitalizarPagina,
  lineasDePagina,
} from "../src/lib/pdf/estructura.ts";
import { maquetarConModelo } from "../src/lib/pdf/maquetador.ts";
import {
  consultaOpenRouter,
  maquetadorHabilitado,
  modeloQueMaqueta,
} from "../src/lib/pdf/maquetador-openrouter.ts";
import { zonasDeInfografia } from "../src/lib/pdf/vectores.ts";

/* El maquetador con modelo necesita la clave, y este script corre fuera de
   Next, que es quien normalmente lee este archivo. Sin esto, MAQUETADOR=1 no
   hacía nada y no se notaba: el conversor seguía de largo con la heurística. */
cargarEnv({ path: ".env.local", quiet: true });

const require = createRequire(import.meta.url);
const sharp = require("sharp");

/** Debajo de esto no es una figura: es un logo, una viñeta o un filete.
 *  En puntos cuadrados; una foto chica del diario mide 296×171 = 50.616. */
const AREA_MINIMA = 8000;

/** Ancho máximo al que se guarda una figura. Las fotos vienen a 150 DPI, así
 *  que una a todo el ancho de una A3 son 1.577 px; recortarlas a 1.600 no pierde
 *  nada y le pone techo a lo que se sube. */
const ANCHO_MAXIMO = 1600;

/** Techo a cuánto se agranda una infografía al rasterizarla. Una zona angosta
 *  llevada a 1.600 px de ancho serían 20 veces el original: mucho archivo para
 *  nada, porque el vector se ve nítido bastante antes. */
const ESCALA_MAXIMA = 4;

const [, , archivoArg, salidaArg] = process.argv;

if (!archivoArg) {
  console.log(
    "\nQué PDF hay que digitalizar:\n" +
      "  node scripts/digitalizar.mjs <archivo.pdf> [carpeta-de-salida]\n",
  );
  process.exit(1);
}

const archivo = path.resolve(archivoArg);
if (!existsSync(archivo)) {
  console.log(`\nNo existe el archivo: ${archivo}\n`);
  process.exit(1);
}

const salida = path.resolve(salidaArg ?? "digitalizacion");
mkdirSync(salida, { recursive: true });

const raiz = path.resolve("node_modules/pdfjs-dist");

const documento = await pdfjs.getDocument({
  data: new Uint8Array(readFileSync(archivo)),
  // Los decodificadores de JPEG 2000 y JBIG2, las tipografías estándar y las
  // tablas de codificación. Sin el wasm las fotos salen vacías y sin ningún
  // error a la vista.
  wasmUrl: `${raiz}/wasm/`,
  standardFontDataUrl: `${raiz}/standard_fonts/`,
  cMapUrl: `${raiz}/cmaps/`,
  cMapPacked: true,
}).promise;

console.log(
  `\n${path.basename(archivo)} — ${documento.numPages} páginas\n` +
    `Salida: ${salida}\n`,
);

/* Que el maquetador esté prendido o apagado tiene que decirse. Pedirlo y que no
   pase nada —porque falta la clave— es el tipo de silencio que hace perder una
   tarde: la conversión termina bien, con la maquetación de siempre. */
if (process.env.MAQUETADOR === "1" && !maquetadorHabilitado()) {
  console.log(
    "  ⚠ Se pidió el maquetador y falta OPENROUTER_API_KEY.\n" +
      "    La conversión sigue con la heurística de siempre.\n",
  );
} else if (maquetadorHabilitado()) {
  console.log(`  Maquetando las páginas de prosa con ${modeloQueMaqueta()}\n`);
}

/** Multiplica dos matrices de transformación del PDF. */
function componer(m, o) {
  return [
    m[0] * o[0] + m[2] * o[1],
    m[1] * o[0] + m[3] * o[1],
    m[0] * o[2] + m[2] * o[3],
    m[1] * o[2] + m[3] * o[3],
    m[0] * o[4] + m[2] * o[5] + m[4],
    m[1] * o[4] + m[3] * o[5] + m[5],
  ];
}

/** Los píxeles de una imagen del PDF, ya decodificados. `page.objs` resuelve
 *  por callback y puede no resolver nunca si el objeto no existe, así que va
 *  con reloj. */
function pixeles(pagina, id) {
  return new Promise((resolver) => {
    const reloj = setTimeout(() => resolver(null), 10_000);
    try {
      pagina.objs.get(id, (valor) => {
        clearTimeout(reloj);
        resolver(valor ?? null);
      });
    } catch {
      clearTimeout(reloj);
      resolver(null);
    }
  });
}

/** Los códigos de operador que `vectores.ts` necesita. Se le pasan en vez de que
 *  importe pdf.js, para que ese módulo siga siendo puro. */
const CODIGOS = {
  save: pdfjs.OPS.save,
  restore: pdfjs.OPS.restore,
  transform: pdfjs.OPS.transform,
  constructPath: pdfjs.OPS.constructPath,
  endPath: pdfjs.OPS.endPath,
  paintFormXObjectBegin: pdfjs.OPS.paintFormXObjectBegin,
  paintFormXObjectEnd: pdfjs.OPS.paintFormXObjectEnd,
};

/**
 * Renderiza un rectángulo de una página y lo devuelve en WebP.
 *
 * No se dibuja la hoja entera para recortarla después: el `offset` del viewport
 * corre el origen, así que el lienzo mide sólo la zona y la página cae encima
 * ya encuadrada. Una A3 completa a esta escala son 64 MB de píxeles y acá son 6.
 *
 * El blanco del principio no es decorativo. El PDF **no pinta el papel**: lo que
 * no dibuja queda transparente, y una infografía de líneas negras sobre nada se
 * ve como una plancha negra en cuanto alguien la abre en modo oscuro.
 */
async function rasterizar(pagina, zona) {
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
  await pagina.render({ canvasContext: contexto, viewport: vista, canvas: lienzo })
    .promise;

  const crudo = contexto.getImageData(0, 0, ancho, alto).data;
  const buffer = await sharp(
    Buffer.from(crudo.buffer, crudo.byteOffset, crudo.byteLength),
    { raw: { width: ancho, height: alto, channels: 4 } },
  )
    .webp({ quality: 82 })
    .toBuffer();
  return { buffer, ancho, alto };
}

/**
 * La página entera como PNG en base64, para que el modelo la MIRE.
 *
 * 1.400 px de ancho: alcanza para leer el encabezado de un recuadro y la
 * sangría de un párrafo, que es lo que hay que distinguir, y no infla el
 * pedido. Va en PNG y no en WebP porque es lo que toda API de visión acepta sin
 * discutir.
 */
async function imagenDeLaPagina(pagina, vista) {
  const escala = 1400 / vista.width;
  const vp = pagina.getViewport({ scale: escala });
  const lienzo = createCanvas(Math.round(vp.width), Math.round(vp.height));
  const contexto = lienzo.getContext("2d");
  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, lienzo.width, lienzo.height);
  await pagina.render({ canvasContext: contexto, viewport: vp, canvas: lienzo })
    .promise;
  return lienzo.toBuffer("image/png").toString("base64");
}

const paginas = [];

for (let n = 1; n <= documento.numPages; n++) {
  const pagina = await documento.getPage(n);
  const vista = pagina.getViewport({ scale: 1 });
  // Puebla `commonObjs` con las tipografías Y da la lista de imágenes. Las dos
  // cosas salen de la misma llamada.
  const operadores = await pagina.getOperatorList();
  const contenido = await pagina.getTextContent();

  /* ---------------------------------------------------------------- texto */

  const items = [];
  for (const it of contenido.items) {
    if (!it.str || !it.str.trim()) continue;
    const [a, b, , d, e, f] = it.transform;
    let fuente = it.fontName;
    try {
      const objeto = await pagina.commonObjs.get(it.fontName);
      // El PDF nombra a las tipografías con un prefijo de subconjunto de seis
      // letras y un `+`: `RPMMEK+Poppins-Bold`. No dice nada y cambia entre
      // archivos, así que se lo saca.
      //
      // El nombre no siempre es texto: para algunas fuentes pdf.js devuelve un
      // número y ahí `replace` no existe. El porqué largo está en
      // `digitalizar-servidor.ts`, que es donde reventó.
      const nombre = typeof objeto?.name === "string" ? objeto.name : null;
      fuente = nombre?.replace(/^[A-Z]{6}\+/, "") ?? it.fontName;
    } catch {
      /* se queda con el nombre interno */
    }
    items.push({
      x: e,
      // El PDF mide desde abajo; acá se lee de arriba hacia abajo.
      y: Math.round((vista.height - f) * 10) / 10,
      ancho: it.width,
      tam: Math.round(Math.hypot(b, d) * 10) / 10,
      fuente,
      texto: it.str,
      // Girada: la matriz no tiene componente horizontal.
      rotado: Math.abs(a) < 0.01,
    });
  }

  /* -------------------------------------------------------------- figuras */

  const colocadas = [];
  let matriz = [1, 0, 0, 1, 0, 0];
  const pila = [];
  for (let i = 0; i < operadores.fnArray.length; i++) {
    const op = operadores.fnArray[i];
    const args = operadores.argsArray[i];
    if (op === pdfjs.OPS.save) pila.push(matriz);
    else if (op === pdfjs.OPS.restore) matriz = pila.pop() ?? matriz;
    else if (op === pdfjs.OPS.transform) matriz = componer(matriz, args);
    else if (
      op === pdfjs.OPS.paintImageXObject ||
      op === pdfjs.OPS.paintJpegXObject
    ) {
      const ancho = Math.abs(matriz[0]);
      const alto = Math.abs(matriz[3]);
      if (ancho * alto < AREA_MINIMA) continue;
      colocadas.push({
        id: args[0],
        x: Math.round(matriz[4]),
        y: Math.round(vista.height - matriz[5] - alto),
        ancho: Math.round(ancho),
        alto: Math.round(alto),
      });
    }
  }

  /*
   * Las infografías dibujadas con trazos, que hasta acá no las miraba nadie.
   *
   * Se resuelve ANTES de recortar las imágenes porque una zona se traga la
   * ilustración que tiene de fondo: esa imagen es una capa de la infografía y
   * no una figura aparte, y publicarla suelta era publicar el mismo dibujo dos
   * veces —el segundo desvaído y sin sus cifras—.
   */
  const zonas = zonasDeInfografia({
    operadores,
    OPS: CODIGOS,
    ancho: vista.width,
    alto: vista.height,
    imagenes: colocadas,
    textos: items,
  });
  const absorbidas = new Set(zonas.flatMap((z) => z.absorbidas));

  const figuras = [];
  const vistos = new Set();
  for (const c of colocadas) {
    if (vistos.has(c.id)) continue;
    vistos.add(c.id);
    if (absorbidas.has(c.id)) continue;

    const datos = await pixeles(pagina, c.id);
    if (!datos?.data || !datos.width || !datos.height) {
      console.log(`  p${n}: no se pudo leer la imagen ${c.id}`);
      continue;
    }

    // `kind` 2 es RGB de 3 bytes por píxel y 3 es RGBA de 4. Es lo que devuelve
    // pdf.js una vez decodificada la imagen, sea cual sea el formato original.
    const canales = datos.kind === 3 ? 4 : 3;
    if (datos.data.length !== datos.width * datos.height * canales) {
      console.log(
        `  p${n}: la imagen ${c.id} no es RGB ni RGBA (kind=${datos.kind}); se salta`,
      );
      continue;
    }

    const nombre = `p${String(n).padStart(2, "0")}-${figuras.length + 1}.webp`;
    const buffer = await sharp(Buffer.from(datos.data), {
      raw: { width: datos.width, height: datos.height, channels: canales },
    })
      .resize({ width: Math.min(ANCHO_MAXIMO, datos.width) })
      .webp({ quality: 82 })
      .toBuffer();
    writeFileSync(path.join(salida, nombre), buffer);

    figuras.push({
      src: nombre,
      x: c.x,
      y: c.y,
      ancho: c.ancho,
      alto: c.alto,
      /* sólo para el informe */
      px: `${datos.width}×${datos.height}`,
      kb: Math.round(buffer.length / 1024),
    });
  }

  for (const zona of zonas) {
    const nombre = `p${String(n).padStart(2, "0")}-${figuras.length + 1}.webp`;
    const { buffer, ancho, alto } = await rasterizar(pagina, zona);
    writeFileSync(path.join(salida, nombre), buffer);

    figuras.push({
      src: nombre,
      x: zona.x,
      y: zona.y,
      ancho: zona.ancho,
      alto: zona.alto,
      infografia: true,
      /* sólo para el informe */
      px: `${ancho}×${alto}`,
      kb: Math.round(buffer.length / 1024),
      trazos: zona.trazos,
    });
  }

  /* ------------------------------------------------------------ estructura */

  const resultado = digitalizarPagina({
    pagina: n,
    ancho: vista.width,
    alto: vista.height,
    items,
    figuras,
  });

  /*
   * El maquetador con modelo, cuando está prendido.
   *
   * Sólo toca el TEXTO y sólo en las páginas de prosa. Las figuras las sigue
   * resolviendo el camino de siempre —el modelo no ve imágenes recortadas, ve
   * la página— y una galería no tiene nada que reordenar.
   *
   * Si el modelo no está, no contesta o su reparto no pasa el control, la
   * página queda como la armó la heurística. Nunca se pierde una carga por
   * esto.
   */
  if (maquetadorHabilitado() && resultado.clase === "prosa") {
    const lineas = lineasDePagina({
      pagina: n,
      ancho: vista.width,
      alto: vista.height,
      items,
    });
    const maqueta = await maquetarConModelo({
      lineas,
      imagenBase64: await imagenDeLaPagina(pagina, vista),
      pagina: n,
      consultar: consultaOpenRouter(),
    });
    if (maqueta.ok) {
      // Las fotos las pone la heurística y se conservan tal cual, detrás del
      // texto: el modelo reparte líneas, no figuras.
      const fotos = resultado.cuerpo.filter((b) => b.tipo === "foto");
      resultado.cuerpo = [...maqueta.cuerpo, ...fotos];
      if (maqueta.titulo) resultado.titulo = maqueta.titulo;
      if (maqueta.bajada) resultado.bajada = maqueta.bajada;
      console.log(`     ✓ maquetada con ${modeloQueMaqueta()}`);
    } else {
      resultado.avisos.push(`El maquetador no se pudo usar: ${maqueta.motivo}`);
      console.log(`     · sin maquetador: ${maqueta.motivo}`);
    }
  }

  paginas.push({ ...resultado, figuras });

  const cuenta = resultado.cuerpo.reduce((mapa, b) => {
    mapa[b.tipo] = (mapa[b.tipo] ?? 0) + 1;
    return mapa;
  }, {});
  console.log(
    `p${String(n).padStart(2)} ${resultado.clase.padEnd(8)} ` +
      `${figuras.length} fig${zonas.length > 0 ? ` (${zonas.length} info)` : "      "}  ` +
      Object.entries(cuenta)
        .map(([t, c]) => `${c} ${t}`)
        .join(", ")
        .padEnd(42) +
      ` ${JSON.stringify(resultado.titulo.slice(0, 46))}`,
  );
  for (const aviso of resultado.avisos) console.log(`      ⚠ ${aviso}`);
}

writeFileSync(
  path.join(salida, "paginas.json"),
  JSON.stringify({ archivo: path.basename(archivo), paginas }, null, 2),
);

const avisos = paginas.reduce((t, p) => t + p.avisos.length, 0);
console.log(
  `\nListo: ${paginas.length} páginas en ${path.join(salida, "paginas.json")}` +
    (avisos > 0 ? `, con ${avisos} avisos para revisar.\n` : ".\n"),
);
