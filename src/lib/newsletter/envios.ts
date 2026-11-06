import "server-only";
import { db } from "@/lib/db";
import { SITIO_URL } from "@/lib/compartir";
import { abrirCorreo, enviadosUltimas24h, topeDiario } from "@/lib/correo/enviar";
import { aPiezas, resolverNotas } from "@/lib/repos/boletines";
import { pedirConfirmacionesPendientes } from "@/lib/repos/suscripciones";
import { firmarEnlace, secretoDeEnlaces } from "@/lib/newsletter/enlaces";
import {
  armarBoletin,
  esBloque,
  type DatosDelBoletin,
  type NotaDelBoletin,
} from "@/lib/newsletter/plantilla";
import {
  PAUSA_POR_CUENTA_MIN,
  proximoIntento,
} from "@/lib/newsletter/cola";

/**
 * El envío del newsletter a la lista: la cola.
 *
 * **Cómo anda.** Supabase (pg_cron) llama cada minuto a
 * `POST /api/newsletter/procesar`, que corre `procesarCola()`. Cada vuelta:
 *
 * 1. Da por perdidos los que quedaron "enviando" de una vuelta que se cortó
 *    (ver `ENVIANDO_PERDIDO_MIN`). **No se reintentan**: no se sabe si
 *    salieron, y repetir es mandarle dos veces el mismo correo a alguien.
 * 2. Toma los newsletters programados cuya hora ya llegó: congela su
 *    contenido y anota a cada suscripción activa en `boletin_envios`.
 * 3. Si el municipio autorizó escribirles a los vecinos, manda los correos
 *    para confirmar que estén esperando.
 * 4. Reserva una tanda chica de destinatarios y les manda, hasta que se acaba
 *    la tanda o el tiempo. Lo que no llegó a salir vuelve a la fila.
 * 5. Cierra los newsletters que ya no tienen a nadie esperando.
 *
 * **Por qué tandas chicas y no "todos de una":** Vercel (plan Hobby) corta cada
 * función a los 10 segundos. Con una conexión abierta, Google acepta un correo
 * cada medio segundo más o menos; doce por vuelta dejan margen. Son unos 720
 * por hora: una lista de 2000 sale en menos de tres horas.
 *
 * **Sin duplicados:** la clave de `boletin_envios` es (newsletter, suscripción),
 * así que anotar dos veces es un no-op; y la reserva de la tanda es un único
 * UPDATE con `FOR UPDATE SKIP LOCKED`, así que dos vueltas que se pisen nunca
 * toman a la misma persona.
 */

/** Destinatarios por vuelta. */
const TANDA = 12;
/** A partir de acá no se empieza otro correo en esta vuelta. */
const PLAZO_MS = 6500;
/** Una fila "enviando" más vieja que esto es de una vuelta que se murió. */
const ENVIANDO_PERDIDO_MIN = 5;

/** Lo que se congela al empezar: los textos y las notas ya resueltas. */
export type ContenidoCongelado = DatosDelBoletin;

function aContenido(valor: unknown): ContenidoCongelado | null {
  if (!valor || typeof valor !== "object") return null;
  const v = valor as Record<string, unknown>;
  if (typeof v.asunto !== "string" || !Array.isArray(v.notas)) return null;
  return {
    asunto: v.asunto,
    preencabezado: typeof v.preencabezado === "string" ? v.preencabezado : "",
    introduccion: typeof v.introduccion === "string" ? v.introduccion : "",
    cierre: typeof v.cierre === "string" ? v.cierre : "",
    notas: v.notas as NotaDelBoletin[],
  };
}

export function enlaceDeBaja(suscripcionId: string): string {
  const t = firmarEnlace(secretoDeEnlaces(), "baja", suscripcionId);
  return `${SITIO_URL.origin}/newsletter/baja?t=${t}`;
}

function bajaUnClic(suscripcionId: string): string {
  const t = firmarEnlace(secretoDeEnlaces(), "baja", suscripcionId);
  return `${SITIO_URL.origin}/api/newsletter/baja?t=${t}`;
}

/* -------------------------------------------------------- desde el panel */

