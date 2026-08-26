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

// Lo que había antes de correr, para saber qué borrar después.
const previos = new Set(
  (await prisma.comentario.findMany({ select: { id: true } })).map((c) => c.id),
);

let fallos = 1;
try {
  fallos = await correrContrato(repo);
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
