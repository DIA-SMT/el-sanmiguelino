/**
 * Subida de fotos —y del audio de la lectura en voz alta— a Supabase Storage.
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

import { createHash } from "node:crypto";

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

/**
 * La configuración del storage, tratando la cadena vacía como ausente.
 *
 * `?.trim() || …` y no `?? …`: en un `.env` una variable declarada y sin valor
 * llega como `""`, no como `undefined`, así que `??` NO la ataja. Es la misma
 * trampa que resuelve `clave()` en `src/lib/voz/elevenlabs.ts`, y acá costaba
 * plata: con `SUPABASE_BUCKET=` vacía —que es como queda al copiar
 * `.env.example`— el bucket quedaba en `""`, `storageDisponible()` decía que
 * sí, las URLs salían con doble barra, el HEAD daba 404, se generaba el audio
 * en ElevenLabs (se paga), la subida daba otro 404 y se tiraba, y el lector
 * escuchaba con la voz del navegador sin que nadie viera nada raro. Fallaba en
 * silencio y cobrando.
 *
 * El `trim()` en `url` y `clave` es por lo mismo: un espacio pegado al copiar
 * la `service_role` pasaba como clave válida y volvía un 401 que no explica
 * nada.
 */
function config(): Config | null {
  const url = process.env.SUPABASE_URL?.trim();
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_BUCKET?.trim() || "diario";
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

/* ------------------------------------------------------------------------
 * El audio de la lectura en voz alta
 *
 * Mismo bucket y misma forma de hablarle que las fotos. Lo que cambia es
 * cómo se nombra el objeto: la foto lleva un sufijo AL AZAR y el audio lleva
 * una HUELLA DEL TEXTO. Ver `claveDeAudio`, que es donde está la razón.
 * --------------------------------------------------------------------- */

/**
 * Tope del mp3 que aceptamos guardar.
 *
 * Lo que se lee son sección, titular y bajada: medio minuto, unos 300 KB al
 * bitrate con el que sale de ElevenLabs. Cuatro megas es diez veces eso, o
 * sea que no le va a pegar a un audio legítimo; está para que una respuesta
 * rara del proveedor —un HTML de error, un stream que no termina— no se
 * convierta en un objeto enorme en un bucket que paga el municipio.
 */
const MAXIMO_BYTES_AUDIO = 4 * 1024 * 1024;

/**
 * Debajo de esto no hay audio que valga.
 *
 * Un mp3 de una sola oración pesa decenas de KB. Un kilobyte es un archivo
 * trunco o un cuerpo de error, y sirve para las dos puntas: para no subir
 * basura y para no dar por bueno lo que ya está guardado.
 */
const MINIMO_BYTES_AUDIO = 1024;

/**
 * Cuánto esperamos a que el storage diga si el audio ya está.
 *
 * Del otro lado hay alguien que apretó "Escuchar". Si el storage no contesta
 * rápido no conviene esperarlo: se responde que no está, y el llamador
 * genera o cae a la voz del navegador. Tardar de más acá es peor que
 * regenerar un audio.
 */
const ESPERA_CONSULTA_MS = 4_000;

function urlPublicaDe(cfg: Config, clave: string): string {
  return `${cfg.url}/storage/v1/object/public/${cfg.bucket}/${clave}`;
}

/**
 * Huella del texto: sha256 recortado a 16 hex.
 *
 * Recortado a propósito. No es una firma ni protege de nadie: sólo distingue
 * un texto de otro. Con 16 hex son 2^64 valores para un puñado de audios por
 * edición, así que dos textos distintos no van a caer en el mismo nombre.
 *
 * Antes de la huella el texto se normaliza —NFC y espacios colapsados— para
 * que un cambio que NO se escucha no cambie la clave: "á" tiene dos formas
 * de escribirse en Unicode y suenan igual, y dos espacios entre palabras
 * también. Sin esto, un copiar y pegar del editor regeneraría el mismo audio
 * con otro nombre.
 */
function huellaDe(texto: string): string {
  const normalizado = texto.normalize("NFC").replace(/\s+/g, " ").trim();
  return createHash("sha256")
    .update(normalizado, "utf8")
    .digest("hex")
    .slice(0, 16);
}

/**
 * Deja `que` como para ser el nombre de un objeto, y nada más.
 *
 * `que` viene de afuera —del cuerpo de `POST /api/voz`, donde el cliente
 * manda el slug— y termina dentro de una ruta. Se le sacan los acentos, se
 * baja a minúsculas y todo lo que no sea letra o número se vuelve un guión:
 * eso deja afuera las barras y los `..`, que es la forma clásica de escribir
 * donde no corresponde. Es el mismo criterio que ya usa `subirImagen` con el
 * nombre del archivo, por la misma razón.
 */
function saneado(que: string, respaldo = "audio"): string {
  const base = que
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
  // Un `que` que era todo símbolos no puede dejar la clave en `voz/-abc.mp3`.
  // El respaldo lo pone quien llama porque el nombre cuenta lo que es: una
  // clave de foto que diga "audio" manda a leer el archivo equivocado el día
  // que alguien mire el bucket a mano.
  return base || respaldo;
}

/**
 * La clave del audio en el bucket: `voz/<que>-<huella del texto>.mp3`.
 *
 * **La huella no es un detalle de prolijidad: es toda la estrategia de
 * invalidación.** El audio se guarda por lo que DICE, no por a qué nota
 * pertenece. Si el editor corrige la bajada, el texto cambia, la huella
 * cambia, la clave cambia, y el audio viejo simplemente deja de pedirse: la
 * próxima vez que alguien apriete "Escuchar" se busca una clave que no
 * existe y se genera la nueva. No hay nada que invalidar, no hay fecha de
 * vencimiento, no hay que acordarse de borrar nada desde el panel. El objeto
 * viejo queda huérfano en el bucket, que es barato.
 *
 * **Que nadie lo "simplifique" a `voz/<slug>.mp3`.** Se ve más limpio y trae
 * de vuelta el problema entero: una nota corregida seguiría sonando con el
 * texto anterior, para siempre y sin manera de darse cuenta desde la
 * pantalla —el título se lee bien y la voz dice otra cosa—. Es una
 * publicación oficial: la voz no puede leer una versión que el editor ya
 * corrigió.
 *
 * Dos `que` distintos que se sanean al mismo nombre no son un problema: si
 * además tienen el mismo texto, el mp3 es el mismo y da igual cuál se
 * guardó; y si el texto difiere, la huella difiere y las claves también.
 */
export function claveDeAudio(que: string, texto: string): string {
  return `voz/${saneado(que)}-${huellaDe(texto)}.mp3`;
}

/**
 * ¿Ya está ese audio? Devuelve su URL pública, o `null`.
 *
 * El bucket es de lectura pública, así que la URL se arma sola y no hace
 * falta pedirle nada a nadie para construirla. Lo que sí hace falta es saber
 * si el objeto está, para no gastar una generación de ElevenLabs en algo que
 * ya pagamos.
 *
 * Se resuelve con un **HEAD a la URL pública**, y no con la API de listado,
 * por tres razones:
 * - prueba exactamente el camino que va a usar el navegador del lector. Si
 *   alguien pasa el bucket a privado, el listado —que va con la
 *   `service_role`— seguiría diciendo "está" y el lector recibiría un error
 *   al reproducir. El HEAD anónimo se entera;
 * - es un pedido sin cuerpo y sin JSON que parsear, contra un POST con
 *   filtro por prefijo del que después hay que buscar el nombre exacto;
 * - no usa la clave maestra para una pregunta que cualquier lector puede
 *   hacer sin credenciales.
 *
 * Sobre el 200 con página de error: pasa —un proxy, un portal cautivo, un
 * bucket que devuelve su propio HTML— y sería lo peor de los dos mundos,
 * porque daríamos por bueno un archivo que no suena. Por eso no alcanza con
 * `res.ok`: se exige `content-type` de audio y, si viene el largo, que sea
 * de un mp3 y no de un cuerpo de error.
 *
 * Nunca tira: cualquier problema es un `null` y el llamador genera o cae a
 * la voz del navegador. Un storage caído no puede dejar a Migue mudo.
 */
export async function urlDeAudioSiExiste(clave: string): Promise<string | null> {
  const cfg = config();
  if (!cfg) return null;

  const url = urlPublicaDe(cfg, clave);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      // Sin esto Next puede guardarse la respuesta: un "no está" cacheado nos
      // haría regenerar el mismo audio una y otra vez.
      cache: "no-store",
      signal: AbortSignal.timeout(ESPERA_CONSULTA_MS),
    });
    if (!res.ok) return null;

    const tipo = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!tipo.startsWith("audio/")) return null;

    const largo = res.headers.get("content-length");
    if (largo !== null) {
      const bytes = Number(largo);
      if (!Number.isFinite(bytes) || bytes < MINIMO_BYTES_AUDIO) return null;
    }

    return url;
  } catch {
    // Se cortó la red, tardó más de la cuenta, el host no resuelve: para el
    // llamador es lo mismo que si el audio no estuviera.
    return null;
  }
}

