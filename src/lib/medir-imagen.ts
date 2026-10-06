import { open } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

/**
 * Cuánto mide una imagen, leyendo su encabezado.
 *
 * Existe porque las fotos de las notas son **remotas** —viven en el Storage de
 * Supabase— y `next/image` no puede saber su tamaño: se dibujan con `fill`, y
 * la caja tiene que tener la proporción de la foto. Con una caja fija, una
 * vertical perdía dos tercios —lo primero que se iba era la cara, pasó con la
 * tapa de septiembre— y una panorámica perdía los costados, con los rótulos
 * que tenía encima (el Paseo Alberdi de octubre).
 *
 * No se guarda el tamaño en la base a propósito: habría que migrar el esquema y
 * volver a subir todas las fotos que ya están, y esto arregla también las
 * viejas sin tocar nada.
 *
 * Se leen los primeros 64 kB —no la imagen entera— y sólo el encabezado. La
 * respuesta se cachea un mes: el archivo de una URL no cambia de tamaño, y si
 * se reemplaza, se sube con otro nombre.
 */

export interface Medidas {
  ancho: number;
  alto: number;
}

const UN_MES = 60 * 60 * 24 * 30;

const be16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const be32 = (b: Uint8Array, i: number) =>
  ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const le16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const le24 = (b: Uint8Array, i: number) =>
  b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const texto = (b: Uint8Array, i: number, n: number) =>
  String.fromCharCode(...b.slice(i, i + n));

/** PNG, JPEG y WebP: los tres formatos que acepta el panel. */
function leerEncabezado(b: Uint8Array): Medidas | null {
  // PNG: firma de 8 bytes y IHDR justo después.
  if (b.length > 24 && be32(b, 0) === 0x89504e47) {
    return { ancho: be32(b, 16), alto: be32(b, 20) };
  }

  // WebP: RIFF ... WEBP, y después el chunk, que puede ser de tres tipos.
  if (b.length > 30 && texto(b, 0, 4) === "RIFF" && texto(b, 8, 4) === "WEBP") {
    const tipo = texto(b, 12, 4);
    if (tipo === "VP8X") {
      return { ancho: le24(b, 24) + 1, alto: le24(b, 27) + 1 };
    }
    if (tipo === "VP8 ") {
      return { ancho: le16(b, 26) & 0x3fff, alto: le16(b, 28) & 0x3fff };
    }
    if (tipo === "VP8L" && b[20] === 0x2f) {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return {
        ancho: (bits & 0x3fff) + 1,
        alto: ((bits >> 14) & 0x3fff) + 1,
      };
    }
    return null;
  }

  // JPEG: se recorren los marcadores hasta el SOF, que es el que trae el tamaño.
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marca = b[i + 1];
      // SOF0..SOF15, salteando DHT (C4), JPG (C8) y DAC (CC), que no lo son.
      if (
        marca >= 0xc0 &&
        marca <= 0xcf &&
        marca !== 0xc4 &&
        marca !== 0xc8 &&
        marca !== 0xcc
      ) {
        return { alto: be16(b, i + 5), ancho: be16(b, i + 7) };
      }
      i += 2 + be16(b, i + 2);
    }
  }
  return null;
}

/** Una medida absurda es peor que ninguna: con null, la figura muestra la foto
 *  entera dentro de una caja fija (ver `FiguraNota`). */
function valida(medidas: Medidas | null): Medidas | null {
  if (!medidas || medidas.ancho < 2 || medidas.alto < 2) return null;
  return medidas;
}

/**
 * Las fotos que viven en `/public` —las históricas, commiteadas— se miden
 * leyendo el archivo. Antes sólo se medían las remotas, y una foto local caía
 * siempre en la caja de proporción fija: una panorámica salía recortada.
 */
async function medirLocal(ruta: string): Promise<Medidas | null> {
  const publica = path.join(process.cwd(), "public");
  const archivo = path.join(publica, ruta.split("?")[0]);
  // Nada fuera de /public, aunque la ruta traiga `..`.
  if (!archivo.startsWith(publica + path.sep)) return null;
  const manejador = await open(archivo, "r");
  try {
    const bytes = new Uint8Array(65536);
    const { bytesRead } = await manejador.read(bytes, 0, bytes.length, 0);
    return valida(leerEncabezado(bytes.subarray(0, bytesRead)));
  } finally {
    await manejador.close();
  }
}

export const medirImagen = cache(
  async (url: string): Promise<Medidas | null> => {
    try {
      if (url.startsWith("/")) return await medirLocal(url);
      if (!url.startsWith("http")) return null;
      const res = await fetch(url, {
        headers: { Range: "bytes=0-65535" },
        next: { revalidate: UN_MES },
      });
      if (!res.ok) return null;
      return valida(leerEncabezado(new Uint8Array(await res.arrayBuffer())));
    } catch {
      return null;
    }
  },
);
