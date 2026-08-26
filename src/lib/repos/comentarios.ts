import { db } from "@/lib/db";
import { comentariosMockRepo } from "@/lib/repos/comentarios-mock";
import { crearComentariosPostgresRepo } from "@/lib/repos/comentarios-postgres";

/**
 * El repo de comentarios que usa la app.
 *
 * Mismo criterio que el de la edición: si hay `DATABASE_URL` se usa Postgres,
 * y si no se cae al motor en memoria, para que clonar el repositorio y mirar
 * el diario no exija credenciales.
 *
 * Acá el fallback pesa más que en la edición, y conviene tenerlo claro: los
 * comentarios del mock son de muestra y se pierden al reiniciar. Sin base, la
 * columna del lector es una demostración, no un lugar donde alguien pueda
 * dejar algo. Por eso en producción tira, igual que la edición: un vecino que
 * escribe y ve desaparecer su comentario al día siguiente es peor que una
 * página que no carga.
 */

const HAY_BASE = Boolean(process.env.DATABASE_URL);

if (!HAY_BASE && process.env.NODE_ENV === "production") {
  throw new Error(
    "Falta DATABASE_URL en producción. Sin base, los comentarios de los " +
      "vecinos se perderían en cada reinicio del servidor.",
  );
}

/** El motor Postgres se construye perezoso —dentro de un getter— porque `db()`
 *  abre el pool al primera llamada, y no hay que abrirlo sólo por importar
 *  este módulo. */
export const comentariosRepo = HAY_BASE
  ? crearComentariosPostgresRepo({
      get comentario() {
        return db().comentario;
      },
      get voto() {
        return db().voto;
      },
    } as Parameters<typeof crearComentariosPostgresRepo>[0])
  : comentariosMockRepo;
