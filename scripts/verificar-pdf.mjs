/**
 * ¿La subida del PDF del impreso puede funcionar desde acá?
 *
 * Se corre con `npm run verificar:pdf`. Toca el Storage de verdad: pide una
 * firma, sube un archivo y lo vuelve a leer. No simula nada.
 *
 * Existe porque la subida del facsímil es la única del proyecto que **no pasa
 * por el servidor** —el navegador escribe directo en el bucket con una URL
 * firmada, porque en Vercel un request no puede pesar más de 4,5 MB y un diario
 * mensual siempre pesa más— y eso significa que hay tres piezas que sólo se
 * pueden probar contra Supabase:
 *
 *  1. **Que el proyecto sepa firmar una subida.** Es un endpoint distinto del
 *     que usan las fotos (`/object/upload/sign/…` en lugar de `/object/…`) y
 *     puede fallar solo: bucket inexistente, clave sin permiso, plan sin la
 *     función.
 *  2. **Que el PUT con esa firma escriba.** Es el paso que hace el navegador y
 *     el único que en producción nadie ve fallar hasta que un editor lo intenta
 *     con un archivo de treinta megas.
 *  3. **Que el objeto quede legible y sea un PDF.** Es lo que
 *     `verificarPdfSubido()` comprueba antes de guardar la dirección en la
 *     edición: un `Range` de cinco bytes que tienen que decir `%PDF-`.
 *
 * **Deja el bucket como lo encontró**: sube a `pdf/verificacion-…` y borra al
 * terminar, pase lo que pase.
 *
 * Lo que este script NO prueba: que el PDF se dibuje. Eso es pdf.js en un
 * navegador de verdad y se mira abriendo el diario.
 */
import { config as cargarEnv } from "dotenv";

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

/** Un PDF de una página, mínimo y válido. Se arma acá para no depender de
 *  ningún archivo del repositorio. */
function pdfDePrueba() {
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>",
  ];
  let salida = "%PDF-1.4\n";
  const posiciones = [];
  objetos.forEach((cuerpo, i) => {
    posiciones.push(salida.length);
    salida += `${i + 1} 0 obj\n${cuerpo}\nendobj\n`;
  });
  const inicioXref = salida.length;
  salida += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const pos of posiciones) {
    salida += `${String(pos).padStart(10, "0")} 00000 n \n`;
  }
  salida +=
    `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${inicioXref}\n%%EOF\n`;
  return Buffer.from(salida, "latin1");
}

const bytes = pdfDePrueba();
const ruta = `pdf/verificacion-${crypto.randomUUID().slice(0, 8)}.pdf`;
let subido = false;

try {
  /* ------------------------------------------------------------- 1. firmar */
  console.log("Pedir la firma de subida\n");

  const resFirma = await fetch(
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

  ok(
    `el proyecto firma la subida (${resFirma.status})`,
    resFirma.ok,
    resFirma.status === 404
      ? `no existe el bucket "${bucket}"`
      : (await resFirma.clone().text()).slice(0, 200),
  );
  if (!resFirma.ok) throw new Error("sin firma no se puede seguir");

  const cuerpoFirma = await resFirma.json();
  const relativa = typeof cuerpoFirma?.url === "string" ? cuerpoFirma.url : null;
  ok("la firma trae una ruta", Boolean(relativa), JSON.stringify(cuerpoFirma));
  if (!relativa) throw new Error("sin ruta no se puede seguir");

  ok(
    "la ruta lleva token y es la clave que pedimos",
    relativa.includes("token=") && relativa.includes(ruta),
    relativa.slice(0, 120),
  );

  /* --------------------------------------------------------------- 2. PUT */
  console.log("\nSubir con esa firma (lo que hace el navegador)\n");

  const resPut = await fetch(`${url}/storage/v1${relativa}`, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf" },
    body: bytes,
  });
  subido = resPut.ok;
  ok(
    `el PUT escribe en el bucket (${resPut.status})`,
    resPut.ok,
    (await resPut.clone().text()).slice(0, 200),
  );

  /* ------------------------------------------------------------ 3. leerlo */
  console.log("\nConfirmar el objeto, como lo hace el servidor al guardar\n");

  const publica = `${url}/storage/v1/object/public/${bucket}/${ruta}`;
  const resRango = await fetch(publica, {
    headers: { Range: "bytes=0-4" },
    cache: "no-store",
  });
  ok(
    `se lee sin credenciales (${resRango.status})`,
    resRango.ok,
    resRango.status === 400
      ? "¿el bucket es público? El diario sirve el PDF por URL pública."
      : "",
  );

  if (resRango.ok) {
    const cabeza = Buffer.from(await resRango.arrayBuffer()).toString("latin1");
    ok("los primeros cinco bytes son %PDF-", cabeza.slice(0, 5) === "%PDF-", cabeza);

    const rango = resRango.headers.get("content-range");
    const total = rango?.match(/\/(\d+)$/)?.[1];
    ok(
      "el largo total viaja en content-range",
      Boolean(total),
      `content-range: ${rango ?? "(ausente)"} — sin esto no se puede validar el tamaño`,
    );
    if (total) {
      ok(
        `el tamaño es el que se subió (${total} bytes)`,
        Number(total) === bytes.byteLength,
        `subimos ${bytes.byteLength}`,
      );
    }
  }
} catch (e) {
  fallas++;
  console.log(`\n  MAL se cortó: ${e instanceof Error ? e.message : e}`);
} finally {
  /* ------------------------------------------------------------- limpieza */
  if (subido) {
    const resBorrado = await fetch(
      `${url}/storage/v1/object/${bucket}/${ruta}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${clave}` } },
    ).catch(() => null);
    console.log(
      `\n  ${resBorrado?.ok ? "ok " : "MAL"} se borró el archivo de prueba` +
        (resBorrado?.ok ? "" : ` — borrar a mano: ${ruta}`),
    );
    if (!resBorrado?.ok) fallas++;
  }
}

console.log(fallas === 0 ? "\nTODO OK\n" : `\n${fallas} FALLAS\n`);
process.exit(fallas === 0 ? 0 : 1);
