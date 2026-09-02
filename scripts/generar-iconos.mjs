/**
 * Genera los iconos del sitio a partir del isotipo municipal.
 *
 * Se corre con `npm run marca:iconos` y sólo hace falta cuando el municipio
 * cambia su logo. Existe en vez de tres archivos binarios sueltos porque los
 * iconos SON el logo institucional: hay que poder decir de dónde salieron y
 * volverlos a hacer sin adivinar recortes ni márgenes.
 *
 * La fuente es `scripts/marca/logo-muni-iso.png`, el asset original que entregó
 * la Dirección de IA (235x235, RGBA). **No se usa la recreación en SVG de
 * `src/components/brand/logos.tsx`**: esa está dibujada a mano con curvas
 * bezier aproximadas y sirve perfecto dentro de la página, al lado del nombre
 * del diario, pero el favicon es la marca del municipio a 16 píxeles y ahí va el
 * original.
 *
 * ## Lo que produce, y por qué cada uno
 *
 * - `src/app/favicon.ico` — 16, 32 y 48. Es lo que piden los navegadores viejos
 *   y, sobre todo, lo que buscan a ciegas en `/favicon.ico` los lectores de RSS,
 *   los marcadores y las vistas previas de los chats. Si no está, esos no leen
 *   el `<link>` del HTML y no muestran nada.
 * - `src/app/icon.png` — 512. Lo que usan los navegadores modernos en pantallas
 *   de alta densidad y Android al agregar el sitio a la pantalla de inicio.
 * - `src/app/apple-icon.png` — 180, **sobre blanco**. iOS no respeta la
 *   transparencia en el icono de la pantalla de inicio: la compone sobre negro,
 *   y el azul del isotipo sobre negro es una mancha. El blanco además es el
 *   papel del diario, así que no es un relleno arbitrario.
 *
 * Los tres los toma Next por convención de archivo en `src/app/` y arma los
 * `<link>` solo; no hay que declarar `metadata.icons`.
 *
 * ## El recorte
 *
 * El original trae la marca descentrada: dentro del lienzo de 235x235 la figura
 * ocupa 189x215 con 19px de margen a la izquierda y 27 a la derecha. Usarlo tal
 * cual deja el isotipo corrido hacia la izquierda y más chico de lo que podría
 * ser — a 16px eso se ve. Así que se recorta a la caja real y se recentra.
 *
 * La marca es más alta que ancha (189x215), así que centrada en un cuadrado deja
 * aire a los costados. Es del dibujo, no un error del recorte.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORIGEN = path.join(raiz, "scripts", "marca", "logo-muni-iso.png");
const APP = path.join(raiz, "src", "app");

/** Cuánto del lado ocupa la marca en los iconos transparentes. 0,94 deja un
 *  píxel de aire a 32 y dos a 48: lo justo para que no toque el borde del
 *  favicon sin regalar tamaño, que a 16px es lo único que importa. */
const OCUPA = 0.94;

/** En el icono de iOS, en cambio, la marca va más chica: el sistema le aplica
 *  su propia máscara redondeada y recorta las esquinas del lienzo. */
const OCUPA_IOS = 0.72;

/** La caja real de la marca dentro del lienzo del original. Se calcula por el
 *  canal alfa en vez de confiar en `trim()`, que con este archivo devuelve el
 *  lienzo entero. */
async function cajaDeLaMarca() {
  const { data, info } = await sharp(ORIGEN)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let x0 = width,
    y0 = height,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 8 y no 0: el PNG trae un borde de píxeles casi transparentes del
      // antialiasing, y tomarlos como marca agrandaría la caja un píxel por
      // lado sin que haya nada visible ahí.
      if (data[(y * width + x) * channels + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** La marca recortada y centrada en un cuadrado de `lado`, con el fondo que se
 *  le pida. */
async function icono(caja, lado, { ocupa, fondo }) {
  const interior = Math.round(lado * ocupa);
  const marca = await sharp(ORIGEN)
    .extract(caja)
    .resize({
      width: interior,
      height: interior,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      // `kernel: "lanczos3"` es el default y es el que hay que querer acá: a
      // 16px la separación entre los dos pétalos es de un píxel, y un
      // reescalado más blando la borra.
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: lado,
      height: lado,
      channels: 4,
      background: fondo,
    },
  })
    .composite([{ input: marca, gravity: "center" }])
    /*
     * Con paleta: el isotipo son tres colores planos —#0166ff, #2db0ff y
     * #f4dc00— más el antialiasing de los bordes, así que 256 entradas sobran y
     * el PNG de 512 pasa de 115 KB a 36 KB. Se midió; sin paleta se estaban
     * pagando 80 KB por colores que el dibujo no tiene.
     */
    .png({ palette: true, effort: 10, compressionLevel: 9 })
    .toBuffer();
}

/**
 * Empaqueta varios PNG en un .ico.
 *
 * Se arma a mano porque sharp no escribe .ico y no vale la pena una dependencia
 * más para cuarenta bytes de cabecera. El formato admite PNG adentro desde
 * Windows Vista, así que no hay que convertir a BMP ni perder el alfa.
 */
function empaquetarIco(imagenes) {
  const cabecera = Buffer.alloc(6);
  cabecera.writeUInt16LE(0, 0); // reservado
  cabecera.writeUInt16LE(1, 2); // 1 = icono
  cabecera.writeUInt16LE(imagenes.length, 4);

  let desplazamiento = 6 + imagenes.length * 16;
  const entradas = [];
  for (const { lado, datos } of imagenes) {
    const e = Buffer.alloc(16);
    // 0 significa 256: por eso el byte no alcanza para nada más grande.
    e.writeUInt8(lado >= 256 ? 0 : lado, 0);
    e.writeUInt8(lado >= 256 ? 0 : lado, 1);
    e.writeUInt8(0, 2); // paleta: ninguna
    e.writeUInt8(0, 3); // reservado
    e.writeUInt16LE(1, 4); // planos
    e.writeUInt16LE(32, 6); // bits por píxel
    e.writeUInt32LE(datos.length, 8);
    e.writeUInt32LE(desplazamiento, 12);
    entradas.push(e);
    desplazamiento += datos.length;
  }

  return Buffer.concat([
    cabecera,
    ...entradas,
    ...imagenes.map((i) => i.datos),
  ]);
}

const caja = await cajaDeLaMarca();
console.log(
  `marca recortada a ${caja.width}x${caja.height} (desde ${caja.left},${caja.top})`,
);

await mkdir(APP, { recursive: true });

const transparente = { r: 0, g: 0, b: 0, alpha: 0 };
const blanco = { r: 255, g: 255, b: 255, alpha: 1 };

const paraIco = [];
for (const lado of [16, 32, 48]) {
  paraIco.push({
    lado,
    datos: await icono(caja, lado, { ocupa: OCUPA, fondo: transparente }),
  });
}
const ico = empaquetarIco(paraIco);
await writeFile(path.join(APP, "favicon.ico"), ico);
console.log(
  `favicon.ico  ${ico.length} bytes  (${paraIco.map((i) => i.lado + "px").join(", ")})`,
);

const png512 = await icono(caja, 512, { ocupa: OCUPA, fondo: transparente });
await writeFile(path.join(APP, "icon.png"), png512);
console.log(`icon.png     ${png512.length} bytes  (512px, transparente)`);

const ios = await icono(caja, 180, { ocupa: OCUPA_IOS, fondo: blanco });
await writeFile(path.join(APP, "apple-icon.png"), ios);
console.log(`apple-icon   ${ios.length} bytes  (180px, sobre blanco)`);