/**
 * Programa un borrador. "Enviar ahora" es programar para este momento: la cola
 * lo toma en el minuto siguiente, y hasta entonces se puede cancelar.
 *
 * Devuelve false si ya no es un borrador (otra pestaña lo programó o lo
 * borró).
 */
export async function programarEnvio(
  id: string,
  cuando: Date,
  autor: { id: string; nombre: string },
): Promise<boolean> {
  const r = await db().boletin.updateMany({
    where: { id, estado: "borrador" },
    data: {
      estado: "programado",
      programadoPara: cuando,
      programadoPorId: autor.id,
      programadoPorNombre: autor.nombre,
    },
  });
  return r.count > 0;
}

/**
 * Vuelve un programado a borrador. Sólo si todavía no empezó: el estado va en
 * el filtro, así que si la cola lo tomó en el mismo instante, gana la cola y
 * esto devuelve false (y el panel ofrece detenerlo).
 */
export async function cancelarProgramacion(id: string): Promise<boolean> {
  const r = await db().boletin.updateMany({
    where: { id, estado: "programado" },
    data: {
      estado: "borrador",
      programadoPara: null,
      programadoPorId: null,
      programadoPorNombre: null,
    },
  });
  return r.count > 0;
}

/**
 * Detiene un envío en curso. Lo que ya salió, salió; a quien todavía no le
 * tocaba no le llega. Lo que la vuelta de ese momento ya tenía en la mano
 * (hasta una tanda) puede salir igual.
 *
 * Devuelve cuántos destinatarios se quedaron sin recibirlo, o null si el envío
 * ya no estaba en curso.
 */
export async function detenerEnvio(
  id: string,
  autor: { nombre: string },
): Promise<number | null> {
  return db().$transaction(async (tx) => {
    const r = await tx.boletin.updateMany({
      where: { id, estado: "enviando" },
      data: {
        estado: "cancelado",
        canceladoEn: new Date(),
        canceladoPorNombre: autor.nombre,
      },
    });
    if (r.count === 0) return null;
    const c = await tx.envioBoletin.updateMany({
      where: { boletinId: id, estado: "pendiente" },
      data: { estado: "cancelado" },
    });
    return c.count;
  });
}

export type EstadoDeEnvio =
  | "pendiente"
  | "enviando"
  | "enviado"
  | "simulado"
  | "fallido"
  | "omitido"
  | "cancelado";

export const ESTADOS_DE_ENVIO: EstadoDeEnvio[] = [
  "enviado",
  "simulado",
  "pendiente",
  "enviando",
  "fallido",
  "omitido",
  "cancelado",
];

/** Cuántos destinatarios hay en cada estado, para el seguimiento. */
export async function contarEnvios(
  boletinId: string,
): Promise<Record<EstadoDeEnvio, number>> {
  const grupos = await db().envioBoletin.groupBy({
    by: ["estado"],
    where: { boletinId },
    _count: { _all: true },
  });
  const cuentas = Object.fromEntries(
    ESTADOS_DE_ENVIO.map((e) => [e, 0]),
  ) as Record<EstadoDeEnvio, number>;
  for (const g of grupos) {
    if (g.estado in cuentas) cuentas[g.estado as EstadoDeEnvio] += g._count._all;
  }
  return cuentas;
}

export interface EnvioConProblema {
  nombre: string;
  email: string;
  estado: "fallido" | "pendiente";
  intentos: number;
  error: string | null;
  proximoIntento: string;
}

/** Los que fallaron o están esperando un reintento, de a una página. */
export async function enviosConProblema(
  boletinId: string,
  pagina: number,
  porPagina = 20,
): Promise<{ filas: EnvioConProblema[]; total: number }> {
  const where = {
    boletinId,
    OR: [
      { estado: "fallido" },
      { estado: "pendiente", intentos: { gt: 0 } },
    ],
  };
  const [total, filas] = await Promise.all([
    db().envioBoletin.count({ where }),
    db().envioBoletin.findMany({
      where,
      orderBy: [{ estado: "asc" }, { proximoIntento: "asc" }],
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      select: {
        estado: true,
        intentos: true,
        error: true,
        proximoIntento: true,
        suscripcion: { select: { nombre: true, email: true } },
      },
    }),
  ]);
  return {
    total,
    filas: filas.map((f) => ({
      nombre: f.suscripcion.nombre,
      email: f.suscripcion.email,
      estado: f.estado === "fallido" ? "fallido" : "pendiente",
      intentos: f.intentos,
      error: f.error,
      proximoIntento: f.proximoIntento.toISOString(),
    })),
  };
}

