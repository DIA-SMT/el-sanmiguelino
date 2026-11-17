import {
  confirmarSubidaFotoAction,
  firmarSubidaFotoAction,
} from "@/app/admin/acciones";

/**
 * Subir una foto al storage desde el navegador del panel.
 *
 * Es el mismo camino que la foto de una nota (`editor-nota.tsx`): el servidor
 * firma una subida directa (una Server Action acepta 1 MB y una foto pesa
 * más), el navegador sube con `PUT` y el servidor confirma que lo que llegó es
 * de verdad una imagen. Vive acá desde que el newsletter también sube fotos.
 */

/** El mismo tope que valida el servidor en `verificarFotoSubida()`. Acá está
 *  para avisar ANTES de esperar una subida entera, no para reemplazarlo. */
export const MAXIMO_BYTES_FOTO = 8 * 1024 * 1024;

/**
 * Qué imagen es, mirando los bytes y no el nombre.
 *
 * Es la misma tabla que `FIRMAS` en `src/lib/storage.ts`, recortada a lo que el
 * navegador necesita: la extensión. Está duplicada porque aquel archivo es
 * `server-only` —lleva la `service_role`— y no se puede importar desde acá.
 *
 * WebP es `RIFF....WEBP`: la marca vive en los bytes 8..11, no al principio.
 */
export function extensionDeImagen(bytes: Uint8Array): string | null {
  const empieza = (...firma: number[]) => firma.every((b, i) => bytes[i] === b);
  if (empieza(0xff, 0xd8, 0xff)) return "jpg";
  if (empieza(0x89, 0x50, 0x4e, 0x47)) return "png";
  if (empieza(0x52, 0x49, 0x46, 0x46)) {
    return String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" ? "webp" : null;
  }
  return null;
}

/** Lo que tira la propia subida —el archivo, el PUT, el storage— y ya viene con
 *  un mensaje que se puede mostrar tal cual. Existe para distinguirlo de que
 *  RECHACE una Server Action, que es otra cosa y se cuenta distinto. */
export class FalloDeSubida extends Error {}

/** El lado más largo de una foto subida desde el panel. Alcanza para una
 *  pantalla grande en alta densidad y deja la foto en unos cientos de KB. */
const LADO_MAXIMO = 2000;
/** Debajo de esto no se toca: ya es liviana. */
const PESO_SIN_TOCAR = 600 * 1024;

/**
 * Achica la foto en el navegador antes de subirla, si hace falta.
 *
 * Desde el 2026-11-17 las fotos se sirven tal cual se suben (Vercel dejó de
 * optimizarlas, ver `images.unoptimized` en next.config.ts): una foto de
 * teléfono de 8 MB llegaría así a cada lector. Acá se lleva a 2000 px y JPEG
 * —que se ve en todos lados, también en los correos— si pesa más de 600 KB o
 * es más grande que eso. Si el navegador no puede (formato raro, poca
 * memoria), se sube la original: achicar es una mejora, no un requisito.
 */
export async function achicarFoto(archivo: File): Promise<File> {
  try {
    const imagen = await createImageBitmap(archivo);
    const lado = Math.max(imagen.width, imagen.height);
    if (archivo.size <= PESO_SIN_TOCAR && lado <= LADO_MAXIMO) {
      imagen.close();
      return archivo;
    }
    const escala = Math.min(1, LADO_MAXIMO / lado);
    const ancho = Math.round(imagen.width * escala);
    const alto = Math.round(imagen.height * escala);
    const lienzo = new OffscreenCanvas(ancho, alto);
    const ctx = lienzo.getContext("2d");
    if (!ctx) return archivo;
    // Fondo blanco: un PNG con transparencia en JPEG quedaría negro.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(imagen, 0, 0, ancho, alto);
    imagen.close();
    const blob = await lienzo.convertToBlob({ type: "image/jpeg", quality: 0.85 });
    if (blob.size >= archivo.size) return archivo;
    const nombre = archivo.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nombre, { type: "image/jpeg" });
  } catch {
    return archivo;
  }
}

/**
 * Sube la foto y devuelve su dirección pública ya verificada. Tira
 * `FalloDeSubida` con un mensaje para mostrar; si tira otra cosa, lo más
 * probable es que se haya vencido la sesión.
 */
export async function subirFoto(
  original: File,
  nombre: string,
  alAvanzar: (porcentaje: number) => void = () => {},
): Promise<string> {
  if (original.size === 0) throw new FalloDeSubida("El archivo está vacío.");
  const archivo = await achicarFoto(original);
  if (archivo.size > MAXIMO_BYTES_FOTO) {
    throw new FalloDeSubida(
      `La foto pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB y el máximo ` +
        `son ${MAXIMO_BYTES_FOTO / 1024 / 1024} MB. Achicala antes de subirla.`,
    );
  }
  let ext: string | null;
  try {
    ext = extensionDeImagen(new Uint8Array(await archivo.slice(0, 12).arrayBuffer()));
  } catch {
    throw new FalloDeSubida("No se pudo leer el archivo elegido.");
  }
  if (!ext) {
    throw new FalloDeSubida(
      "Ese archivo no es una imagen JPG, PNG o WebP. Si lo renombraste, el " +
        "contenido sigue siendo el de antes.",
    );
  }

  const firma = await firmarSubidaFotoAction({ slug: nombre, ext });
  if (!firma.ok || !firma.destino || !firma.urlPublica || !firma.mime) {
    throw new FalloDeSubida(firma.error ?? "No se pudo preparar la subida.");
  }

  // XMLHttpRequest y no `fetch`: `fetch` no informa el avance de una subida.
  await new Promise<void>((listo, falla) => {
    const pedido = new XMLHttpRequest();
    pedido.open("PUT", firma.destino!);
    pedido.setRequestHeader("Content-Type", firma.mime!);
    pedido.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) alAvanzar(Math.round((e.loaded / e.total) * 100));
    });
    pedido.addEventListener("load", () =>
      pedido.status >= 200 && pedido.status < 300
        ? listo()
        : falla(new FalloDeSubida(`Storage rechazó la foto (${pedido.status}).`)),
    );
    pedido.addEventListener("error", () =>
      falla(new FalloDeSubida("Se cortó la conexión mientras subía la foto.")),
    );
    pedido.addEventListener("abort", () =>
      falla(new FalloDeSubida("La subida se canceló.")),
    );
    pedido.send(archivo);
  });

  const res = await confirmarSubidaFotoAction(firma.urlPublica);
  if (!res.ok || !res.url) {
    throw new FalloDeSubida(res.error ?? "No se pudo subir la foto.");
  }
  return res.url;
}
