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

function crear() {
  // El tope del pool va acá y no en la URL: `pg-pool` lee `max`, nunca el
  // `connection_limit` que se le pone como query param —ese era del motor viejo
  // de Prisma y con los driver adapters de la 7 no lo lee nadie—.
  //
  // Era 1, con el argumento de que en serverless cada invocación es un proceso
  // propio. **Esa premisa es falsa**: una misma instancia atiende varios
  // pedidos a la vez, y con el pool en uno TODAS las consultas de la instancia
  // hacen fila india. Se nota justo donde más molesta: entrar a una nota
  // dispara la precarga de las dos vecinas, así que son tres renders —quince
  // consultas— esperando por una sola conexión.
  //
  // Tres es deliberadamente conservador. Contra el pooler de Supabase en modo
  // transacción las conexiones de cliente son baratas —el pooler multiplexa
  // contra pocas conexiones de servidor—, pero el número se multiplica por
  // cada instancia que Vercel levante, así que no conviene la generosidad.
  const adapter = new PrismaPg(
    {
      connectionString: cadena(),
      max: Number(process.env.DB_POOL_MAX ?? 3),

      /**
       * Cuánto se guarda una conexión ociosa antes de cerrarla.
       *
       * **Cero: no cerrar por ocioso.** El default de `pg-pool` son 10
       * segundos, y eso dejaba a la instancia sin ninguna conexión entre
       * página y página: la siguiente consulta pagaba de nuevo el TCP, el TLS
       * y la autenticación del pooler. Medido: 54 ms en caliente contra 271 ms
       * tras 12 segundos quieto. Diez segundos es el peor número posible para
       * un diario, porque el lector lee la nota un minuto y siempre cae del
       * lado frío.
       *
       * Se probó volver a un número intermedio (30 s) sospechando que el
       * `Connection terminated unexpectedly` del panel venía de guardar
       * sockets que Supabase ya había cerrado. **La medición lo desmintió**:
       * 15 minutos de ocio real, con los dos pools en paralelo contra la base
       * de verdad, y el de cero sobrevivió igual —57 ms— mientras que el de
       * 30 s pagó el reconecte —259 ms—. O sea que cerrar por ocioso no
       * arreglaba nada y traía de vuelta la demora.
       *
       * Queda en cero, entonces, y lo que cubre el caso raro es el reintento
       * de abajo. Si algún día hay muchas instancias a la vez y hace falta
       * acotar conexiones, está DB_POOL_IDLE_MS.
       */
      idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_MS ?? 0),

      // Que el socket no se muera en silencio del otro lado mientras nadie
      // pregunta. No alcanza solo —ver arriba—, pero suma.
      keepAlive: true,
    },
    {
      /**
       * Una conexión ociosa que se muere no rompe nada por sí sola: el
       * adaptador la saca del pool. Pero en silencio esto es indistinguible de
       * "anda todo bien", y así fue como el problema de arriba tardó en
       * aparecer. En desarrollo se avisa.
       */
      onPoolError: (e: Error) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[db] se murió una conexión ociosa:", e.message);
        }
      },
    },
  );

  /**
   * Un reintento cuando la conexión estaba muerta, **sólo en lecturas**.
   *
   * Que el pool entregue un socket que el servidor ya cerró es inevitable: por
   * corto que sea el tiempo de ocio, siempre hay una ventana entre que el otro
   * lado cierra y nosotros nos enteramos. La consulta que cae ahí no falló:
   * nunca llegó a salir.
   *
   * Las escrituras NO se reintentan. El mensaje no distingue "la conexión
   * estaba muerta antes de mandar nada" de "se cortó después de mandar", y en
   * el segundo caso repetir un `create` publica la nota dos veces. Ante la
   * duda, que el error salga a la vista.
   */
  return new PrismaClient({ adapter }).$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          if (!SOLO_LECTURA.has(operation)) return query(args);
          try {
            return await query(args);
          } catch (e) {
            if (!esConexionMuerta(e)) throw e;
            if (process.env.NODE_ENV !== "production") {
              console.warn(`[db] conexión muerta en ${operation}, reintento`);
            }
            return query(args);
          }
        },
      },
    },
  });
}

/**
 * Operaciones donde repetir no puede duplicar nada.
 *
 * La lista es explícita a propósito: con un "todo lo que no empiece con create"
 * cualquier operación nueva de Prisma entraría sola al reintento.
 */
const SOLO_LECTURA = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);

/** "La conexión estaba muerta", no "la consulta estaba mal". */
function esConexionMuerta(e: unknown): boolean {
  const m = e instanceof Error ? `${e.message}` : String(e);
  return /connection terminated|connection closed|econnreset|epipe|socket hang up|server closed the connection|connection ended unexpectedly/i.test(
    m,
  );
}

/** El cliente con el reintento puesto. El tipo sale de `crear()` porque
 *  `$extends` devuelve algo más angosto que `PrismaClient`. */
type Cliente = ReturnType<typeof crear>;

const g = globalThis as typeof globalThis & { __smPrisma?: Cliente };

export function db(): Cliente {
  return (g.__smPrisma ??= crear());
}