/** El contenido congelado de un envío, para mostrarlo tal cual salió. */
export async function contenidoDelEnvio(
  boletinId: string,
): Promise<ContenidoCongelado | null> {
  const b = await db().boletin.findUnique({
    where: { id: boletinId },
    select: { contenido: true },
  });
  return aContenido(b?.contenido);
}

/* ------------------------------------------------------------- la cola */

export interface VueltaDeCola {
  perdidos: number;
  iniciados: number;
  cancelados: number;
  confirmaciones: number;
  enviados: number;
  simulados: number;
  fallidos: number;
  reintentos: number;
  omitidos: number;
  devueltos: number;
  terminados: number;
  /** La vuelta no mandó porque se llegó al tope diario de la cuenta. */
  topeAlcanzado: boolean;
  /** La cuenta del diario rechazó el envío: la cola se frenó un rato. */
  cuentaRechazada: boolean;
}

/** 1. Los que quedaron "enviando" de una vuelta que se murió. */
async function cerrarPerdidos(ahora: Date): Promise<number> {
  const r = await db().envioBoletin.updateMany({
    where: {
      estado: "enviando",
      tomadoEn: { lt: new Date(ahora.getTime() - ENVIANDO_PERDIDO_MIN * 60_000) },
    },
    data: {
      estado: "fallido",
      error:
        "El envío se cortó en el medio y no se sabe si llegó. No se repite, para no mandarlo dos veces.",
    },
  });
  return r.count;
}

/** 2. Los programados cuya hora llegó: se congelan y se anota la lista. */
async function iniciarProgramados(
  ahora: Date,
): Promise<{ iniciados: number; cancelados: number }> {
  const listos = await db().boletin.findMany({
    where: { estado: "programado", programadoPara: { lte: ahora } },
    orderBy: { programadoPara: "asc" },
    take: 3,
    select: {
      id: true,
      asunto: true,
      preencabezado: true,
      introduccion: true,
      notas: true,
      cierre: true,
    },
  });
  let iniciados = 0;
  let cancelados = 0;
  for (const b of listos) {
    const elegidas = aPiezas(b.notas);
    const { notas } = await resolverNotas(elegidas);
    const soloTexto =
      elegidas.length === 0 && Boolean(b.introduccion.trim() || b.cierre.trim());
    if (notas.length === 0 && !soloTexto) {
      // Se borraron todas sus notas entre que se programó y su hora. Mandar un
      // correo vacío no tiene sentido: se detiene y el panel dice por qué.
      // (Uno que se armó de puro texto, sin notas, sí sale.)
      const r = await db().boletin.updateMany({
        where: { id: b.id, estado: "programado" },
        data: {
          estado: "cancelado",
          canceladoEn: ahora,
          motivoCancelacion:
            "No salió: a la hora programada ya no quedaba ninguna de sus notas en el diario.",
        },
      });
      cancelados += r.count;
      continue;
    }
    const contenido: ContenidoCongelado = {
      asunto: b.asunto,
      preencabezado: b.preencabezado,
      introduccion: b.introduccion,
      cierre: b.cierre,
      notas: notas.map((n) =>
        esBloque(n)
          ? n
          : {
              slug: n.slug,
              seccion: n.seccion,
              titulo: n.titulo,
              resumen: n.resumen,
              ...(n.imagen ? { imagen: n.imagen } : {}),
            },
      ),
    };
    const empezo = await db().$transaction(async (tx) => {
      // El estado en el filtro: si dos vueltas llegan juntas, una sola lo
      // inicia; y si alguien canceló la programación recién, no se inicia.
      const r = await tx.boletin.updateMany({
        where: { id: b.id, estado: "programado" },
        data: {
          estado: "enviando",
          contenido: contenido as object,
          envioIniciadoEn: ahora,
        },
      });
      if (r.count === 0) return false;
      // La lista de ese momento. Quien confirme después no entra en este
      // envío: entra en el próximo.
      const anotados = await tx.$executeRaw`
        INSERT INTO "boletin_envios" ("boletinId", "suscripcionId")
        SELECT ${b.id}, s."id" FROM "suscripciones" s WHERE s."estado" = 'activa'
        ON CONFLICT DO NOTHING`;
      await tx.boletin.update({
        where: { id: b.id },
        data: { destinatarios: anotados },
      });
      return true;
    });
    if (empezo) iniciados++;
  }
  return { iniciados, cancelados };
}

