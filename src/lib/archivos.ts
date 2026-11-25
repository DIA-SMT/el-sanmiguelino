import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, open, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

/**
 * El depósito de archivos del diario: fotos, PDF del impreso y audios de la
 * lectura en voz alta, en el disco del servidor.
 *
 * Hasta el 2026-11-25 vivían en Supabase Storage. Con la mudanza a la VPS
 * pasaron a una carpeta del propio servidor (`ARCHIVOS_DIR`), compartida
 * entre versiones del sitio, y se sirven en `/archivos/<clave>`.
 *
 * **La clave** es el nombre relativo dentro del depósito, con la misma forma
 * que tenía en el bucket: `<slug>-<8 hex>.<ext>` para las fotos,
 * `pdf/<slug>-<8 hex>.pdf` para el impreso y `voz/<que>-<huella>.mp3` para el
 * audio. Ninguna la elige quien sube: las arma el servidor. Y todas pasan por
 * `rutaDe()`, que no deja salir de la carpeta.
 */

export const PREFIJO = "/archivos/";

/** Lo que se puede guardar, con el tipo con que se sirve. La extensión manda:
 *  un archivo se sirve siempre como lo que dice su nombre, y el nombre lo
 *  pone el servidor después de mirar los bytes. */
export const TIPOS: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
  mp3: "audio/mpeg",
};

/** La forma de una clave válida. Sin `..`, sin barras de más, sin mayúsculas. */
const CLAVE = /^(?:pdf\/|voz\/)?[a-z0-9]+(?:-[a-z0-9]+)*\.(jpg|png|webp|pdf|mp3)$/;

/**
 * La carpeta del depósito. En el servidor, `ARCHIVOS_DIR`
 * (`/srv/sanmiguelino/compartido/archivos`); en una copia de desarrollo, una
 * carpeta `.archivos` del proyecto, que no va a git.
 */
export function carpeta(): string {
  // `turbopackIgnore`: sin la marca, el armado de Next ve un acceso al disco
  // que sale de `process.cwd()` y mete el proyecto entero en el paquete del
  // servidor.
  return path.resolve(process.env.ARCHIVOS_DIR?.trim() || path.join(/* turbopackIgnore: true */ process.cwd(), ".archivos"));
}

export function esClave(clave: string): boolean {
  return CLAVE.test(clave);
}

/** La ruta en disco de una clave, o un error si la clave no es válida. */
export function rutaDe(clave: string): string {
  if (!esClave(clave)) throw new Error("Ese nombre de archivo no es válido.");
  const base = carpeta();
  const ruta = path.resolve(base, clave);
  // Doble cerrojo: la expresión ya no deja pasar `..`, y esto verifica que la
  // ruta resuelta siga adentro de la carpeta.
  if (!ruta.startsWith(base + path.sep)) throw new Error("Ese nombre de archivo no es válido.");
  return ruta;
}

export function tipoDe(clave: string): string {
  return TIPOS[clave.split(".").pop() ?? ""] ?? "application/octet-stream";
}

export function urlDe(clave: string): string {
  return `${PREFIJO}${clave}`;
}

