/**
 * ¿La digitalización perdió texto del impreso?
 *
 *   node scripts/verificar-digitalizacion.mjs <archivo.pdf> <carpeta>
 *
 * Es la única pregunta que importa de verdad, porque es una publicación oficial
 * de un municipio: el conversor puede equivocarse en si algo era un subtítulo o
 * un destacado —eso lo corrige una persona en el panel y se ve a simple vista—
 * pero **una frase que desapareció no la ve nadie**.
 *
 * Cómo se contesta: se toma todo el texto del PDF, se le saca la puntuación,
 * los espacios y las mayúsculas, y se busca cada palabra del original en el
 * resultado. Comparar así y no carácter por carácter es a propósito: el
 * conversor SÍ tiene permitido cambiar la forma —une las dos mitades de una
 * palabra cortada con guión, repone espacios que el PDF no guarda, saca las
 * comillas de una cita porque el diario las vuelve a poner al maquetar—. Lo que
 * no tiene permitido es perder contenido.
 *
 * Lo que se descarta a propósito —la bandera, el folio, la fecha, el pie legal—
 * se informa aparte y no cuenta como pérdida: para eso el motor lo devuelve en
 * `descartado` en lugar de tirarlo en silencio.
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const [, , archivoArg, carpetaArg] = process.argv;
if (!archivoArg || !carpetaArg) {
  console.log(
    "\n  node scripts/verificar-digitalizacion.mjs <archivo.pdf> <carpeta>\n",
  );
  process.exit(1);
}

const archivo = path.resolve(archivoArg);
const json = path.resolve(carpetaArg, "paginas.json");
for (const ruta of [archivo, json]) {
  if (!existsSync(ruta)) {
    console.log(`\nNo existe: ${ruta}\n`);
    process.exit(1);
  }
}

const { paginas } = JSON.parse(readFileSync(json, "utf8"));

/** Sin acentos, sin puntuación, sin mayúsculas: sólo las letras y los números,
 *  que es lo que tiene que sobrevivir a la conversión. */
function normalizar(texto) {
  return (
    (texto ?? "")
      // Se des-hifena ANTES de comparar, porque el conversor también lo hace y
      // hace bien: en el PDF «se charla» está guardado como «se char-» y «la
      // con el vecino», en dos renglones. Sin esto, cada palabra cortada al
      // final de una línea aparecía como dos palabras perdidas —"char",
      // "protes", "tar"— y la tapa daba 88% de cobertura teniendo el texto
      // entero y correcto.
      .replace(/-\s+/g, "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
  );
}

/** Todo el texto que una página digitalizada muestra, sin importar en qué
 *  bloque quedó. */
function textoDe(pagina) {
  const bloques = pagina.cuerpo.map((b) => {
    if (b.tipo === "ficha") {
      return [b.titulo, ...b.entradas.flatMap((e) => [e.lead, e.texto])].join(" ");
    }
    if (b.tipo === "foto") return [b.epigrafe, b.credito].filter(Boolean).join(" ");
    if (b.tipo === "cita") return [b.texto, b.autor, b.cargo].filter(Boolean).join(" ");
    return b.texto;
  });
  return [
    pagina.titulo,
    pagina.bajada,
    pagina.imagen?.epigrafe,
    pagina.imagen?.credito,
    ...bloques,
    // Lo descartado cuenta como "no perdido": está identificado y se sabe por
    // qué no se publica.
    ...pagina.descartado,
  ]
    .filter(Boolean)
    .join(" ");
}

const raiz = path.resolve("node_modules/pdfjs-dist");
const documento = await pdfjs.getDocument({
  data: new Uint8Array(readFileSync(archivo)),
  wasmUrl: `${raiz}/wasm/`,
  standardFontDataUrl: `${raiz}/standard_fonts/`,
  cMapUrl: `${raiz}/cmaps/`,
  cMapPacked: true,
}).promise;

console.log(`\n${path.basename(archivo)} — ${documento.numPages} páginas\n`);

let fallas = 0;
let palabrasTotales = 0;
let perdidasTotales = 0;

for (let n = 1; n <= documento.numPages; n++) {
  const pagina = await documento.getPage(n);
  const contenido = await pagina.getTextContent();
  const original = normalizar(
    contenido.items.map((i) => i.str ?? "").join(" "),
  );

  const digitalizada = paginas.find((p) => p.pagina === n);
  if (!digitalizada) {
    console.log(`  MAL p${n}: no está en paginas.json`);
    fallas++;
    continue;
  }

  const resultado = new Set(normalizar(textoDe(digitalizada)).split(" "));

  /*
   * Se cuentan PALABRAS y no apariciones.
   *
   * Con un conjunto, una palabra que en el original está cinco veces se busca
   * una sola. Es lo correcto para lo que se está preguntando —¿desapareció
   * algo?— y evita el falso positivo de contar como pérdida las veces que el
   * des-hifenado unió dos mitades que el PDF tenía separadas.
   */
  const original_ = [...new Set(original.split(" "))].filter(
    (p) => p.length > 2,
  );
  const perdidas = original_.filter((p) => !resultado.has(p));

  palabrasTotales += original_.length;
  perdidasTotales += perdidas.length;

  const cobertura = ((1 - perdidas.length / original_.length) * 100).toFixed(1);
  const bien = perdidas.length === 0;
  if (!bien) fallas++;

  console.log(
    `  ${bien ? "ok " : "MAL"} p${n}  ${cobertura}% de ${original_.length} palabras` +
      (bien ? "" : `  — faltan ${perdidas.length}`),
  );
  if (!bien) {
    console.log(`        ${perdidas.slice(0, 14).join(", ")}`);
  }
}

const cobertura = ((1 - perdidasTotales / palabrasTotales) * 100).toFixed(2);
console.log(
  `\n${cobertura}% del texto del impreso está en la digitalización ` +
    `(${palabrasTotales - perdidasTotales} de ${palabrasTotales} palabras).\n`,
);
console.log(fallas === 0 ? "TODO OK\n" : `${fallas} PÁGINAS CON PÉRDIDA\n`);
process.exit(fallas === 0 ? 0 : 1);