/**
 * Sube el mp3 y devuelve su URL pública.
 *
 * Dos cosas se apartan de `subirImagen`, y las dos salen de que la clave
 * lleva la huella del texto:
 *
 * - **`x-upsert: true`** (la foto usa `false`). En la foto el nombre lleva un
 *   sufijo al azar: que exista es un choque imposible, o sea un bug, y ahí
 *   fallar es mejor que pisar en silencio. Acá el nombre es el contenido: que
 *   exista significa que dos lectores apretaron "Escuchar" al mismo tiempo y
 *   los dos generaron el mismo audio. Pisarlo con bytes equivalentes no
 *   pierde nada; fallar le mostraría un error al segundo lector por una
 *   carrera que no le importa a nadie.
 * - **un `Cache-Control` de un año que HOY NO TIENE EFECTO** (la foto se queda
 *   con el default de Supabase). La cabecera se manda porque el objeto la
 *   merece: un audio direccionado por contenido no se invalida nunca —si el
 *   texto cambia, cambia la clave— así que se puede decir `immutable` sin
 *   riesgo de que un lector escuche una versión vieja.
 *   **Pero Supabase la ignora, y esto se comprobó a mano contra el proyecto
 *   real:** se subió el mismo mp3 con las tres formas que la API acepta
 *   —`"31536000"`, `"max-age=31536000"` y
 *   `"public, max-age=31536000, immutable"`— y en los tres casos el objeto
 *   público devolvió `cache-control: no-cache`.
 *   No se saca porque no molesta y el día que Supabase la respete sirve, pero
 *   que quede escrito qué pasa hoy y no la promesa. Lo que de verdad ahorra
 *   ancho de banda mientras tanto es el ETag: la revalidación devuelve 304 y
 *   los 256 KB no se bajan de nuevo.
 *
 * Tira si no se pudo. El llamador —`/api/voz`— lo traduce a `{ url: null }`
 * para que el cliente lea con la voz del navegador.
 */
