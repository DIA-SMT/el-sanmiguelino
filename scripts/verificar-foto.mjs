/**
 * ¿La subida de la foto de una nota puede funcionar desde acá?
 *
 * Se corre con `npm run verificar:foto`. Toca el Storage de verdad: pide una
 * firma, sube una foto y la vuelve a leer. No simula nada.
 *
 * Existe por un defecto concreto. La foto viajaba **por el servidor**, dentro
 * de una Server Action, y una Server Action acepta 1 MB de cuerpo por defecto:
 * la pantalla ofrecía 8 MB, el servidor validaba 8 MB, y cualquier foto de
 * teléfono rebotaba antes de llegar con un "no se pudo hablar con el servidor"
 * que no decía nada. Ahora va derecho al bucket con una URL firmada, igual que
 * el PDF, y eso deja tres piezas que sólo se pueden probar contra Supabase:
 *
 *  1. **Que el proyecto sepa firmar la clave de una foto.** Es un endpoint
 *     distinto del que usaba la subida por el servidor (`/object/upload/sign/…`
 *     en lugar de `/object/…`) y puede fallar solo: bucket inexistente, clave
 *     sin permiso, plan sin la función.
 *  2. **Que el PUT escriba una foto GRANDE.** Es el punto entero del cambio.
 *     Se sube una de varios megas —más que el megabyte de la Server Action y
 *     más que el tope duro de 4,5 MB que tiene un request en Vercel—, que es
 *     justo el tamaño que antes no llegaba nunca.
 *  3. **Que el objeto quede legible, sea una imagen y se sirva con su tipo.**
 *     Es lo que `verificarFotoSubida()` comprueba antes de darle la dirección
 *     al editor: un `Range` de doce bytes con la firma del formato, y el
 *     `content-type` con el que Storage la va a servir a cada lector.
 *
 * También se prueba el camino de la basura: se sube algo que NO es una imagen
 * con nombre de foto y se comprueba que se lo puede reconocer y BORRAR, que es
 * lo que hace `verificarFotoSubida()` cuando los bytes no cierran. Subir
 * primero y validar después abre una ventana en la que el objeto existe y es
 * público; el borrado es lo que la cierra.
 *
 * **Deja el bucket como lo encontró**: sube a `verificacion-…` y borra al
 * terminar, pase lo que pase.
 *
 * Lo que este script NO prueba: que el editor muestre bien el avance ni que la
 * foto se vea en la nota. Eso es el panel en un navegador de verdad.
 */
import { config as cargarEnv } from "dotenv";
import sharp from "sharp";

cargarEnv({ path: ".env.local", quiet: true });

let fallas = 0;

function ok(nombre, condicion, detalle = "") {
  if (!condicion) fallas++;
  console.log(`  ${condicion ? "ok " : "MAL"} ${nombre}`);
  if (!condicion && detalle) console.log(`        ${detalle}`);
}

const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const bucket = process.env.SUPABASE_BUCKET?.trim() || "diario";

if (!url || !clave) {
  console.log(
    "\nFalta configurar el storage: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY " +
      "en .env.local.\n",
  );
  process.exit(1);
}

console.log(`\nStorage: ${new URL(url).hostname}, bucket "${bucket}"\n`);

/**
 * Un JPEG de verdad y de varios megas.
 *
 * Es **ruido**, no un color plano, y eso no es un capricho: un JPEG de un color
 * sólido comprime a unos kilobytes y no probaría nada. El ruido no comprime, así
 * que salen los megas que hacen falta para pasar por encima de los dos topes que
 * antes lo frenaban.
 */
async function fotoDePrueba() {
  const ancho = 2400;
  const alto = 1600;
  const crudo = Buffer.allocUnsafe(ancho * alto * 3);
  // `randomFillSync` tiene un tope de 64 KB por llamada.
  for (let i = 0; i < crudo.length; i += 65536) {
    crypto.getRandomValues(
      new Uint8Array(crudo.buffer, i, Math.min(65536, crudo.length - i)),
    );
  }
  return sharp(crudo, { raw: { width: ancho, height: alto, channels: 3 } })
    .jpeg({ quality: 100 })
    .toBuffer();
}