type Reservado = { boletinId: string; suscripcionId: string; intentos: number };

/** 4a. Reserva una tanda. Un solo UPDATE: nadie más puede tomar las mismas
 *  filas, ni otra vuelta que corra al mismo tiempo. */
async function reservar(cantidad: number): Promise<Reservado[]> {
  if (cantidad <= 0) return [];
  return db().$queryRaw<Reservado[]>`
    UPDATE "boletin_envios" e
    SET "estado" = 'enviando', "tomadoEn" = now(), "intentos" = e."intentos" + 1
    FROM (
      SELECT be."boletinId", be."suscripcionId"
      FROM "boletin_envios" be
      JOIN "boletines" b ON b."id" = be."boletinId"
      WHERE be."estado" = 'pendiente'
        AND be."proximoIntento" <= now()
        AND b."estado" = 'enviando'
      ORDER BY be."proximoIntento"
      LIMIT ${cantidad}
      FOR UPDATE OF be SKIP LOCKED
    ) t
    WHERE e."boletinId" = t."boletinId" AND e."suscripcionId" = t."suscripcionId"
    RETURNING e."boletinId", e."suscripcionId", e."intentos"`;
}

/** Devuelve a la fila lo reservado que no se llegó a mandar, sin gastarle un
 *  intento. */
async function devolver(filas: Reservado[], desde: Date): Promise<void> {
  for (const f of filas) {
    await db().envioBoletin.updateMany({
      where: {
        boletinId: f.boletinId,
        suscripcionId: f.suscripcionId,
        estado: "enviando",
      },
      data: {
        estado: "pendiente",
        intentos: { decrement: 1 },
        tomadoEn: null,
        proximoIntento: desde,
      },
    });
  }
}

async function marcar(
  f: Reservado,
  datos: {
    estado: EstadoDeEnvio;
    error?: string | null;
    enviadoEn?: Date | null;
    proximoIntento?: Date;
  },
): Promise<void> {
  await db().envioBoletin.updateMany({
    where: { boletinId: f.boletinId, suscripcionId: f.suscripcionId },
    data: {
      estado: datos.estado,
      error: datos.error ?? null,
      enviadoEn: datos.enviadoEn ?? null,
      ...(datos.proximoIntento ? { proximoIntento: datos.proximoIntento } : {}),
    },
  });
}

/** 5. Los que ya no tienen a nadie esperando, terminados. */
async function cerrarTerminados(ahora: Date): Promise<number> {
  return db().$executeRaw`
    UPDATE "boletines" b
    SET "estado" = 'enviado', "envioTerminadoEn" = ${ahora}
    WHERE b."estado" = 'enviando'
      AND NOT EXISTS (
        SELECT 1 FROM "boletin_envios" e
        WHERE e."boletinId" = b."id" AND e."estado" IN ('pendiente', 'enviando')
      )`;
}

/**
 * Una vuelta de la cola. La llama el endpoint del cron, cada minuto.
 *
 * Nunca manda a alguien que no esté "activa" en ese momento: la lista se anota
 * al empezar, pero cada correo vuelve a mirar la suscripción antes de salir.
 */