export async function subirAudio(
  bytes: Uint8Array,
  clave: string,
): Promise<string> {
  const cfg = config();
  if (!cfg) {
    throw new Error(
      "Falta configurar el storage: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  if (bytes.byteLength < MINIMO_BYTES_AUDIO) {
    throw new Error(
      `El audio pesa ${bytes.byteLength} bytes: eso no es un mp3 que se pueda ` +
        "escuchar.",
    );
  }
  if (bytes.byteLength > MAXIMO_BYTES_AUDIO) {
    throw new Error(
      `El audio pesa ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB y el ` +
        `máximo son ${MAXIMO_BYTES_AUDIO / 1024 / 1024} MB.`,
    );
  }

  const res = await fetch(`${cfg.url}/storage/v1/object/${cfg.bucket}/${clave}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.clave}`,
      "Content-Type": "audio/mpeg",
      // Hoy no hace nada: Supabase sirve el objeto público con `no-cache` pase
      // lo que pase acá (probado con las tres formas; ver el comentario de
      // arriba). Se deja para el día que la respete.
      "Cache-Control": "public, max-age=31536000, immutable",
      "x-upsert": "true",
    },
    // La copia no es de gusto: el cuerpo de `fetch` pide una vista sobre un
    // `ArrayBuffer`, y un `Uint8Array` a secas podría estar apoyado sobre
    // memoria compartida. Copiar unos cientos de KB una vez por audio no se
    // nota; cambiarle el tipo al parámetro sí, porque `generarAudio` devuelve
    // el `Uint8Array` genérico y no compilaría del otro lado.
    body: new Uint8Array(bytes),
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    // Igual que en las fotos: el mensaje de Supabase se acorta porque puede
    // traer partes de la petición.
    throw new Error(
      `Storage rechazó el audio (${res.status}). ` +
        (res.status === 404
          ? `¿Existe el bucket "${cfg.bucket}"?`
          : detalle.slice(0, 120)),
    );
  }

  return urlPublicaDe(cfg, clave);
}

