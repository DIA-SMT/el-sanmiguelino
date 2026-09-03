/**
 * Carga una digitalización en el diario.
 *
 *   node scripts/cargar-digitalizacion.mjs <carpeta> --edicion <slug>
 *   node scripts/cargar-digitalizacion.mjs <carpeta> --edicion <slug> --vista-previa
 *
 * Es el paso siguiente a `digitalizar.mjs`, y va aparte por una razón que no es
 * de prolijidad: **la base de desarrollo y la de producción son la misma**, así
 * que todo lo que escribe este script sale publicado. Entre convertir y
 * publicar tiene que haber una persona que mire el resultado, y esa persona
 * corre este comando cuando ya lo miró.
 *
 * `--vista-previa` es la red: en lugar de tocar el número que está en la calle,
 * arma una copia con otro slug y SIN fecha de publicación. Nadie la ve salvo un
 * administrador que la ponga en foco desde el panel. Se revisa ahí, y recién
 * después se corre el comando sin la bandera.
 *
 * ---
 *
 * **La página 1 pasa a ser una nota.** En un facsímil sin digitalizar, las
 * páginas del PDF son las filas 2 en adelante y la 1 se dibuja en `/diario`;
 * digitalizada, la tapa del papel es un artículo con su titular, su bajada y su
 * foto, que es exactamente lo que la portada del diario sabe mostrar. Así que
 * acá vale `pdfPagina = orden + 1`, y el foliado se corre uno.
 *
 * Correr el foliado sobre filas que ya existen choca con `@@unique([edicionId,
 * orden])` en el medio de la operación, así que primero se manda todo a un
 * rango alto y después se acomoda. Todo en una transacción: a mitad de camino
 * el número no se puede servir.
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { config as cargarEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  minutosDeLectura,
  textoPlanoDe,
} from "../src/lib/derivar.ts";

cargarEnv({ path: ".env.local", quiet: true });

/* --------------------------------------------------------------- argumentos */

const argv = process.argv.slice(2);
const carpeta = argv.find((a) => !a.startsWith("--"));
const bandera = (nombre) => {
  const i = argv.indexOf(`--${nombre}`);
  return i === -1 ? null : argv[i + 1];
};
const edicionSlug = bandera("edicion");
const vistaPrevia = argv.includes("--vista-previa");

if (!carpeta || !edicionSlug) {
  console.log(
    "\n  node scripts/cargar-digitalizacion.mjs <carpeta> --edicion <slug> " +
      "[--vista-previa]\n",
  );
  process.exit(1);
}

const json = path.resolve(carpeta, "paginas.json");
if (!existsSync(json)) {
  console.log(`\nNo existe ${json}. ¿Corriste antes 'npm run digitalizar'?\n`);
  process.exit(1);
}

const { paginas } = JSON.parse(readFileSync(json, "utf8"));

const storage = {
  url: process.env.SUPABASE_URL?.trim().replace(/\/+$/, ""),
  clave: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  bucket: process.env.SUPABASE_BUCKET?.trim() || "diario",
};
if (!storage.url || !storage.clave) {
  console.log("\nFaltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local\n");
  process.exit(1);
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/* ------------------------------------------------------------------ storage */

/** Sube un recorte y devuelve su dirección pública. Mismo endpoint y mismas
 *  reglas que `subirImagen()` en `src/lib/storage.ts`: nombre elegido por
 *  nosotros y `x-upsert: false`, para que dos corridas no se pisen. */
async function subir(archivo, destino) {
  const bytes = readFileSync(path.resolve(carpeta, archivo));
  const res = await fetch(
    `${storage.url}/storage/v1/object/${storage.bucket}/${destino}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${storage.clave}`,
        "Content-Type": "image/webp",
        "x-upsert": "true",
      },
      body: bytes,
    },
  );
  if (!res.ok) {
    throw new Error(
      `Storage rechazó ${archivo} (${res.status}): ` +
        (await res.text().catch(() => "")).slice(0, 160),
    );
  }
  return `${storage.url}/storage/v1/object/public/${storage.bucket}/${destino}`;
}

/* ------------------------------------------------------- la edición destino */

const origen = await db.edicion.findUnique({ where: { slug: edicionSlug } });
if (!origen) {
  console.log(`\nNo existe la edición "${edicionSlug}".\n`);
  process.exit(1);
}
if (!origen.pdfUrl) {
  console.log(
    `\n"${origen.mes}" no tiene PDF cargado. La digitalización conserva el ` +
      `facsímil detrás de un botón, así que el archivo tiene que estar.\n`,
  );
  process.exit(1);
}

let destino = origen;

if (vistaPrevia) {
  const slug = `${edicionSlug}-digital`;
  destino = await db.edicion.upsert({
    where: { slug },
    update: { pdfUrl: origen.pdfUrl, pdfPaginas: origen.pdfPaginas },
    create: {
      slug,
      mes: origen.mes,
      // Un número alto y evidente: `@@unique([anio, numero])` no deja repetir
      // el del original, y que sea 900 y pico avisa a simple vista que esto no
      // es un número del diario.
      numero: 900 + origen.numero,
      anio: origen.anio,
      etiqueta: "Vista previa de la digitalización",
      tema: origen.tema,
      // Sin fecha: no la elige el diario y no la ve ningún lector.
      publicaEn: null,
      pdfUrl: origen.pdfUrl,
      pdfPaginas: origen.pdfPaginas,
    },
  });
}

