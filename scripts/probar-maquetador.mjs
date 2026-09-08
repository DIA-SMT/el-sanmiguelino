/**
 * Prueba el maquetador con modelo sobre una página, sin tocar nada.
 *
 *   node scripts/probar-maquetador.mjs <archivo.pdf> <número de página> [modelo]
 *
 * Existe para poder comparar modelos sobre el mismo caso difícil antes de
 * elegir uno. No escribe en la base, no sube nada y no modifica la
 * digitalización: imprime cómo quedaría el cuerpo de esa página y si el reparto
 * pasó el control de fidelidad.
 *
 * El caso que motivó todo esto es la página 5 de agosto: el recuadro «Ocho
 * plazas, ocho formas de construir comunidad» tiene dos columnas propias adentro
 * de una página de tres, y la heurística deja los cuatro encabezados de la
 * izquierda apilados y funde sus cuatro descripciones en un párrafo de 1.053
 * caracteres. Lo que hay que mirar en la salida es si aparece UNA ficha con sus
 * ocho entradas.
 */

import fs from "node:fs";
import path from "node:path";
import { config as cargarEnv } from "dotenv";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";
import { lineasDePagina } from "../src/lib/pdf/estructura.ts";
import { maquetarConModelo } from "../src/lib/pdf/maquetador.ts";
import {
  consultaOpenRouter,
  modeloQueMaqueta,
} from "../src/lib/pdf/maquetador-openrouter.ts";

cargarEnv({ path: ".env.local", quiet: true });

const [, , archivoArg, paginaArg, modeloArg] = process.argv;
if (!archivoArg || !paginaArg) {
  console.log(
    "\n  node scripts/probar-maquetador.mjs <archivo.pdf> <página> [modelo]\n",
  );
  process.exit(1);
}
if (modeloArg) process.env.MAQUETADOR_MODELO = modeloArg;

const numero = Number(paginaArg);
const raiz = path.resolve("node_modules/pdfjs-dist");
const doc = await pdfjs.getDocument({
  data: new Uint8Array(fs.readFileSync(path.resolve(archivoArg))),
  wasmUrl: `${raiz}/wasm/`,
  standardFontDataUrl: `${raiz}/standard_fonts/`,
  cMapUrl: `${raiz}/cmaps/`,
  cMapPacked: true,
}).promise;

const pagina = await doc.getPage(numero);
const vista = pagina.getViewport({ scale: 1 });

/* El texto con su geometría, igual que en `digitalizar.mjs`: es lo que
   `lineasDePagina` espera. */
const contenido = await pagina.getTextContent();
await pagina.getOperatorList(); // puebla commonObjs, de donde sale la tipografía
const items = [];
for (const it of contenido.items) {
  if (!it.str || !it.str.trim()) continue;
  const [a, , , d, e, f] = it.transform;
  const fuente = pagina.commonObjs.has(it.fontName)
    ? (pagina.commonObjs.get(it.fontName)?.name ?? it.fontName)
    : it.fontName;
  items.push({
    texto: it.str,
    x: e,
    y: vista.height - f,
    ancho: it.width,
    alto: it.height || Math.abs(d) || Math.abs(a),
    tam: Math.abs(d) || Math.abs(a),
    fuente,
    rotado: Math.abs(a) < 0.01,
  });
}

const lineas = lineasDePagina({ pagina: numero, ancho: vista.width, alto: vista.height, items });

/* La imagen que el modelo va a mirar. 1400px de ancho: alcanza para leer un
   rótulo de infografía y no infla el pedido. */
const escala = 1400 / vista.width;
const vp = pagina.getViewport({ scale: escala });
const lienzo = createCanvas(Math.round(vp.width), Math.round(vp.height));
const ctx = lienzo.getContext("2d");
ctx.fillStyle = "#fff";
ctx.fillRect(0, 0, lienzo.width, lienzo.height);
await pagina.render({ canvasContext: ctx, viewport: vp, canvas: lienzo }).promise;
const imagenBase64 = lienzo.toBuffer("image/png").toString("base64");

console.log(
  `\nPágina ${numero} · ${lineas.length} líneas · imagen ${lienzo.width}×${lienzo.height}` +
    `\nModelo: ${modeloQueMaqueta()}\n`,
);

const arranque = Date.now();
const r = await maquetarConModelo({
  lineas,
  imagenBase64,
  pagina: numero,
  consultar: consultaOpenRouter(),
});
const segundos = ((Date.now() - arranque) / 1000).toFixed(1);

if (!r.ok) {
  console.log(`RECHAZADO (${segundos}s): ${r.motivo}`);
  console.log("\nLa página se armaría con la heurística de siempre.\n");
  process.exit(0);
}

console.log(`ACEPTADO en ${segundos}s\n`);
console.log(`TÍTULO: ${r.titulo}`);
console.log(`BAJADA: ${r.bajada}\n`);
console.log(`CUERPO (${r.cuerpo.length} bloques):`);
for (const [i, b] of r.cuerpo.entries()) {
  if (b.tipo === "ficha") {
    console.log(`${String(i).padStart(2)} ficha      «${b.titulo}» — ${b.entradas.length} entradas`);
    for (const e of b.entradas) {
      console.log(`      · ${e.lead} → ${e.texto.slice(0, 70)}…`);
    }
    continue;
  }
  if (b.tipo === "cita") {
    console.log(`${String(i).padStart(2)} cita       «${b.texto.slice(0, 60)}…» — ${b.autor}`);
    continue;
  }
  console.log(`${String(i).padStart(2)} ${b.tipo.padEnd(10)} ${b.texto.slice(0, 76)}`);
}
console.log(`\nMuebleria descartada: ${r.descartado.length} líneas`);
