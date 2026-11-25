/**
 * Las subidas del diario —fotos, PDF del impreso, audio de la lectura en voz
 * alta— y su verificación.
 *
 * Hasta el 2026-11-25 hablaba con Supabase Storage. Desde la mudanza a la VPS
 * guarda en el disco del servidor, a través de `lib/archivos.ts`, y los
 * archivos se sirven en `/archivos/<clave>`. Las funciones de afuera son las
 * mismas, con los mismos nombres: el panel, `/api/voz` y el digitalizador no
 * tuvieron que cambiar.
 *
 * **Nada de este archivo puede correr en el cliente.**
 */

import "server-only";

import { createHash } from "node:crypto";
import {
  borrar,
  cabeza,
  claveDeUrl,
  escribir,
  firmarSubida,
  tamano,
  urlDe,
} from "@/lib/archivos";

const MAXIMO_BYTES = 8 * 1024 * 1024;

/**
 * Los tipos de foto que aceptamos, con su firma real. Se valida por los
 * **bytes del archivo**, no por el `type` que declara el navegador: ese campo
 * lo pone quien sube y puede decir cualquier cosa.
 */
const FIRMAS: { mime: string; ext: string; firma: number[] }[] = [
  { mime: "image/jpeg", ext: "jpg", firma: [0xff, 0xd8, 0xff] },
  { mime: "image/png", ext: "png", firma: [0x89, 0x50, 0x4e, 0x47] },
  // WebP es RIFF....WEBP: los bytes 8..11 son "WEBP", y eso se chequea aparte.
  { mime: "image/webp", ext: "webp", firma: [0x52, 0x49, 0x46, 0x46] },
];

function reconocer(bytes: Uint8Array): { mime: string; ext: string } | null {
  for (const f of FIRMAS) {
    if (f.firma.every((b, i) => bytes[i] === b)) {
      if (f.ext === "webp") {
        const marca = String.fromCharCode(...bytes.slice(8, 12));
        if (marca !== "WEBP") continue;
      }
      return { mime: f.mime, ext: f.ext };
    }
  }
  return null;
}

/** ¿Se puede subir? Con el depósito en disco, siempre. Se conserva porque
 *  `/api/voz` lo consulta. */
export function storageDisponible(): boolean {
  return true;
}

/**
 * Deja `que` como para ser parte de un nombre de archivo, y nada más: sin
 * acentos, en minúsculas, todo lo que no sea letra o número pasa a guión. Eso
 * deja afuera barras y `..`.
 */
function saneado(que: string, respaldo = "archivo"): string {
  const base = que
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
  return base || respaldo;
}

const sufijo = () => crypto.randomUUID().slice(0, 8);

/**
 * Sube una imagen desde el servidor (lo usa el digitalizador, con las figuras
 * que recorta del PDF) y devuelve su dirección.
 *
 * El nombre es el slug de la nota más un sufijo al azar: así cambiar una foto
 * nunca pisa la anterior mientras las cachés se ponen al día.
 */
export async function subirImagen(
  archivo: File,
  slugNota: string,
): Promise<{ url: string }> {
  if (archivo.size === 0) throw new Error("El archivo está vacío.");
  if (archivo.size > MAXIMO_BYTES) {
    throw new Error(
      `La foto pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB y el máximo ` +
        `son ${MAXIMO_BYTES / 1024 / 1024} MB. Achicala antes de subirla.`,
    );
  }
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const tipo = reconocer(bytes);
  if (!tipo) {
    throw new Error(
      "Ese archivo no es una imagen JPG, PNG o WebP. Si lo renombraste, el " +
        "contenido sigue siendo el de antes.",
    );
  }
  const clave = `${saneado(slugNota, "nota")}-${sufijo()}.${tipo.ext}`;
  await escribir(clave, bytes, { pisar: false });
  return { url: urlDe(clave) };
}