console.log(
  `\n${paginas.length} páginas → "${destino.mes}" (${destino.slug})` +
    (vistaPrevia ? "  [vista previa, sin fecha]" : "  [EN VIVO]") +
    "\n",
);

/* -------------------------------------------------------- subir las figuras */

const direcciones = new Map();
for (const pagina of paginas) {
  for (const figura of pagina.figuras ?? []) {
    if (direcciones.has(figura.src)) continue;
    const destinoArchivo = `${destino.slug}-${figura.src}`;
    const url = await subir(figura.src, destinoArchivo);
    direcciones.set(figura.src, url);
    process.stdout.write(`  subida ${figura.src} (${figura.kb} KB)\r`);
  }
}
console.log(`  ${direcciones.size} figuras subidas al bucket        `);

/** Cambia los nombres de archivo locales por las direcciones del bucket. */
function conUrls(valor) {
  if (typeof valor === "string") return direcciones.get(valor) ?? valor;
  if (Array.isArray(valor)) return valor.map(conUrls);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [
        k,
        k === "src" || k === "retrato" ? conUrls(v) : conUrls(v),
      ]),
    );
  }
  return valor;
}

/* ------------------------------------------------------------- las notas */

const slugDePagina = (n) => `${destino.slug}-p${n}`;

await db.$transaction(async (tx) => {
  // Primero, todo el foliado viejo a un rango que no moleste. Sin esto, darle
  // `orden: 0` a la página 1 choca contra la fila que ya lo tiene.
  const viejas = await tx.nota.findMany({
    where: { edicionId: destino.id },
    select: { id: true, orden: true },
  });
  for (const vieja of viejas) {
    await tx.nota.update({
      where: { id: vieja.id },
      data: { orden: vieja.orden + 1000 },
    });
  }

  /*
   * Una página sin título propio hereda el de la anterior, con "(continuación)".
   *
   * Pasa con las galerías: la página 7 de agosto son seis fotos más de las
   * plazas que empezó a mostrar la 6, y en el papel no lleva título porque se
   * lee como una doble página. En la web cada página es una nota y necesita un
   * nombre: aparece en el índice, en el buscador, en las flechas de paso de
   * página y en lo que le contesta Migue. Dejarla como "Página 7" sería volver
   * a poner ahí justamente el cartel que la digitalización vino a sacar.
   *
   * El conversor no puede resolverlo solo porque mira una página por vez y esto
   * es una relación entre dos. Y no inventa nada: el título es el de al lado.
   */
  let tituloPrevio = "";
  for (const pagina of paginas) {
    const cuerpo = conUrls(pagina.cuerpo);
    const imagen = pagina.imagen ? conUrls(pagina.imagen) : null;
    const titulo =
      pagina.titulo ||
      (tituloPrevio
        ? `${tituloPrevio.replace(/ \(continuación\)$/, "")} (continuación)`
        : `Página ${pagina.pagina}`);
    tituloPrevio = titulo;

    /*
     * Una nota necesita bajada: es lo que se lee en el índice, en el buscador y
     * en la voz. Si la página no tenía —la 4 y las galerías no traen—, se toma
     * la primera oración del texto. **No se inventa nada**: es texto del propio
     * impreso, recortado.
     */
    const primerParrafo = cuerpo.find((b) => b.tipo === "parrafo")?.texto ?? "";
    const bajada =
      pagina.bajada ||
      primerParrafo.split(/(?<=\.)\s/)[0]?.slice(0, 240) ||
      `Página ${pagina.pagina} de ${destino.mes}, tal como salió impresa.`;

    const campos = {
      seccion: destino.tema || "Edición impresa",
      titulo,
      bajada,
      cuerpo,
      minutosLectura: minutosDeLectura(cuerpo),
      textoPlano: textoPlanoDe(cuerpo),
      imagenSrc: imagen?.src ?? null,
      imagenAlt: imagen?.alt ?? null,
      imagenEpigrafe: imagen?.epigrafe ?? null,
      imagenCredito: imagen?.credito ?? null,
      // Digitalizada, la página 1 SÍ es una fila: la tapa del papel es un
      // artículo. Ver el porqué en `Nota.pdfPagina`, en el esquema.
      pdfPagina: pagina.pagina,
      orden: pagina.pagina - 1,
      edicionId: destino.id,
    };

    await tx.nota.upsert({
      where: { slug: slugDePagina(pagina.pagina) },
      update: campos,
      create: { slug: slugDePagina(pagina.pagina), ...campos },
    });
  }

  // Lo que quedó en el rango alto es una página que el PDF nuevo ya no tiene.
  const { count } = await tx.nota.deleteMany({
    where: { edicionId: destino.id, orden: { gte: 1000 } },
  });
  if (count > 0) console.log(`  ${count} páginas viejas borradas`);
});

const total = await db.nota.count({ where: { edicionId: destino.id } });
console.log(`\n  ${total} notas en "${destino.mes}"\n`);

if (vistaPrevia) {
  console.log(
    `Para verla: entrá al panel, buscá "${destino.mes}" en Ediciones y usá\n` +
      `"Verla en el diario". No la ve nadie más.\n`,
  );
} else {
  console.log(`Está publicada. Mirala en /diario.\n`);
}

await db.$disconnect();