/** Borra un objeto del bucket. Devuelve si pudo. */
async function borrar(ruta) {
  const res = await fetch(`${url}/storage/v1/object/${bucket}/${ruta}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${clave}` },
  }).catch(() => null);
  return Boolean(res?.ok);
}

/** Pide la firma de subida de una clave. Devuelve la ruta relativa con token. */
async function firmar(ruta) {
  const res = await fetch(
    `${url}/storage/v1/object/upload/sign/${bucket}/${ruta}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: 600 }),
    },
  );
  if (!res.ok) {
    return {
      relativa: null,
      estado: res.status,
      detalle:
        res.status === 404
          ? `no existe el bucket "${bucket}"`
          : (await res.text()).slice(0, 200),
    };
  }
  const cuerpo = await res.json();
  return {
    relativa: typeof cuerpo?.url === "string" ? cuerpo.url : null,
    estado: res.status,
    detalle: JSON.stringify(cuerpo),
  };
}

const bytes = await fotoDePrueba();
/** La misma forma que arma `urlFirmadaParaFoto()`: raíz del bucket,
 *  `<nombre>-<8 hex>.<ext>`. Importa que sea esa: el borrado del servidor sólo
 *  toca las claves con esta forma, para no poder borrar el PDF de una edición
 *  si alguien le pasa esa dirección. */
const ruta = `verificacion-${crypto.randomUUID().slice(0, 8)}.jpg`;
const rutaBasura = `verificacion-${crypto.randomUUID().slice(0, 8)}.jpg`;
let subido = false;
let subidaBasura = false;

console.log(
  `La foto de prueba pesa ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB\n`,
);
ok(
  "pesa más que el megabyte de una Server Action",
  bytes.byteLength > 1024 * 1024,
  `${bytes.byteLength} bytes: subí la calidad o el tamaño del ruido`,
);
ok(
  "pesa más que los 4,5 MB que aguanta un request en Vercel",
  bytes.byteLength > 4.5 * 1024 * 1024,
  `${bytes.byteLength} bytes: este es el tope que ninguna config levanta`,
);

try {
  /* ------------------------------------------------------------- 1. firmar */
  console.log("\nPedir la firma de subida\n");

  const firma = await firmar(ruta);
  ok(
    `el proyecto firma la subida (${firma.estado})`,
    Boolean(firma.relativa),
    firma.detalle,
  );
  if (!firma.relativa) throw new Error("sin firma no se puede seguir");

  ok(
    "la ruta lleva token y es la clave que pedimos",
    firma.relativa.includes("token=") && firma.relativa.includes(ruta),
    firma.relativa.slice(0, 120),
  );

  /* --------------------------------------------------------------- 2. PUT */
  console.log("\nSubir con esa firma (lo que hace el navegador)\n");

  const resPut = await fetch(`${url}/storage/v1${firma.relativa}`, {
    method: "PUT",
    // El tipo lo elige el SERVIDOR a partir de los bytes, no el navegador. Con
    // este valor se queda Storage y con él sirve la foto.
    headers: { "Content-Type": "image/jpeg" },
    body: bytes,
  });
  subido = resPut.ok;
  ok(
    `el PUT escribe los ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB (${resPut.status})`,
    resPut.ok,
    resPut.status === 413
      ? "el bucket tiene un file_size_limit más chico que la foto"
      : (await resPut.clone().text()).slice(0, 200),
  );

  /* ------------------------------------------------------------ 3. leerla */
  console.log("\nConfirmar el objeto, como lo hace verificarFotoSubida()\n");

  const publica = `${url}/storage/v1/object/public/${bucket}/${ruta}`;
  const resRango = await fetch(publica, {
    headers: { Range: "bytes=0-11" },
    cache: "no-store",
  });
  ok(
    `se lee sin credenciales (${resRango.status})`,
    resRango.ok,
    resRango.status === 400
      ? "¿el bucket es público? El diario sirve las fotos por URL pública."
      : "",
  );

  if (resRango.ok) {
    const cabeza = Buffer.from(await resRango.arrayBuffer());
    ok(
      "los primeros bytes son la firma de un JPEG",
      cabeza[0] === 0xff && cabeza[1] === 0xd8 && cabeza[2] === 0xff,
      [...cabeza.slice(0, 4)].map((b) => b.toString(16)).join(" "),
    );

    const tipo = resRango.headers.get("content-type")?.split(";")[0].trim();
    ok(
      `se sirve como image/jpeg (${tipo ?? "(ausente)"})`,
      tipo === "image/jpeg",
      "el servidor rechaza la foto si Storage la va a servir con otro tipo",
    );

    const total = resRango.headers.get("content-range")?.match(/\/(\d+)$/)?.[1];
    ok(
      "el largo total viaja en content-range",
      Boolean(total),
      "sin esto no se puede validar el tamaño",
    );
    if (total) {
      ok(
        `el tamaño es el que se subió (${total} bytes)`,
        Number(total) === bytes.byteLength,
        `subimos ${bytes.byteLength}`,
      );
    }
  }

  /* ------------------------------------------------- 4. la basura se borra */
  console.log("\nLo que no es una imagen se reconoce y se borra\n");

  const firmaBasura = await firmar(rutaBasura);
  if (!firmaBasura.relativa) throw new Error("no se pudo firmar la basura");

  const resBasura = await fetch(`${url}/storage/v1${firmaBasura.relativa}`, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: Buffer.from("<html>esto no es una foto</html>".repeat(64)),
  });
  subidaBasura = resBasura.ok;
  ok(
    `se puede subir algo que no es una imagen (${resBasura.status})`,
    resBasura.ok,
    "si Storage lo frenara solo, el cerrojo del servidor sobraría — pero no lo hace",
  );

  if (subidaBasura) {
    const resLeer = await fetch(
      `${url}/storage/v1/object/public/${bucket}/${rutaBasura}`,
      { headers: { Range: "bytes=0-11" }, cache: "no-store" },
    );
    const cabeza = Buffer.from(await resLeer.arrayBuffer());
    ok(
      "los bytes no coinciden con ningún formato que aceptemos",
      !(cabeza[0] === 0xff && cabeza[1] === 0xd8) &&
        !(cabeza[0] === 0x89 && cabeza[1] === 0x50) &&
        !(cabeza[0] === 0x52 && cabeza[1] === 0x49),
      "el nombre decía .jpg y el contenido no lo es: esto es lo que se rechaza",
    );

    subidaBasura = !(await borrar(rutaBasura));
    ok(
      "la clave de servicio puede borrarlo",
      !subidaBasura,
      "sin esto, un archivo rechazado queda público en el bucket para siempre",
    );
  }
} catch (e) {
  fallas++;
  console.log(`\n  MAL se cortó: ${e instanceof Error ? e.message : e}`);
} finally {
  /* ------------------------------------------------------------- limpieza */
  for (const [pendiente, cual] of [
    [subido, ruta],
    [subidaBasura, rutaBasura],
  ]) {
    if (!pendiente) continue;
    const borrado = await borrar(cual);
    console.log(
      `\n  ${borrado ? "ok " : "MAL"} se borró ${cual}` +
        (borrado ? "" : " — borrar a mano"),
    );
    if (!borrado) fallas++;
  }
}

console.log(fallas === 0 ? "\nTODO OK\n" : `\n${fallas} FALLAS\n`);
process.exit(fallas === 0 ? 0 : 1);
