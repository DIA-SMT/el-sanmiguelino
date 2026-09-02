/**
 * Copia a `public/pdfjs/` lo que pdf.js necesita **a mano**, en tiempo de
 * ejecución, y que por lo tanto no puede empaquetar el bundler.
 *
 * Son cuatro cosas y ninguna es opcional para un diario:
 *
 * - `pdf.worker.min.mjs`: pdf.js parsea y rasteriza en un Web Worker. Sin él
 *   corre todo en el hilo principal y la página se congela mientras dibuja.
 * - `wasm/`: los decodificadores de JPEG 2000 y JBIG2. **Un PDF que sale de
 *   imprenta usa JPEG 2000 para las fotos casi siempre**, así que sin esto la
 *   página se dibuja con el texto y sin las fotos.
 * - `standard_fonts/`: las 14 tipografías estándar del formato, que un PDF
 *   puede referenciar sin incrustarlas.
 * - `cmaps/`: las tablas de codificación de los textos CJK y de algunas
 *   codificaciones viejas.
 *
 * Se copia en `postinstall` y **no se commitea** (está en .gitignore): son
 * cinco megas de archivos que ya viven en node_modules y que cambian con la
 * versión del paquete. Vercel corre `npm install`, así que corre esto.
 */

import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origen = path.join(raiz, "node_modules", "pdfjs-dist");
const destino = path.join(raiz, "public", "pdfjs");

if (!existsSync(origen)) {
  // No es un error: `npm install` puede correr esto antes de que el paquete
  // esté, y en ese caso la siguiente instalación lo resuelve.
  console.log("pdfjs-dist todavía no está instalado; no hay nada que copiar.");
  process.exit(0);
}

// Se borra y se rehace: si el paquete cambia de versión, un archivo viejo que
// sobreviva es peor que no tener ninguno — pdf.js exige que el worker sea
// exactamente de la misma versión que la biblioteca, y si no coinciden falla
// con un error que no dice eso.
await rm(destino, { recursive: true, force: true });
await mkdir(destino, { recursive: true });

await cp(
  path.join(origen, "build", "pdf.worker.min.mjs"),
  path.join(destino, "pdf.worker.min.mjs"),
);
for (const carpeta of ["wasm", "standard_fonts", "cmaps"]) {
  await cp(path.join(origen, carpeta), path.join(destino, carpeta), {
    recursive: true,
  });
}

console.log("pdf.js copiado a public/pdfjs/");