/** La clave de una dirección `/archivos/…`, exigiendo que sea nuestra. */
export function claveDeUrl(url: string): string {
  if (!url.startsWith(PREFIJO)) throw new Error("Esa dirección no es de los archivos del diario.");
  const clave = url.slice(PREFIJO.length).split(/[?#]/)[0];
  rutaDe(clave);
  return clave;
}

/** Cuánto pesa, o null si no está. */
export async function tamano(clave: string): Promise<number | null> {
  try {
    const s = await stat(rutaDe(clave));
    return s.isFile() ? s.size : null;
  } catch {
    return null;
  }
}

/** Los primeros `n` bytes y el tamaño total, para mirar qué es de verdad. */
export async function cabeza(
  clave: string,
  n: number,
): Promise<{ bytes: Uint8Array; tamano: number }> {
  const manejador = await open(rutaDe(clave), "r");
  try {
    const { size } = await manejador.stat();
    const buffer = new Uint8Array(Math.min(n, size));
    await manejador.read(buffer, 0, buffer.length, 0);
    return { bytes: buffer, tamano: size };
  } finally {
    await manejador.close();
  }
}

/** El archivo entero (para el PDF que se digitaliza). */
export async function leer(clave: string): Promise<Uint8Array> {
  const manejador = await open(rutaDe(clave), "r");
  try {
    return new Uint8Array(await manejador.readFile());
  } finally {
    await manejador.close();
  }
}

/**
 * Escribe un archivo. Primero a un temporal y después se renombra: nadie
 * puede leer un archivo a medio escribir, y un corte en el medio no deja un
 * archivo trunco con el nombre definitivo.
 *
 * `pisar: false` (fotos y PDF, que llevan sufijo al azar) falla si ya existe;
 * `pisar: true` (audio, que se nombra por su contenido) lo reemplaza.
 */
export async function escribir(
  clave: string,
  bytes: Uint8Array,
  { pisar }: { pisar: boolean },
): Promise<void> {
  const destino = rutaDe(clave);
  await mkdir(path.dirname(destino), { recursive: true });
  if (!pisar && (await tamano(clave)) !== null) {
    throw new Error("Ya hay un archivo con ese nombre.");
  }
  const temporal = await nuevoTemporal();
  const manejador = await open(temporal, "wx");
  try {
    await manejador.writeFile(bytes);
  } finally {
    await manejador.close();
  }
  await rename(temporal, destino);
}

/** Un nombre de temporal dentro del depósito, en una carpeta propia: así el
 *  `rename` es dentro del mismo disco y es atómico. */
export async function nuevoTemporal(): Promise<string> {
  const dir = path.join(carpeta(), ".subiendo");
  await mkdir(dir, { recursive: true });
  return path.join(dir, randomUUID());
}

/** Pasa un temporal ya escrito a su nombre definitivo, sin pisar nada. */
export async function confirmarTemporal(temporal: string, clave: string): Promise<void> {
  const destino = rutaDe(clave);
  await mkdir(path.dirname(destino), { recursive: true });
  if ((await tamano(clave)) !== null) {
    await rm(temporal, { force: true });
    throw new Error("Ya hay un archivo con ese nombre.");
  }
  await rename(temporal, destino);
}

export async function borrar(clave: string): Promise<void> {
  await rm(rutaDe(clave), { force: true });
}

/* --------------------------------------------------------- firma de subida */

/**
 * Las subidas desde el panel (fotos y PDF) no pasan por una Server Action:
 * una acción acepta 1 MB y un PDF pesa decenas. El servidor firma un permiso
 * para UNA clave, con tipo, tope de bytes y vencimiento, y el navegador hace
 * el PUT a `/api/archivos/subir?t=<firma>`. Es el mismo modelo que tenía la
 * URL firmada de Supabase: la llave es la firma, que sólo se le da a quien
 * pasó `requerirAdmin()`.
 */

const DOMINIO = "sanmiguelino:archivos:v1";
const VIDA_S = 600;

export interface PermisoDeSubida {
  clave: string;
  mime: string;
  maximo: number;
  vence: number;
}

function secreto(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET falta o es corto: no se firman subidas.");
  }
  return "dev-secret-cambiar-en-produccion";
}

function firmaDe(cuerpo: string): string {
  return createHmac("sha256", secreto()).update(`${DOMINIO}:${cuerpo}`).digest("base64url");
}

export function firmarSubida(clave: string, mime: string, maximo: number): string {
  rutaDe(clave);
  const permiso: PermisoDeSubida = {
    clave,
    mime,
    maximo,
    vence: Math.floor(Date.now() / 1000) + VIDA_S,
  };
  const cuerpo = Buffer.from(JSON.stringify(permiso)).toString("base64url");
  return `${cuerpo}.${firmaDe(cuerpo)}`;
}

export function leerFirmaDeSubida(token: string | null): PermisoDeSubida | null {
  if (!token || token.length > 2000) return null;
  const [cuerpo, dada] = token.split(".");
  if (!cuerpo || !dada) return null;
  const esperada = Buffer.from(firmaDe(cuerpo));
  const recibida = Buffer.from(dada);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  try {
    const p = JSON.parse(Buffer.from(cuerpo, "base64url").toString()) as PermisoDeSubida;
    if (p.vence * 1000 < Date.now() || !esClave(p.clave)) return null;
    return p;
  } catch {
    return null;
  }
}
