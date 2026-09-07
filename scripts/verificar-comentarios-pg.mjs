/**
 * El MISMO contrato, contra Postgres.
 *
 * Se corre con `npm run verificar:comentarios:pg`. Importa las aserciones de
 * `contrato-comentarios.mjs` sin tocarlas: si para hacerlo pasar hubiera que
 * editar una, la migración cambió el comportamiento y no sólo el
 * almacenamiento.
 *
 * **Limpia lo que crea.** No es prolijidad: la base de desarrollo y la de
 * producción son la misma, así que un comentario de prueba olvidado aparece
 * publicado en el diario, firmado por "Vecino de prueba". El `finally` corre
 * incluso si una aserción explota.
 */
import { config as cargarEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { correrContrato } from "./contrato-comentarios.mjs";

cargarEnv({ path: ".env.local", quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "Falta DATABASE_URL en .env.local. Es la cadena del pooler (6543).",
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url, max: 1 }),
});

const mod = await import(
  new URL("../src/lib/repos/comentarios-postgres.ts", import.meta.url).href
);
const repo = mod.crearComentariosPostgresRepo(prisma);

/*
 * Dos notas DE LA BASE, y no los slugs del archivo semilla.
 *
 * `comentarios.notaSlug` es una clave externa contra `notas.slug`, así que un
 * slug del mock hace fallar el primer `crear()` con una violación de clave
 * externa y el contrato no llega a verificar nada. Eso venía pasando: la
 * edición en la calle ya no es la del semillero, y desde que hay facsímiles sus
 * "notas" son las páginas de un PDF.
 *
 * Se piden dos porque el contrato necesita un segundo slug para la portada
 * —`ultimoDeEdicion()` recibe la lista de notas de la edición—. Con una sola
 * nota en la base alcanza igual: se repite, y la aserción sigue siendo válida.
 */
const notas = (
  await prisma.nota.findMany({ select: { slug: true }, take: 2 })
).map((n) => n.slug);
if (notas.length === 0) {
  console.error(
    "No hay ninguna nota en la base, así que no hay de dónde colgar un " +
      "comentario de prueba. Cargá una edición antes de correr esto.",
  );
  await prisma.$disconnect();
  process.exit(1);
}
if (notas.length === 1) notas.push(notas[0]);
console.log(`  (contra las notas: ${notas.join(", ")})\n`);

// Lo que había antes de correr, para saber qué borrar después.
const previos = new Set(
  (await prisma.comentario.findMany({ select: { id: true } })).map((c) => c.id),
);

let fallos = 1;
try {
  fallos = await correrContrato(repo, notas);
} finally {
  const dejados = await prisma.comentario.findMany({ select: { id: true } });
  const nuevos = dejados.filter((c) => !previos.has(c.id)).map((c) => c.id);
  if (nuevos.length) {
    await prisma.comentario.deleteMany({ where: { id: { in: nuevos } } });
    console.log(`\n  (limpieza: ${nuevos.length} comentario(s) de prueba borrados)`);
  }
  await prisma.$disconnect();
}

console.log(fallos === 0 ? "\nTODO OK (Postgres)" : `\n${fallos} FALLAS`);
process.exit(fallos === 0 ? 0 : 1);
