import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { type NextRequest } from "next/server";
import { rutaDe, tipoDe } from "@/lib/archivos";

/**
 * Sirve los archivos del depósito: fotos, PDF y audios, en `/archivos/<clave>`.
 *
 * En el servidor, nginx sirve esta misma carpeta directo (`location
 * /archivos/`) y casi nada llega acá. Esta ruta existe igual por dos cosas:
 * el optimizador de imágenes de Next pide las fotos a la propia aplicación,
 * no a nginx; y en una copia de desarrollo no hay nginx.
 *
 * - **Caché de un año, `immutable`:** ningún archivo cambia de contenido con
 *   el mismo nombre (las fotos y el PDF llevan sufijo al azar; el audio, la
 *   huella de su texto).
 * - **`Range`:** el visor del PDF y el reproductor de audio piden pedazos.
 * - **`nosniff`:** el tipo es el de la extensión, que eligió el servidor
 *   después de mirar los bytes; el navegador no tiene que adivinar otro.
 */

type Contexto = { params: Promise<{ ruta: string[] }> };

async function servir(request: NextRequest, { params }: Contexto, conCuerpo: boolean) {
  const { ruta } = await params;
  let archivo: string;
  try {
    archivo = rutaDe(ruta.join("/"));
  } catch {
    return new Response(null, { status: 404 });
  }
  let tamano: number;
  try {
    const s = await stat(archivo);
    if (!s.isFile()) return new Response(null, { status: 404 });
    tamano = s.size;
  } catch {
    return new Response(null, { status: 404 });
  }

  const cabeceras = new Headers({
    "Content-Type": tipoDe(archivo),
    "Cache-Control": "public, max-age=31536000, immutable",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  });

  let inicio = 0;
  let fin = tamano - 1;
  let estado = 200;
  const rango = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (rango && tamano > 0) {
    if (rango[1] === "") {
      // "bytes=-500": los últimos 500.
      inicio = Math.max(0, tamano - Number(rango[2]));
    } else {
      inicio = Number(rango[1]);
      if (rango[2] !== "") fin = Math.min(Number(rango[2]), tamano - 1);
    }
    if (inicio > fin || inicio >= tamano) {
      cabeceras.set("Content-Range", `bytes */${tamano}`);
      return new Response(null, { status: 416, headers: cabeceras });
    }
    estado = 206;
    cabeceras.set("Content-Range", `bytes ${inicio}-${fin}/${tamano}`);
  }
  cabeceras.set("Content-Length", String(tamano === 0 ? 0 : fin - inicio + 1));

  if (!conCuerpo || tamano === 0) return new Response(null, { status: estado, headers: cabeceras });
  const flujo = Readable.toWeb(createReadStream(archivo, { start: inicio, end: fin })) as ReadableStream;
  return new Response(flujo, { status: estado, headers: cabeceras });
}

export function GET(request: NextRequest, contexto: Contexto) {
  return servir(request, contexto, true);
}

export function HEAD(request: NextRequest, contexto: Contexto) {
  return servir(request, contexto, false);
}