export async function procesarCola(inicio = Date.now()): Promise<VueltaDeCola> {
  const ahora = new Date(inicio);
  const vuelta: VueltaDeCola = {
    perdidos: 0,
    iniciados: 0,
    cancelados: 0,
    confirmaciones: 0,
    enviados: 0,
    simulados: 0,
    fallidos: 0,
    reintentos: 0,
    omitidos: 0,
    devueltos: 0,
    terminados: 0,
    topeAlcanzado: false,
    cuentaRechazada: false,
  };
  const quedaTiempo = () => Date.now() - inicio < PLAZO_MS;

  vuelta.perdidos = await cerrarPerdidos(ahora);
  Object.assign(vuelta, await iniciarProgramados(ahora));

  const correo = abrirCorreo();
  try {
    let disponibles = Infinity;
    if (correo.real) {
      disponibles = Math.max(0, topeDiario() - (await enviadosUltimas24h(ahora)));
      if (disponibles === 0) vuelta.topeAlcanzado = true;
    }

    // 3. Las confirmaciones primero: son pocas y alguien está esperando ese
    // correo ahora mismo para terminar de anotarse.
    if (correo.real && disponibles > 0 && quedaTiempo()) {
      vuelta.confirmaciones = await pedirConfirmacionesPendientes(
        Math.min(5, disponibles),
        quedaTiempo,
      );
      disponibles -= vuelta.confirmaciones;
    }

    const tanda = await reservar(Math.min(TANDA, disponibles));
    if (tanda.length > 0) {
      const [suscripciones, boletines] = await Promise.all([
        db().suscripcion.findMany({
          where: { id: { in: [...new Set(tanda.map((t) => t.suscripcionId))] } },
          select: { id: true, email: true, estado: true },
        }),
        db().boletin.findMany({
          where: { id: { in: [...new Set(tanda.map((t) => t.boletinId))] } },
          select: { id: true, contenido: true },
        }),
      ]);
      const porSuscripcion = new Map(suscripciones.map((s) => [s.id, s]));
      const contenidos = new Map(
        boletines.map((b) => [b.id, aContenido(b.contenido)]),
      );

      for (let i = 0; i < tanda.length; i++) {
        const f = tanda[i];
        if (!quedaTiempo() || vuelta.cuentaRechazada) {
          const resto = tanda.slice(i);
          await devolver(
            resto,
            vuelta.cuentaRechazada
              ? new Date(Date.now() + PAUSA_POR_CUENTA_MIN * 60_000)
              : new Date(),
          );
          vuelta.devueltos += resto.length;
          break;
        }
        const s = porSuscripcion.get(f.suscripcionId);
        if (!s || s.estado !== "activa") {
          await marcar(f, { estado: "omitido" });
          vuelta.omitidos++;
          continue;
        }
        const contenido = contenidos.get(f.boletinId);
        if (!contenido) {
          await marcar(f, {
            estado: "fallido",
            error: "El contenido del newsletter no se pudo leer.",
          });
          vuelta.fallidos++;
          continue;
        }
        const r = await correo.mandar({
          para: s.email,
          correo: armarBoletin(contenido, enlaceDeBaja(s.id)),
          bajaUnClic: bajaUnClic(s.id),
        });
        if (r.estado !== "fallido") {
          await marcar(f, { estado: r.estado, enviadoEn: new Date() });
          if (r.estado === "enviado") vuelta.enviados++;
          else vuelta.simulados++;
          continue;
        }
        if (r.clase === "cuenta") {
          // No es culpa de esta persona: vuelve a la fila sin gastar el
          // intento, y la cola entera espera un rato.
          vuelta.cuentaRechazada = true;
          await devolver([f], new Date(Date.now() + PAUSA_POR_CUENTA_MIN * 60_000));
          vuelta.devueltos++;
          console.error("[newsletter] la cuenta rechazó el envío:", r.mensaje);
          continue;
        }
        const otra = r.clase === "transitorio" ? proximoIntento(f.intentos) : null;
        if (otra) {
          await marcar(f, { estado: "pendiente", error: r.mensaje, proximoIntento: otra });
          vuelta.reintentos++;
        } else {
          await marcar(f, { estado: "fallido", error: r.mensaje });
          vuelta.fallidos++;
        }
      }
    }
  } finally {
    correo.cerrar();
  }

  vuelta.terminados = await cerrarTerminados(new Date());
  return vuelta;
}
