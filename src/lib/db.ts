import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * El cliente de Prisma, uno solo por proceso.
 *
 * Va colgado de `globalThis` por la misma razón que el store de comentarios:
 * el hot-reload de desarrollo re-evalúa los módulos en cada cambio, y sin esto
 * cada guardado abriría un pool nuevo hasta agotar las conexiones de Supabase.
 *
 * Se construye **perezoso**. Mientras el motor de la edición siga siendo el
 * mock, la mayoría de los requests no tocan la base, y un cliente que se
 * conecta al importar el módulo obligaría a tener credenciales para levantar
 * el proyecto. Nadie debería necesitar una base para mirar el diario en local.
 */

/** El pooler de Supabase (6543). La conexión directa es sólo para migrar. */
function cadena(): string {
  const url = process.env.DATABASE_URL;
  if (url) return url;
  throw new Error(
    "Falta DATABASE_URL en .env.local.\n" +
      "Es la cadena del POOLER de Supabase (puerto 6543), con " +
      "?pgbouncer=true&connection_limit=1.\n" +
      "Ver .env.example.",
  );
}

function crear(): PrismaClient {
  // `max: 1` es lo que de verdad limita el pool, y por eso está acá y no en
  // la URL: `pg-pool` lee `max`, nunca el `connection_limit` que se le pone
  // como query param. Ese parámetro era del motor viejo de Prisma; con el
  // modelo de driver adapters de la 7 no lo lee nadie.
  //
  // El tope importa porque en serverless cada invocación es un proceso propio:
  // un pool de veinte por invocación agota Supabase con tráfico normal.
  const adapter = new PrismaPg({ connectionString: cadena(), max: 1 });
  return new PrismaClient({ adapter });
}

const g = globalThis as typeof globalThis & { __smPrisma?: PrismaClient };

export function db(): PrismaClient {
  return (g.__smPrisma ??= crear());
}
