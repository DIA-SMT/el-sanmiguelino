import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as cargarEnv } from "dotenv";
import { edicionActual } from "../src/lib/data/edicion-actual.ts";
import { minutosDeLectura, textoPlanoDe } from "../src/lib/derivar.ts";

/**
 * Carga la edición semilla en Postgres.
 *
 * Se corre con `npm run db:seed`, y `prisma migrate reset` lo llama solo.
 *
 * Dos cosas que no son detalle:
 *
 * 1. Los derivados (`minutosLectura`, `textoPlano`) se calculan con **las
 *    mismas funciones** que usa el repo mock, importadas de `src/lib/derivar`.
 *    Reescribirlas acá sería la forma más silenciosa de que la migración
 *    cambie los datos: mismos textos, distintos minutos, y nadie lo nota hasta
 *    que alguien compara.
 *
 * 2. Es **idempotente**. Corre con `upsert` sobre el slug, así que pasarlo dos
 *    veces deja lo mismo que pasarlo una. Un seed que sólo hace `create`
 *    explota la segunda vez y empuja a la gente a vaciar la tabla antes, que
 *    es exactamente lo que no se quiere poder hacer sin pensarlo cuando del
 *    otro lado hay comentarios de vecinos.
 *
 * Los comentarios NO se siembran: son de personas reales, no datos de ejemplo.
 * El repo in-memory tiene unos de muestra para desarrollo; esos se quedan ahí.
 */

cargarEnv({ path: ".env.local", quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "Falta DATABASE_URL en .env.local.\n" +
      "Es la cadena del POOLER de Supabase (6543). Ver .env.example.",
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url, max: 1 }),
});

async function main() {
  const { slug, mes, numero, anio, etiqueta, notas } = edicionActual;

  // Todo en una transacción: una siembra a medias dejaría el foliado roto
  // (cuatro de ocho notas es "Página 3 de 4") o ninguna edición marcada como
  // actual, y /diario no tendría qué mostrar.
  await prisma.$transaction(
    async (tx) => {
      const edicion = await tx.edicion.upsert({
        where: { slug },
        update: { mes, numero, anio, etiqueta, actual: true },
        create: { slug, mes, numero, anio, etiqueta, actual: true },
      });

      // Cualquier otra edición deja de ser la actual. Sin esto, sembrar una
      // edición nueva dejaría dos en true y /diario elegiría por azar.
      await tx.edicion.updateMany({
        where: { id: { not: edicion.id } },
        data: { actual: false },
      });

      for (const [i, nota] of notas.entries()) {
        const campos = {
          seccion: nota.seccion,
          titulo: nota.titulo,
          bajada: nota.bajada,
          cuerpo: nota.cuerpo,
          imagenSrc: nota.imagen?.src ?? null,
          imagenAlt: nota.imagen?.alt ?? null,
          imagenEpigrafe: nota.imagen?.epigrafe ?? null,
          // El orden del array es el foliado: la nota i-ésima es la página i+1.
          orden: i,
          edicionId: edicion.id,
          minutosLectura: minutosDeLectura(nota.cuerpo),
          textoPlano: textoPlanoDe(nota.cuerpo),
        };
        await tx.nota.upsert({
          where: { slug: nota.slug },
          update: campos,
          create: { slug: nota.slug, ...campos },
        });
      }
    },
    // El default son 5 segundos. Contra el pooler y con la latencia a
    // Supabase, ocho upserts secuenciales pueden pasarse.
    { timeout: 30_000 },
  );

  console.log(
    `Sembrada la edición "${mes}" (n.º ${numero}) con ${notas.length} notas.`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