/* ------------------------------------------------------------------------
 * El audio de la lectura en voz alta
 *
 * La foto lleva un sufijo AL AZAR y el audio lleva una HUELLA DEL TEXTO: el
 * audio se guarda por lo que DICE. Si el editor corrige la bajada, cambia la
 * huella, cambia el nombre, y el audio viejo deja de pedirse solo. **Que nadie
 * lo "simplifique" a `voz/<slug>.mp3`**: una nota corregida seguiría sonando
 * con el texto anterior.
 * --------------------------------------------------------------------- */

/** Medio minuto de mp3 son unos 300 KB: cuatro megas no le pega a un audio
 *  legítimo y frena una respuesta rara del proveedor. */
const MAXIMO_BYTES_AUDIO = 4 * 1024 * 1024;
/** Un kilobyte es un archivo trunco o un cuerpo de error. */
const MINIMO_BYTES_AUDIO = 1024;

/** sha256 recortado a 16 hex, sobre el texto normalizado (NFC y espacios
 *  colapsados): un cambio que no se escucha no cambia el nombre. */
function huellaDe(texto: string): string {
  const normalizado = texto.normalize("NFC").replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalizado, "utf8").digest("hex").slice(0, 16);
}

/** La clave del audio: `voz/<que>-<huella del texto>.mp3`. */
export function claveDeAudio(que: string, texto: string): string {
  return `voz/${saneado(que, "audio")}-${huellaDe(texto)}.mp3`;
}

/** ¿Ya está ese audio? Su dirección, o `null`. Nunca tira: un problema es un
 *  `null`, y el llamador genera o cae a la voz del navegador. */
export async function urlDeAudioSiExiste(clave: string): Promise<string | null> {
  try {
    const bytes = await tamano(clave);
    return bytes !== null && bytes >= MINIMO_BYTES_AUDIO ? urlDe(clave) : null;
  } catch {
    return null;
  }
}

/**
 * Guarda el mp3 y devuelve su dirección. Pisa si ya existe: que exista
 * significa que dos lectores apretaron "Escuchar" a la vez y generaron el
 * mismo audio; pisarlo con bytes equivalentes no pierde nada.
 */
export async function subirAudio(bytes: Uint8Array, clave: string): Promise<string> {
  if (bytes.byteLength < MINIMO_BYTES_AUDIO) {
    throw new Error(
      `El audio pesa ${bytes.byteLength} bytes: eso no es un mp3 que se pueda escuchar.`,
    );
  }
  if (bytes.byteLength > MAXIMO_BYTES_AUDIO) {
    throw new Error(
      `El audio pesa ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB y el ` +
        `máximo son ${MAXIMO_BYTES_AUDIO / 1024 / 1024} MB.`,
    );
  }
  await escribir(clave, bytes, { pisar: true });
  return urlDe(clave);
}

/* ------------------------------------------------------------------------
 * Las subidas desde el panel
 *
 * El PDF y la foto de una nota no viajan por una Server Action (acepta 1 MB):
 * el servidor firma un permiso para UNA clave elegida por él, el navegador
 * hace el PUT a `/api/archivos/subir`, y después el servidor confirma mirando
 * los bytes. Ver `lib/archivos.ts`.
 * --------------------------------------------------------------------- */

const DESTINO = "/api/archivos/subir?t=";

/** Un diario de 12 a 24 páginas con fotos ronda los 10-30 MB. nginx tiene que
 *  aceptar al menos esto (`client_max_body_size`). */
const MAXIMO_BYTES_PDF = 50 * 1024 * 1024;
const MINIMO_BYTES_PDF = 1024;

/** Permiso para subir el PDF de una edición. El sufijo al azar evita pisar el
 *  anterior mientras los lectores con la página abierta se ponen al día. */
export async function urlFirmadaParaPdf(edicionSlug: string): Promise<{
  /** A dónde tiene que hacer el PUT el navegador. Lleva la firma adentro. */
  destino: string;
  /** Dónde va a quedar el archivo, para guardarlo en la edición. */
  urlPublica: string;
}> {
  const clave = `pdf/${saneado(edicionSlug, "edicion")}-${sufijo()}.pdf`;
  return {
    destino: DESTINO + firmarSubida(clave, "application/pdf", MAXIMO_BYTES_PDF),
    urlPublica: urlDe(clave),
  };
}

