import path from "node:path";
import { config as cargarEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Next lee .env.local solo; la CLI de Prisma corre afuera y hay que decírselo.
cargarEnv({ path: ".env.local", quiet: true });

/**
 * Configuración de las herramientas de Prisma (migrate, studio, seed).
 *
 * Desde Prisma 7 las URLs de conexión salieron del `schema.prisma`, y con
 * razón: el esquema describe la forma de los datos, no a qué servidor
 * conectarse. Acá va **sólo** la de migraciones.
 *
 * Es `DIRECT_URL` y no `DATABASE_URL` a propósito. En Supabase, `DATABASE_URL`
 * apunta al pooler en modo transacción (6543), que no soporta el DDL ni los
 * advisory locks que `prisma migrate` necesita. Las migraciones van por la
 * conexión directa (5432); el runtime va por el pooler, y esa URL se le pasa
 * al adapter en `src/lib/db.ts`.
 */

/**
 * La URL se resuelve a mano y no con el helper `env()` de Prisma porque ese
 * helper **tira al cargar el archivo**, y este archivo lo carga *cualquier*
 * comando de Prisma — incluido `generate`, que no toca la base y corre en cada
 * `npm install`. Con `env()`, clonar el repo sin credenciales rompía el
 * postinstall.
 *
 * Sin la variable, entonces, no se declara datasource: `generate` funciona
 * igual. Los comandos que sí necesitan conectarse avisan con un mensaje
 * propio, porque el de Prisma ("no datasource url") no dice dónde ponerla.
 */
const urlDirecta = process.env.DIRECT_URL;

// `migrate diff --from-empty --to-schema-datamodel` no se conecta a nada:
// compara el esquema contra el vacío y escupe SQL. Por eso se lo excluye, o
// no se podría generar la migración inicial sin tener ya la base.
const NECESITAN_BASE = ["migrate", "db", "studio"];
const seConecta =
  NECESITAN_BASE.some((c) => process.argv.includes(c)) &&
  !process.argv.includes("diff");
if (!urlDirecta && seConecta) {
  throw new Error(
    "Falta DIRECT_URL en .env.local.\n" +
      "Es la conexión DIRECTA de Supabase (puerto 5432), no la del pooler.\n" +
      "Supabase → Project Settings → Database → Connection string → URI.\n" +
      "Ver .env.example.",
  );
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON prisma/seed.mts",
  },
  ...(urlDirecta ? { datasource: { url: urlDirecta } } : {}),
});
