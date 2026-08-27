/**
 * Deriva las imágenes de Migue a partir del original que aportó el municipio.
 *
 * Se corre **a mano**, no en el build: el original no está en el repositorio y
 * los resultados sí. Existe para que esto sea reproducible y para dejar por
 * escrito las dos decisiones que no son obvias (abajo). Antes vivía en una
 * carpeta temporal, y por eso el arreglo del hueco entre las piernas hubo que
 * reconstruirlo desde cero.
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/migue-imagenes.mjs [ruta-al-original]
 *
 * `sharp` no está declarado en package.json: entra con Next, que lo usa para
 * optimizar imágenes. Alcanza para un script manual; si algún día Next deja de
 * traerlo, hay que agregarlo como dependencia de desarrollo.
 */
import sharp from "sharp";
import fs from "node:fs";

const ORIGEN =
  process.argv[2] ?? "C:/Users/brito/Downloads/MiguePeriodista.jpg";

/**
 * Qué se considera fondo.
 *
 * El fondo del original **no es blanco puro**: mide 247. Y la figura trae un
 * contorno blanco de calcomanía todavía más claro (252-255), así que el umbral
 * tiene que dejar pasar los dos.
 *
 * Es 214 y no 235 porque la sombra bajo los zapatos es un gris claro degradado:
 * con el valor alto quedaba un charco flotando bajo los pies en el tema oscuro.
 */
const UMBRAL = 214;

const { data, info } = await sharp(ORIGEN)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

const esFondo = (p) => {
  const i = p * C;
  return data[i] > UMBRAL && data[i + 1] > UMBRAL && data[i + 2] > UMBRAL;
};

/** Vuelve transparente todo lo claro conectado a `semillas`. Devuelve cuántos. */
function rellenar(semillas) {
  const pila = [...semillas];
  let n = 0;
  while (pila.length) {
    const p = pila.pop();
    if (p < 0 || p >= W * H) continue;
    const i = p * C;
    if (data[i + 3] === 0 || !esFondo(p)) continue;
    data[i + 3] = 0;
    n++;
    const x = p % W;
    if (x > 0) pila.push(p - 1);
    if (x < W - 1) pila.push(p + 1);
    pila.push(p - W, p + W);
  }
  return n;
}

// 1. El fondo de afuera, entrando por los cuatro bordes.
//
//    Se entra por los bordes y no se aplica un umbral a toda la imagen porque
//    hay partes CLARAS que son figura: la camisa y la credencial. Un umbral
//    simple las borraría.
const semillasBorde = [];
for (let x = 0; x < W; x++) semillasBorde.push(x, (H - 1) * W + x);
for (let y = 0; y < H; y++) semillasBorde.push(y * W, y * W + W - 1);
console.log(`  fondo de afuera: ${rellenar(semillasBorde)} px`);

/**
 * 2. Los huecos de fondo que quedan ENCERRADOS por la figura.
 *
 * Acá está el arreglo. Entrar sólo por los bordes deja opaco cualquier bolsón
 * de fondo que la figura rodee por completo, y hay dos: el hueco entre las
 * piernas —grande, del cinturón a los zapatos— y la ranura entre el brazo
 * derecho y el torso. En el tema claro no se notaban; en el oscuro el de las
 * piernas era una columna blanca que partía a Migue al medio.
 *
 * Van por punto semilla y no por una regla automática porque **ninguna regla
 * los separa de la credencial**: el hueco del brazo tiene 1.465 px y la cara de
 * la credencial 5.489, así que por tamaño se salvaría el hueco y se borraría la
 * credencial. Por color tampoco: los tres son gris casi blanco.
 *
 * El precio de ser explícito es que las semillas valen para ESTE original. Por
 * eso cada una viene con el tamaño que tiene que dar: si el municipio manda una
 * ilustración nueva, esto se planta en vez de agujerear a Migue en silencio.
 */
const HUECOS = [
  { nombre: "entre las piernas", x: 1051, y: 1840, esperado: 63580 },
  { nombre: "entre el brazo y el torso", x: 1246, y: 951, esperado: 1465 },
];

for (const h of HUECOS) {
  const n = rellenar([h.y * W + h.x]);
  const min = Math.round(h.esperado * 0.5);
  const max = Math.round(h.esperado * 1.5);
  if (n < min || n > max) {
    throw new Error(
      `El hueco "${h.nombre}" dio ${n} px y se esperaban ~${h.esperado} ` +
        `(entre ${min} y ${max}). El original no es el mismo: revisá la ` +
        `semilla (${h.x}, ${h.y}) antes de seguir, o vas a borrar otra cosa.`,
    );
  }
  console.log(`  hueco ${h.nombre}: ${n} px`);
}


