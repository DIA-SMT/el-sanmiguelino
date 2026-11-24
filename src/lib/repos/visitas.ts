import "server-only";
import { db } from "@/lib/db";
import { diaDeTucuman } from "@/lib/visitas";

/**
 * Las visitas del diario: sumar una y leerlas para el panel.
 *
 * Una fila de `visitas` es "esta página, este día, tantas veces". No hay
 * nada que identifique a quien leyó (ver el modelo en `schema.prisma`).
 */

const DIA = 86_400_000;

/**
 * Suma una visita a una ruta ya normalizada (`rutaContable()`).
 *
 * Una nota o una edición que no existe no se cuenta: si no, cualquiera
 * podría llenar la tabla de filas inventadas mandando direcciones al azar.
 * Nunca tira: un contador roto no puede romper la lectura del diario.
 */
export async function sumarVisita(ruta: string, ahora = new Date()): Promise<boolean> {
  try {
    const [, tipo, slug] = ruta.split("/");
    if (tipo === "nota") {
      const existe = await db().nota.findUnique({ where: { slug }, select: { slug: true } });
      if (!existe) return false;
    } else if (tipo === "edicion") {
      const existe = await db().edicion.findUnique({ where: { slug }, select: { slug: true } });
      if (!existe) return false;
    }
    const dia = diaDeTucuman(ahora);
    await db().$executeRaw`
      INSERT INTO "visitas" ("dia", "ruta", "cantidad")
      VALUES (${dia}::date, ${ruta}, 1)
      ON CONFLICT ("dia", "ruta") DO UPDATE SET "cantidad" = "visitas"."cantidad" + 1`;
    return true;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[visitas] no se pudo sumar:", error instanceof Error ? error.message : error);
    }
    return false;
  }
}

/* --------------------------------------------------------- para el panel */

export interface ResumenDeVisitas {
  hoy: number;
  ultimos7: number;
  ultimos30: number;
  total: number;
  /** El primer día con visitas, o null si todavía no hay ninguna. */
  desde: string | null;
}

/** "2026-11-24" → Date a medianoche UTC, que es como Postgres devuelve un
 *  `date` y como se compara acá. */
const fecha = (dia: string) => new Date(`${dia}T00:00:00Z`);

export async function resumenDeVisitas(ahora = new Date()): Promise<ResumenDeVisitas> {
  const hoy = fecha(diaDeTucuman(ahora));
  const desde7 = new Date(hoy.getTime() - 6 * DIA);
  const desde30 = new Date(hoy.getTime() - 29 * DIA);
  const [h, s7, s30, total, primera] = await Promise.all([
    db().visita.aggregate({ where: { dia: hoy }, _sum: { cantidad: true } }),
    db().visita.aggregate({ where: { dia: { gte: desde7 } }, _sum: { cantidad: true } }),
    db().visita.aggregate({ where: { dia: { gte: desde30 } }, _sum: { cantidad: true } }),
    db().visita.aggregate({ _sum: { cantidad: true } }),
    db().visita.findFirst({ orderBy: { dia: "asc" }, select: { dia: true } }),
  ]);
  return {
    hoy: h._sum.cantidad ?? 0,
    ultimos7: s7._sum.cantidad ?? 0,
    ultimos30: s30._sum.cantidad ?? 0,
    total: total._sum.cantidad ?? 0,
    desde: primera ? primera.dia.toISOString().slice(0, 10) : null,
  };
}

/** Visitas por día de los últimos `dias` días, con los días sin visitas en
 *  cero: un hueco en el gráfico tiene que verse como hueco. */
export async function visitasPorDia(
  dias = 30,
  ahora = new Date(),
): Promise<{ dia: string; cantidad: number }[]> {
  const hoy = fecha(diaDeTucuman(ahora));
  const desde = new Date(hoy.getTime() - (dias - 1) * DIA);
  const grupos = await db().visita.groupBy({
    by: ["dia"],
    where: { dia: { gte: desde } },
    _sum: { cantidad: true },
  });
  const porDia = new Map(
    grupos.map((g) => [g.dia.toISOString().slice(0, 10), g._sum.cantidad ?? 0]),
  );
  return Array.from({ length: dias }, (_, i) => {
    const dia = new Date(desde.getTime() + i * DIA).toISOString().slice(0, 10);
    return { dia, cantidad: porDia.get(dia) ?? 0 };
  });
}

export interface NotaLeida {
  slug: string;
  titulo: string;
  edicion: string;
  ultimos30: number;
  total: number;
}

/** Las notas más leídas de los últimos 30 días, de a una página. */
export async function notasMasLeidas(
  pagina: number,
  porPagina: number,
  ahora = new Date(),
): Promise<{ filas: NotaLeida[]; total: number }> {
  const desde30 = new Date(fecha(diaDeTucuman(ahora)).getTime() - 29 * DIA);
  const [conteo, filas] = await Promise.all([
    db().$queryRaw<{ n: number }[]>`
      SELECT count(DISTINCT n."slug")::int AS n
      FROM "visitas" v JOIN "notas" n ON v."ruta" = '/nota/' || n."slug"`,
    db().$queryRaw<
      { slug: string; titulo: string; mes: string; numero: number; ultimos30: number; total: number }[]
    >`
      SELECT n."slug", n."titulo", e."mes", e."numero",
             coalesce(sum(v."cantidad") FILTER (WHERE v."dia" >= ${desde30}::date), 0)::int AS "ultimos30",
             sum(v."cantidad")::int AS "total"
      FROM "visitas" v
      JOIN "notas" n ON v."ruta" = '/nota/' || n."slug"
      JOIN "ediciones" e ON e."id" = n."edicionId"
      GROUP BY n."slug", n."titulo", e."mes", e."numero"
      ORDER BY "ultimos30" DESC, "total" DESC, n."titulo"
      LIMIT ${porPagina} OFFSET ${(pagina - 1) * porPagina}`,
  ]);
  return {
    total: conteo[0]?.n ?? 0,
    filas: filas.map((f) => ({
      slug: f.slug,
      titulo: f.titulo,
      edicion: `${f.mes} · N.º ${f.numero}`,
      ultimos30: f.ultimos30,
      total: f.total,
    })),
  };
}

export interface EdicionLeida {
  edicion: string;
  visitas: number;
}

/** Cuánto se leyó cada edición: sus notas más su página de edición. */
export async function visitasPorEdicion(): Promise<EdicionLeida[]> {
  const filas = await db().$queryRaw<{ mes: string; numero: number; visitas: number }[]>`
    SELECT e."mes", e."numero", coalesce(sum(v."cantidad"), 0)::int AS "visitas"
    FROM "ediciones" e
    LEFT JOIN "notas" n ON n."edicionId" = e."id"
    LEFT JOIN "visitas" v
      ON v."ruta" = '/nota/' || n."slug"
    GROUP BY e."id", e."mes", e."numero", e."anio"
    ORDER BY e."anio" DESC, e."numero" DESC`;
  const deLaEdicion = await db().$queryRaw<{ mes: string; numero: number; visitas: number }[]>`
    SELECT e."mes", e."numero", coalesce(sum(v."cantidad"), 0)::int AS "visitas"
    FROM "ediciones" e JOIN "visitas" v ON v."ruta" = '/edicion/' || e."slug"
    GROUP BY e."mes", e."numero"`;
  const extra = new Map(deLaEdicion.map((f) => [`${f.mes}|${f.numero}`, f.visitas]));
  return filas.map((f) => ({
    edicion: `${f.mes} · N.º ${f.numero}`,
    visitas: f.visitas + (extra.get(`${f.mes}|${f.numero}`) ?? 0),
  }));
}