/** Comprueba que lo subido sea de verdad un PDF, y cuánto pesa. */
export async function verificarPdfSubido(url: string): Promise<{ bytes: number | null }> {
  const clave = claveDeUrl(url);
  let leido: { bytes: Uint8Array; tamano: number };
  try {
    leido = await cabeza(clave, 5);
  } catch {
    throw new Error("La subida no quedó guardada: en esa dirección no hay nada.");
  }
  if (String.fromCharCode(...leido.bytes.slice(0, 5)) !== "%PDF-") {
    await borrar(clave);
    throw new Error(
      "Lo que se subió no es un PDF. Si le cambiaste la extensión, el " +
        "contenido sigue siendo el de antes.",
    );
  }
  if (leido.tamano < MINIMO_BYTES_PDF) {
    await borrar(clave);
    throw new Error(`El archivo subido pesa ${leido.tamano} bytes: está trunco.`);
  }
  return { bytes: leido.tamano };
}

/** Debajo de esto no hay foto que valga. */
const MINIMO_BYTES_FOTO = 1024;

/**
 * Permiso para subir la foto de una nota. **La extensión la propone el
 * navegador y la decide esto**, contra la tabla de `FIRMAS`; después
 * `verificarFotoSubida()` la vuelve a comprobar contra los bytes reales.
 * Devuelve el `mime` para que el PUT lo mande tal cual.
 */
export async function urlFirmadaParaFoto(
  slugNota: string,
  ext: string,
): Promise<{ destino: string; urlPublica: string; mime: string }> {
  const tipo = FIRMAS.find((f) => f.ext === ext);
  if (!tipo) throw new Error("Sólo se pueden subir fotos JPG, PNG o WebP.");
  const clave = `${saneado(slugNota, "nota")}-${sufijo()}.${tipo.ext}`;
  return {
    destino: DESTINO + firmarSubida(clave, tipo.mime, MAXIMO_BYTES),
    urlPublica: urlDe(clave),
    mime: tipo.mime,
  };
}

/**
 * Comprueba que lo subido sea de verdad una foto del tipo que dice su nombre.
 * Si no pasa, **se borra**: no alcanza con no guardarlo en la nota, porque el
 * archivo ya es público.
 */
export async function verificarFotoSubida(url: string): Promise<{ bytes: number | null }> {
  const clave = claveDeUrl(url);
  let leido: { bytes: Uint8Array; tamano: number };
  try {
    leido = await cabeza(clave, 12);
  } catch {
    throw new Error("La subida no quedó guardada: en esa dirección no hay nada.");
  }
  const descartar = async (motivo: string): Promise<never> => {
    await borrar(clave);
    throw new Error(motivo);
  };
  const tipo = reconocer(leido.bytes);
  if (!tipo) {
    return descartar(
      "Lo que se subió no es una imagen JPG, PNG o WebP. Si le cambiaste la " +
        "extensión, el contenido sigue siendo el de antes.",
    );
  }
  if (!clave.endsWith(`.${tipo.ext}`)) {
    return descartar(
      `Se subió un ${tipo.ext.toUpperCase()} con nombre de ` +
        `${clave.split(".").pop()?.toUpperCase()}. La foto no se guardó.`,
    );
  }
  if (leido.tamano < MINIMO_BYTES_FOTO) {
    return descartar(`La foto subida pesa ${leido.tamano} bytes: está trunca.`);
  }
  if (leido.tamano > MAXIMO_BYTES) {
    return descartar(
      `La foto pesa ${(leido.tamano / 1024 / 1024).toFixed(1)} MB y el máximo son ` +
        `${MAXIMO_BYTES / 1024 / 1024} MB.`,
    );
  }
  return { bytes: leido.tamano };
}