/* ------------------------------------------------------------------------
 * Las subidas que NO pasan por el servidor
 *
 * Todo lo que sube alguien desde el panel —el PDF del impreso y la foto de una
 * nota— va del navegador derecho a Storage. El servidor sólo firma antes y
 * confirma después.
 *
 * **El motivo es un tope que no se puede negociar.** Una Server Action acepta
 * 1 MB de cuerpo por defecto, y en Vercel un request tiene un tope DURO de
 * 4,5 MB que ninguna configuración levanta. Un archivo que viaja por el
 * servidor anda en la máquina de quien lo programó y falla en producción con
 * el primer archivo de verdad.
 *
 * Esto estuvo escrito acá como si valiera sólo para el PDF —"la foto son
 * cientos de kilobytes y viaja por una Server Action sin problema"— y la foto
 * fue justamente lo que se rompió: la pantalla ofrecía 8 MB, `subirImagen()`
 * validaba 8 MB, y cualquier foto de teléfono rebotaba contra el megabyte de
 * la Server Action con un "no se pudo hablar con el servidor" que no decía
 * nada. **La regla es por dónde viaja el archivo, no cuánto se espera que
 * pese.**
 *
 * La forma: el servidor le pide a Storage una **URL firmada de un solo uso**
 * para una clave que elige él, y el navegador escribe directo en el bucket. Lo
 * que sale del servidor es un token acotado a esa única clave y con
 * vencimiento, no la `service_role`.
 * --------------------------------------------------------------------- */

/** Cuánto vive la firma de subida, en segundos. Diez minutos: es lo que puede
 *  tardar en subir un archivo grande desde una conexión municipal, y no tanto
 *  como para que un token olvidado en una pestaña sirva mañana. */
const VIDA_FIRMA_S = 600;

