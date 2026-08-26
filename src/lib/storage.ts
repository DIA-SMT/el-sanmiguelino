/**
 * Subida de fotos a Supabase Storage.
 *
 * Habla la API REST con `fetch` en vez de traer el SDK de Supabase. Son
 * treinta líneas contra un paquete entero, y sobre todo: el SDK está pensado
 * para correr también en el navegador, y acá lo único que puede pasar es que
 * alguna vez alguien lo importe de un componente cliente y se lleve la clave
 * `service_role` al bundle. Lo que no está instalado no se importa por
 * accidente.
 *
 * **Nada de este archivo puede correr en el cliente.** La clave saltea toda
 * política de acceso: quien la tenga puede leer y escribir la base entera, no
 * sólo el storage.
 */

import "server-only";

const MAXIMO_BYTES = 8 * 1024 * 1024;

/**
 * Los tipos que aceptamos, con su firma real.
 *
 * Se valida por los **bytes del archivo**, no por el `type` que declara el
 * navegador: ese campo lo pone quien sube y se puede decir cualquier cosa. Un
 * archivo que dice ser `image/png` y no lo es termina servido desde nuestro
 * dominio, y si el navegador de un lector lo interpreta de otra forma, es un
 * problema nuestro.
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

interface Config {
  url: string;
  bucket: string;
  clave: string;
}

function config(): Config | null {
  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_BUCKET ?? "diario";
  if (!url || !clave) return null;
  return { url: url.replace(/\/+$/, ""), bucket, clave };
}

/** ¿Se puede subir? El panel lo consulta para no ofrecer un botón que no
 *  puede cumplir. */
export function storageDisponible(): boolean {
  return config() !== null;
}

/**
 * Sube una imagen y devuelve su URL pública.
 *
 * El nombre del archivo lo elegimos nosotros a partir del slug de la nota más
 * un sufijo al azar. El nombre original no se usa: puede traer acentos,
 * espacios, barras o `..`, y un nombre que el usuario controla dentro de una
 * ruta es la forma clásica de escribir donde no corresponde.
 *
 * El sufijo al azar además evita pisar la foto anterior al cambiarla: la vieja
 * queda huérfana en el bucket, que es barato, y a cambio ninguna nota se queda
 * sin imagen mientras las cachés se ponen al día.
 */
export async function subirImagen(
  archivo: File,
  slugNota: string,
): Promise<{ url: string }> {
  const cfg = config();
  if (!cfg) {
    throw new Error(
      "Falta configurar el storage: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

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

  const sufijo = crypto.randomUUID().slice(0, 8);
  const ruta = `${slugNota}-${sufijo}.${tipo.ext}`;

  const res = await fetch(
    `${cfg.url}/storage/v1/object/${cfg.bucket}/${ruta}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.clave}`,
        "Content-Type": tipo.mime,
        // Sin esto Supabase reusa el objeto si el nombre existe. Con el sufijo
        // al azar no debería pasar, pero fallar es mejor que pisar en silencio.
        "x-upsert": "false",
      },
      body: bytes,
    },
  );

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    // El mensaje de Supabase se acorta y no se muestra entero: puede traer
    // partes de la petición, y esto va a parar a la pantalla del editor.
    throw new Error(
      `Storage rechazó la subida (${res.status}). ` +
        (res.status === 404
          ? `¿Existe el bucket "${cfg.bucket}"?`
          : detalle.slice(0, 120)),
    );
  }

  return {
    url: `${cfg.url}/storage/v1/object/public/${cfg.bucket}/${ruta}`,
  };
}
