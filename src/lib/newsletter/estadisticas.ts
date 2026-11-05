import "server-only";
import { db } from "@/lib/db";

/**
 * Los números del newsletter, **sólo los que de verdad se saben**.
 *
 * - Cuánta gente se anotó, confirmó y se dio de baja, del historial del
 *   consentimiento (`suscripcion_eventos`).
 * - De cada envío: a cuántos les salió, a cuántos no y por qué, de la cola
 *   (`boletin_envios`).
 * - Las bajas por el enlace del correo en los 7 días siguientes a cada envío.
 *   Es lo más cerca que se puede llegar de "cuánta gente se fue por este
 *   newsletter" sin rastrear a nadie, y la pantalla lo dice así.
 *
 * Lo que **no** hay, y la pantalla tampoco inventa: aperturas y clics (se
 * decidió no medirlos el 2026-11-05) y rebotes posteriores (un correo que el
 * servidor aceptó y después rebotó en el buzón de la persona vuelve como correo
 * a la cuenta del diario, y el sistema no lo lee). Cuando un número no se
 * puede calcular —no hubo altas, no hubo envíos— se devuelve null y la
 * pantalla lo dice con palabras, en vez de mostrar un 0 % que parece un dato.
 */

const DIA = 86_400_000;

export interface ResumenDeSuscripciones {
  dias: number;
  altas: number;
  confirmaciones: number;
  bajas: number;
  /** De las que se anotaron en el período, cuántas ya confirmaron. null si no
   *  se anotó nadie. */
  confirmaronDeLasAltas: { confirmaron: number; de: number } | null;
}

export async function resumenDeSuscripciones(
  dias = 30,
  ahora = new Date(),
): Promise<ResumenDeSuscripciones> {
  const desde = new Date(ahora.getTime() - dias * DIA);
  const [eventos, altas, confirmadas] = await Promise.all([
    db().eventoSuscripcion.groupBy({
      by: ["tipo"],
      where: { fecha: { gte: desde }, tipo: { in: ["alta", "confirmacion", "baja", "reactivacion"] } },
      _count: { _all: true },
    }),
    db().suscripcion.count({ where: { fecha: { gte: desde } } }),
    db().suscripcion.count({
      where: { fecha: { gte: desde }, confirmadaEn: { not: null } },
    }),
  ]);
  const de = (tipo: string) =>
    eventos.find((e) => e.tipo === tipo)?._count._all ?? 0;
  return {
    dias,
    // Volver a anotarse después de una baja también es un alta.
    altas: de("alta") + de("reactivacion"),
    confirmaciones: de("confirmacion"),
    bajas: de("baja"),
    confirmaronDeLasAltas: altas > 0 ? { confirmaron: confirmadas, de: altas } : null,
  };
}

export interface EnvioEnHistorial {
  id: string;
  asunto: string;
  estado: string;
  iniciado: string;
  destinatarios: number;
  enviados: number;
  /** Recorridos en modo de práctica: no le llegaron a nadie. */
  simulados: number;
  fallidos: number;
  omitidos: number;
  cancelados: number;
  /** Bajas por el enlace del correo en los 7 días siguientes. */
  bajasEnLaSemana: number;
}

type FilaHistorial = {
  id: string;
  asunto: string;
  estado: string;
  iniciado: Date;
  destinatarios: number | null;
  enviados: number;
  simulados: number;
  fallidos: number;
  omitidos: number;
  cancelados: number;
  bajas: number;
};

/** Los newsletters que empezaron a salir, del más nuevo al más viejo. */
export async function historialDeEnvios(
  pagina: number,
  porPagina: number,
): Promise<{ filas: EnvioEnHistorial[]; total: number }> {
  const [total, filas] = await Promise.all([
    db().boletin.count({ where: { envioIniciadoEn: { not: null } } }),
    db().$queryRaw<FilaHistorial[]>`
      SELECT b."id", b."asunto", b."estado", b."envioIniciadoEn" AS "iniciado",
             b."destinatarios",
             count(e.*) FILTER (WHERE e."estado" = 'enviado')::int   AS "enviados",
             count(e.*) FILTER (WHERE e."estado" = 'simulado')::int  AS "simulados",
             count(e.*) FILTER (WHERE e."estado" = 'fallido')::int   AS "fallidos",
             count(e.*) FILTER (WHERE e."estado" = 'omitido')::int   AS "omitidos",
             count(e.*) FILTER (WHERE e."estado" = 'cancelado')::int AS "cancelados",
             (SELECT count(*)::int FROM "suscripcion_eventos" ev
               WHERE ev."tipo" = 'baja' AND ev."via" IN ('enlace', 'un-click')
                 AND ev."fecha" >= b."envioIniciadoEn"
                 AND ev."fecha" < b."envioIniciadoEn" + interval '7 days') AS "bajas"
      FROM "boletines" b
      LEFT JOIN "boletin_envios" e ON e."boletinId" = b."id"
      WHERE b."envioIniciadoEn" IS NOT NULL
      GROUP BY b."id"
      ORDER BY b."envioIniciadoEn" DESC
      LIMIT ${porPagina} OFFSET ${(pagina - 1) * porPagina}`,
  ]);
  return {
    total,
    filas: filas.map((f) => ({
      id: f.id,
      asunto: f.asunto,
      estado: f.estado,
      iniciado: f.iniciado.toISOString(),
      destinatarios: f.destinatarios ?? 0,
      enviados: f.enviados,
      simulados: f.simulados,
      fallidos: f.fallidos,
      omitidos: f.omitidos,
      cancelados: f.cancelados,
      bajasEnLaSemana: f.bajas,
    })),
  };
}