function esObjetoPlano(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Le pide a Storage permiso para escribir **una** clave, y nada más.
 *
 * Quien elige la clave es siempre el llamador, o sea el servidor: el nombre
 * que trae el archivo lo controla quien sube y puede llevar acentos, espacios,
 * barras o `..`. Acá pesa además que la firma autoriza exactamente esa clave,
 * así que elegirla es la mitad del control de acceso.
 */
async function firmaDeSubida(
  cfg: Config,
  clave: string,
): Promise<{ destino: string; urlPublica: string }> {
  const res = await fetch(
    `${cfg.url}/storage/v1/object/upload/sign/${cfg.bucket}/${clave}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.clave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: VIDA_FIRMA_S }),
    },
  );

  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    // Igual que al subir: el mensaje de Supabase se acorta porque puede traer
    // partes de la petición, y esto va a la pantalla del editor.
    throw new Error(
      `Storage no dio permiso para subir (${res.status}). ` +
        (res.status === 404
          ? `¿Existe el bucket "${cfg.bucket}"?`
          : detalle.slice(0, 120)),
    );
  }

  // Supabase contesta `{ url: "/object/upload/sign/<bucket>/<clave>?token=…" }`:
  // una ruta relativa a /storage/v1, no una dirección completa.
  const cuerpo: unknown = await res.json().catch(() => null);
  const relativa =
    esObjetoPlano(cuerpo) && typeof cuerpo.url === "string" ? cuerpo.url : null;
  if (!relativa) {
    throw new Error("Storage contestó una firma que no se entiende.");
  }

  return {
    destino: `${cfg.url}/storage/v1${relativa}`,
    urlPublica: urlPublicaDe(cfg, clave),
  };
}

/**
 * La clave de un objeto a partir de su dirección pública, exigiendo que sea
 * nuestra.
 *
 * La dirección la manda el cliente. Que tenga que caer dentro de NUESTRO
 * bucket es lo que impide que una edición del diario municipal termine
 * sirviendo un archivo alojado en cualquier otro lado.
 */
function claveDeUrlPublica(cfg: Config, url: string): string {
  const prefijo = `${cfg.url}/storage/v1/object/public/${cfg.bucket}/`;
  if (!url.startsWith(prefijo)) {
    throw new Error("Esa dirección no es del storage del diario.");
  }
  return url.slice(prefijo.length);
}

/**
 * Los primeros bytes de un objeto ya subido, más cuánto pesa y con qué tipo se
 * sirve.
 *
 * **Pide un `Range`, no un HEAD.** Un HEAD sólo puede mirar el `content-type`,
 * que es el que declaró el navegador al subir: o sea, lo mismo que estamos
 * tratando de verificar. Unos pocos bytes cuestan lo mismo que una cabecera y
 * dicen qué es el archivo de verdad. Es el mismo criterio que `subirImagen()`
 * con las firmas de las fotos: se valida por los bytes, no por lo que dice
 * quien sube.
 *
 * El tamaño sale de `content-range` (`bytes 0-4/12345678`), que es donde viaja
 * el total en una respuesta parcial.
 */
async function cabeceraDeObjeto(
  url: string,
  hasta: number,
): Promise<{ cabeza: Uint8Array; bytes: number | null; tipoServido: string }> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Range: `bytes=0-${hasta}` },
      cache: "no-store",
      signal: AbortSignal.timeout(ESPERA_CONSULTA_MS),
    });
  } catch {
    throw new Error(
      "No se pudo confirmar la subida: el storage no contestó a tiempo.",
    );
  }

  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? "La subida no quedó guardada: en esa dirección no hay nada."
        : `El storage contestó ${res.status} al confirmar la subida.`,
    );
  }

  const total = res.headers.get("content-range")?.match(/\/(\d+)$/)?.[1];

  return {
    cabeza: new Uint8Array(await res.arrayBuffer()),
    bytes: total ? Number(total) : null,
    // Sin los parámetros: `image/jpeg; charset=…` es el mismo tipo.
    tipoServido:
      res.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "",
  };
}

/* ------------------------------------------------------------------ el PDF */

/**
 * Tope del PDF que aceptamos.
 *
 * Un diario mensual de 12 a 24 páginas con fotos ronda los 10-30 MB, así que
 * cincuenta es holgado sin ser cualquier cosa.
 *
 * **Es el mismo número que el `file_size_limit` del bucket**, y tiene que
 * seguir siéndolo. Si acá dijera más, el editor esperaría la subida entera de
 * un archivo que Storage va a rechazar con un 413 al final; si dijera menos,
 * estaríamos rechazando algo que el bucket acepta. El bucket es el que manda:
 * es el único tope que no se puede saltear desde el navegador.
 *
 * El navegador mide el archivo y avisa en el acto, así que el editor se entera
 * ANTES de esperar diez minutos de subida.
 */
const MAXIMO_BYTES_PDF = 50 * 1024 * 1024;

/** Debajo de esto no hay diario que valga: es un PDF trunco o un cuerpo de
 *  error guardado con nombre de PDF. */
const MINIMO_BYTES_PDF = 1024;

/**
 * Pide una URL firmada para subir el PDF de una edición.
 *
 * El sufijo al azar evita pisar el PDF anterior al reemplazarlo: mientras las
 * cachés y los lectores con la página abierta se ponen al día, el viejo sigue
 * respondiendo. Queda huérfano en el bucket, que es barato.
 */
export async function urlFirmadaParaPdf(edicionSlug: string): Promise<{
  /** A dónde tiene que hacer el PUT el navegador. Lleva el token adentro. */
  destino: string;
  /** Dónde va a quedar el archivo, para guardarlo en la edición. */
  urlPublica: string;
}> {
  const cfg = config();
  if (!cfg) {
    throw new Error(
      "Falta configurar el storage: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const sufijo = crypto.randomUUID().slice(0, 8);
  return firmaDeSubida(cfg, `pdf/${saneado(edicionSlug, "edicion")}-${sufijo}.pdf`);
}

/**
 * Comprueba que en esa dirección haya de verdad un PDF, y con cuántos bytes.
 *
 * Se llama DESPUÉS de que el navegador subió, antes de guardar la dirección en
 * la edición. Sin esto el panel estaría creyéndole al cliente que la subida
 * salió bien, y una edición podría quedar apuntando a un objeto que no existe
 * —o que existe y no es un PDF— sin que nadie se entere hasta que un lector
 * abre el diario.
 *
 * Se piden los primeros cinco bytes, que es lo que hace falta para saber si el
 * archivo empieza con `%PDF-` —lo que el visor va a necesitar—. El porqué de
 * leer bytes y no cabeceras está en `cabeceraDeObjeto()`.
 */
export async function verificarPdfSubido(
  url: string,
): Promise<{ bytes: number | null }> {
  const cfg = config();
  // Sin storage configurado no hay nada que verificar, y tampoco había forma
  // de subir: el llamador nunca llega hasta acá.
  if (!cfg) throw new Error("Falta configurar el storage.");
  claveDeUrlPublica(cfg, url);

  const { cabeza, bytes } = await cabeceraDeObjeto(url, 4);

  if (String.fromCharCode(...cabeza.slice(0, 5)) !== "%PDF-") {
    throw new Error(
      "Lo que se subió no es un PDF. Si le cambiaste la extensión, el " +
        "contenido sigue siendo el de antes.",
    );
  }

  if (bytes !== null) {
    if (bytes < MINIMO_BYTES_PDF) {
      throw new Error(`El archivo subido pesa ${bytes} bytes: está trunco.`);
    }
    if (bytes > MAXIMO_BYTES_PDF) {
      throw new Error(
        `El PDF pesa ${(bytes / 1024 / 1024).toFixed(1)} MB y el máximo son ` +
          `${MAXIMO_BYTES_PDF / 1024 / 1024} MB.`,
      );
    }
  }

  return { bytes };
}

/* ---------------------------------------------------- la foto de una nota */

/** Debajo de esto no hay foto que valga: es una subida truncada o un cuerpo de
 *  error guardado con nombre de imagen. */
const MINIMO_BYTES_FOTO = 1024;

/** La forma exacta de una clave de foto: `<slug>-<8 hex>.<ext>`, en la raíz del
 *  bucket. Lo usa `verificarFotoSubida()` antes de borrar nada; el porqué está
 *  ahí, y no es cosmético. */
const CLAVE_DE_FOTO = /^[a-z0-9-]+-[0-9a-f]{8}\.(jpg|png|webp)$/;

/**
 * Pide una URL firmada para subir la foto de una nota.
 *
 * **La extensión la propone el navegador y la decide esto.** El navegador ya
 * olió los bytes antes de pedir la firma, así que acierta; pero lo que llega es
 * un texto que manda el cliente, y la clave que se firma sale de la tabla de
 * `FIRMAS`, no de lo que vino. Lo que el navegador diga se vuelve a comprobar
 * contra los bytes reales en `verificarFotoSubida()`, después de la subida.
 *
 * Devuelve también el `mime` para que el PUT lo mande tal cual: con ese valor
 * se queda Storage, y es con el que va a servir el archivo a cada lector. Si lo
 * eligiera el navegador, una foto podría terminar sirviéndose como otra cosa
 * desde nuestro dominio.
 *
 * El sufijo al azar evita pisar la foto anterior al cambiarla: la vieja queda
 * huérfana en el bucket, que es barato, y a cambio ninguna nota se queda sin
 * imagen mientras las cachés se ponen al día.
 */
export async function urlFirmadaParaFoto(
  slugNota: string,
  ext: string,
): Promise<{
  /** A dónde tiene que hacer el PUT el navegador. Lleva el token adentro. */
  destino: string;
  /** Dónde va a quedar el archivo, para ponerlo en el campo de la nota. */
  urlPublica: string;
  /** El `Content-Type` con el que hay que subirla. Lo elige el servidor. */
  mime: string;
}> {
  const cfg = config();
  if (!cfg) {
    throw new Error(
      "Falta configurar el storage: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const tipo = FIRMAS.find((f) => f.ext === ext);
  if (!tipo) {
    throw new Error("Sólo se pueden subir fotos JPG, PNG o WebP.");
  }

  const sufijo = crypto.randomUUID().slice(0, 8);
  const clave = `${saneado(slugNota, "nota")}-${sufijo}.${tipo.ext}`;
  const firma = await firmaDeSubida(cfg, clave);
  return { ...firma, mime: tipo.mime };
}

/**
 * Borra una foto recién subida que no pasó la verificación.
 *
 * **Sólo borra si la clave tiene la forma de una foto.** La dirección la manda
 * el cliente, y sin este cerrojo un administrador podría pasar la dirección del
 * PDF de una edición: no sería una imagen válida, y lo estaríamos borrando por
 * él. Las claves del PDF (`pdf/…`) y del audio (`voz/…`) no pueden coincidir
 * con el patrón.
 *
 * Que no se pueda borrar no es motivo para cambiar lo que se le cuenta al
 * editor: el objeto queda huérfano en el bucket y nadie lo referencia.
 */
async function borrarFotoSubida(cfg: Config, clave: string): Promise<void> {
  if (!CLAVE_DE_FOTO.test(clave)) return;
  await fetch(`${cfg.url}/storage/v1/object/${cfg.bucket}/${clave}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${cfg.clave}` },
  }).catch(() => {});
}

/**
 * Comprueba que en esa dirección haya de verdad una foto, y con cuántos bytes.
 *
 * Es el reemplazo exacto de lo que hacía `subirImagen()` cuando el archivo
 * pasaba por el servidor: mirar los bytes y no el nombre. Lo que cambia es
 * CUÁNDO —después de la subida, no antes— y eso trae una consecuencia que hay
 * que atender: durante unos segundos el objeto existe y es público. Por eso, si
 * no pasa, **se borra**; no alcanza con no guardarlo en la nota.
 *
 * Se piden doce bytes porque WebP es `RIFF....WEBP` y la marca vive en el 8..11.
 *
 * También se mira con qué `content-type` lo sirve Storage. Ese valor lo fija
 * quien hace el PUT, y si dijera cualquier otra cosa el archivo se serviría
 * como esa cosa desde nuestro dominio —que es justo el problema que las firmas
 * existen para evitar—.
 */
export async function verificarFotoSubida(
  url: string,
): Promise<{ bytes: number | null }> {
  const cfg = config();
  // Sin storage configurado no hay nada que verificar, y tampoco había forma
  // de subir: el llamador nunca llega hasta acá.
  if (!cfg) throw new Error("Falta configurar el storage.");
  const clave = claveDeUrlPublica(cfg, url);

  const { cabeza, bytes, tipoServido } = await cabeceraDeObjeto(url, 11);
  const tipo = reconocer(cabeza);

  /** Borra lo que se acaba de subir y cuenta por qué no sirve. */
  const descartar = async (motivo: string): Promise<never> => {
    await borrarFotoSubida(cfg, clave);
    throw new Error(motivo);
  };

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
  if (tipoServido !== tipo.mime) {
    return descartar(
      `El storage va a servir esa foto como "${tipoServido}" y es un ` +
        `${tipo.ext.toUpperCase()}. La foto no se guardó.`,
    );
  }

  if (bytes !== null) {
    if (bytes < MINIMO_BYTES_FOTO) {
      return descartar(`La foto subida pesa ${bytes} bytes: está trunca.`);
    }
    if (bytes > MAXIMO_BYTES) {
      return descartar(
        `La foto pesa ${(bytes / 1024 / 1024).toFixed(1)} MB y el máximo son ` +
          `${MAXIMO_BYTES / 1024 / 1024} MB.`,
      );
    }
  }

  return { bytes };
}