/**
 * 3. La sombra del piso, que quedaba como un borde pálido bajo los zapatos.
 *
 * El original tiene a Migue parado sobre una sombra gris clara y degradada. El
 * umbral de arriba se lleva la parte más clara y deja la más oscura, así que en
 * el tema oscuro quedaba un contorno pálido abrazando las suelas: el mismo
 * aspecto de calcomanía recortada que el hueco entre las piernas, más fino.
 *
 * Se sigue por CONEXIÓN, no por umbral: se avanza desde lo que ya es
 * transparente hacia los píxeles claros y **neutros** —gris sin color—, que es
 * lo que la sombra es. Por umbral suelto no se puede, porque la camisa de Migue
 * también es gris claro; pero la camisa está encerrada por la campera y a ella
 * no se llega nunca. Los pantalones no califican por oscuros y los zapatos y la
 * piel, por tener color.
 *
 * La transparencia va en rampa y no de golpe: entre 150 y 200 la sombra se
 * desvanece en vez de cortarse, que es lo que dejaría un borde nuevo justo
 * donde estaba el viejo.
 */
const SOMBRA_CLARA = 200; // de acá para arriba, fondo puro
const SOMBRA_OSCURA = 150; // de acá para abajo, ya no es sombra

let pixelesDeSombra = 0;
{
  const pila = [];
  const visto = new Uint8Array(W * H);
  // Se arranca desde todo lo que ya quedó transparente.
  for (let p = 0; p < W * H; p++) {
    if (data[p * C + 3] === 0) {
      visto[p] = 1;
      pila.push(p);
    }
  }
  while (pila.length) {
    const p = pila.pop();
    const x = p % W,
      y = (p / W) | 0;
    for (const q of [
      x > 0 ? p - 1 : -1,
      x < W - 1 ? p + 1 : -1,
      y > 0 ? p - W : -1,
      y < H - 1 ? p + W : -1,
    ]) {
      if (q < 0 || visto[q]) continue;
      const i = q * C;
      const mn = Math.min(data[i], data[i + 1], data[i + 2]);
      const sat = Math.max(data[i], data[i + 1], data[i + 2]) - mn;
      if (mn <= SOMBRA_OSCURA || sat >= 25) continue;
      visto[q] = 1;
      const alfa =
        mn >= SOMBRA_CLARA
          ? 0
          : Math.round((255 * (SOMBRA_CLARA - mn)) / (SOMBRA_CLARA - SOMBRA_OSCURA));
      if (alfa < data[i + 3]) {
        data[i + 3] = alfa;
        pixelesDeSombra++;
      }
      pila.push(q);
    }
  }
}
console.log(`  sombra del piso: ${pixelesDeSombra} px desvanecidos`);

/**
 * 4. Red de seguridad: ¿quedó algún otro bolsón de fondo sin sacar?
 *
 * Lo más grande que TIENE que quedar opaco y claro es la cara de la credencial,
 * 5.489 px. Cualquier isla clara más grande que eso es un hueco nuevo que
 * nadie miró — justo el error que este script vino a arreglar.
 */
const TOPE_ISLA = 6000;
const visto = new Uint8Array(W * H);
let mayor = { n: 0, x: 0, y: 0 };
for (let p0 = 0; p0 < W * H; p0++) {
  if (visto[p0] || data[p0 * C + 3] === 0 || !esFondo(p0)) continue;
  const pila = [p0];
  visto[p0] = 1;
  let n = 0;
  while (pila.length) {
    const p = pila.pop();
    n++;
    const x = p % W,
      y = (p / W) | 0;
    for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]) {
      if (q >= 0 && !visto[q] && data[q * C + 3] !== 0 && esFondo(q)) {
        visto[q] = 1;
        pila.push(q);
      }
    }
  }
  if (n > mayor.n) mayor = { n, x: p0 % W, y: (p0 / W) | 0 };
}
console.log(`  isla clara más grande que queda: ${mayor.n} px en (${mayor.x}, ${mayor.y})`);
if (mayor.n > TOPE_ISLA) {
  throw new Error(
    `Quedó una isla clara de ${mayor.n} px en (${mayor.x}, ${mayor.y}), por ` +
      `encima del tope de ${TOPE_ISLA}. Miralá: si es fondo encerrado, agregala ` +
      `a HUECOS; si es figura, subí el tope y dejá dicho qué es.`,
  );
}

const png = await sharp(data, { raw: { width: W, height: H, channels: C } })
  .png()
  .toBuffer();

// La cara: cabeza y hombros. Un cuerpo entero dentro de un círculo de 44 px no
// se lee.
//
// El rectángulo se recuperó buscando cuál reproduce exactamente la silueta del
// retrato que ya estaba publicado: el script original se había perdido y un
// recorte a ojo le comía los hombros. Que este archivo esté en el repositorio
// es para que eso no vuelva a pasar.
await sharp(png)
  .extract({ left: 755, top: 8, width: 640, height: 640 })
  .resize(320, 320, { fit: "cover" })
  .webp({ quality: 88 })
  .toFile("public/migue/retrato.webp");

// La figura entera, recortada a lo que ocupa de verdad.
await sharp(png)
  .trim({ threshold: 1 })
  .resize({ height: 900, withoutEnlargement: true })
  .webp({ quality: 86 })
  .toFile("public/migue/cuerpo.webp");

for (const f of ["retrato", "cuerpo"]) {
  const m = await sharp(`public/migue/${f}.webp`).metadata();
  const kb = (fs.statSync(`public/migue/${f}.webp`).size / 1024).toFixed(0);
  console.log(`  ${f}.webp: ${m.width}x${m.height}, ${kb} kB, alfa: ${m.hasAlpha}`);
}
