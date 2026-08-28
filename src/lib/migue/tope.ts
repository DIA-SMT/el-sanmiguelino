import "server-only";
import { createHmac } from "node:crypto";
import { db } from "@/lib/db";

/**
 * Tope de consultas al modelo, por persona y por hora.
 *
 * Cada pregunta que llega al modelo cuesta plata del municipio, y no hay nada
 * que frene a alguien que insista. Esto no es antiabuso sofisticado —quien
 * quiera romperlo lo va a romper— sino un techo de gasto: que un mal día no se
 * lleve el presupuesto del mes.
 *
 * **Pasarse no rompe a Migue.** Cuando alguien llega al tope, sigue
 * contestando con el buscador por palabras clave, que no cuesta nada. Un
 * asistente que se planta y dice "no puedo atenderte" es peor experiencia que
 * uno que contesta un poco peor, y además el vecino no tiene por qué enterarse
 * de nuestros costos.
 */

/** Por persona y por hora. */
const TOPE_POR_PERSONA = Number(process.env.MIGUE_TOPE_PERSONA ?? 20);

/** Entre todos, por hora. Es el techo de gasto de verdad: si mil vecinos
 *  preguntan veinte veces cada uno, el tope individual no protege nada. */
const TOPE_GLOBAL = Number(process.env.MIGUE_TOPE_GLOBAL ?? 300);

/**
 * La clave con la que la lectura en voz alta anota su consumo.
 *
 * **Vive acá aunque la escriba `/api/voz`, y eso es a propósito.** La tabla
 * `ConsumoMigue` la comparten dos presupuestos que no se mezclan: las llamadas
 * al modelo, que deciden si Migue puede responder preguntas, y las
 * generaciones de audio, que son otra cosa y otra plata. Las dos consultas de
 * este archivo excluyen esta clave.
 *
 * Si la constante viviera del lado de quien escribe, un cambio de string
 * rompería el filtro **en silencio**: la voz volvería a comerle a Migue sus
 * llamadas de la hora y a contarse como una persona en el tablero, sin que
 * nada falle. Exportada desde acá, quien filtra y quien escribe no pueden
 * diferir.
 */
export const CLAVE_DE_LA_VOZ = "voz";

/**
 * El identificador de quien pregunta, sin poder decir quién es.
 *
 * Se saltea con `SESSION_SECRET`, que no sale del servidor. Sin sal, un hash
 * de un id de Cidituc se revierte probando: el espacio de ids es chico y
 * conocido. Con sal, la tabla de consumo no permite reconstruir a nadie ni
 * cruzarla con el registro de preguntas.
 */
function claveDe(usuarioId: string): string {
  const sal = process.env.SESSION_SECRET ?? "sin-sal-en-desarrollo";
  return createHmac("sha256", sal)
    .update(`migue:${usuarioId}`)
    .digest("base64url")
    .slice(0, 32);
}

/** El comienzo de la hora en curso. */
function ventanaActual(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  return d;
}

export interface EstadoTope {
  /** ¿Se puede llamar al modelo? */
  permitido: boolean;
  /** Por qué no, para el registro. */
  motivo?: "persona" | "global";
}

/**
 * Cuenta una consulta al modelo y dice si estaba permitida.
 *
 * **Incrementa primero y pregunta después**, en una sola sentencia atómica. Al
 * revés —leer, decidir, escribir— dos pedidos simultáneos leen el mismo número
 * y los dos pasan: con veinte pestañas abiertas el tope no existe. Así el
 * contador nunca miente, y como mucho se rechaza una consulta que estaba justo
 * en el límite.
 *
 * Si la base no está, deja pasar: el tope es una protección de costos, no de
 * seguridad, y no vale la pena que una caída de Postgres apague a Migue.
 */
export async function contarConsultaAlModelo(
  usuarioId: string,
): Promise<EstadoTope> {
  if (!process.env.DATABASE_URL) return { permitido: true };

  const ventana = ventanaActual();
  const clave = claveDe(usuarioId);

  try {
    const fila = await db().consumoMigue.upsert({
      where: { clave_ventana: { clave, ventana } },
      create: { clave, ventana, consultas: 1 },
      update: { consultas: { increment: 1 } },
      select: { consultas: true },
    });

    if (fila.consultas > TOPE_POR_PERSONA) {
      return { permitido: false, motivo: "persona" };
    }

    // El global se mira sólo si el individual pasó: es una consulta más y no
    // hace falta pagarla en cada request de alguien que ya se pasó.
    // `clave: { not: CLAVE_DE_LA_VOZ }`: la tabla la comparte el fusible de la
    // lectura en voz alta (`/api/voz`), que reusa el mecanismo pero NO el
    // presupuesto. Sin este filtro, un vecino escuchando notas le come a Migue
    // sus llamadas al modelo de la hora —hasta 60 de 300 bajo ráfaga— y Migue
    // deja de responder preguntas por algo que no es una pregunta.
    const total = await db().consumoMigue.aggregate({
      where: { ventana, clave: { not: CLAVE_DE_LA_VOZ } },
      _sum: { consultas: true },
    });
    if ((total._sum.consultas ?? 0) > TOPE_GLOBAL) {
      return { permitido: false, motivo: "global" };
    }

    return { permitido: true };
  } catch {
    // Ver arriba: ante la duda, que Migue funcione.
    return { permitido: true };
  }
}

/** Lo que consumió la hora en curso, para el tablero. */
export async function consumoDeLaHora(): Promise<{
  consultas: number;
  personas: number;
  topePersona: number;
  topeGlobal: number;
}> {
  const vacio = {
    consultas: 0,
    personas: 0,
    topePersona: TOPE_POR_PERSONA,
    topeGlobal: TOPE_GLOBAL,
  };
  if (!process.env.DATABASE_URL) return vacio;

  try {
    // Mismo filtro que arriba, y acá importa por otra razón: `personas` se
    // calcula como la cantidad de filas, y la fila de la voz no es una persona.
    // Sin esto el tablero diría "de 1 persona" en una hora en que no preguntó
    // nadie.
    const filas = await db().consumoMigue.findMany({
      where: { ventana: ventanaActual(), clave: { not: CLAVE_DE_LA_VOZ } },
      select: { consultas: true },
    });
    return {
      ...vacio,
      consultas: filas.reduce((t, f) => t + f.consultas, 0),
      personas: filas.length,
    };
  } catch {
    return vacio;
  }
}

/**
 * Borra las ventanas viejas.
 *
 * Se llama de vez en cuando desde el propio camino de la consulta, en vez de
 * montar un trabajo programado: la tabla crece de a una fila por persona y por
 * hora, así que limpiar una de cada cien veces alcanza y sobra. Un cron para
 * esto sería otra cosa que puede dejar de correr.
 */
export async function limpiarVentanasViejas(): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  if (Math.floor(Date.now() / 1000) % 100 !== 0) return;
  try {
    const corte = new Date(Date.now() - 25 * 3600_000);
    await db().consumoMigue.deleteMany({ where: { ventana: { lt: corte } } });
  } catch {
    // No importa: si falla, se limpia la próxima.
  }
}
