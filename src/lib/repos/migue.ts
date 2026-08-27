import { db } from "@/lib/db";

/**
 * Registro de lo que le preguntan a Migue.
 *
 * Existe para una sola cosa: saber **qué no supimos contestar**. Cada pregunta
 * sin respuesta es un tema que los vecinos buscan y el diario no cubre, o que
 * cubre con palabras que nadie usa. Es la lista de tareas del mes siguiente.
 *
 * No guarda quién preguntó. Ver el comentario del modelo en el esquema: atar
 * cada consulta a un vecino identificado convertiría un registro de calidad en
 * un historial de consultas de una persona ante el municipio.
 */

export type ResultadoConsulta =
  | "saludo"
  | "indice"
  /** Sobre el diario en sí: cuándo sale la próxima, cada cuánto, el archivo. */
  | "diario"
  | "nota"
  | "sin_respuesta";

const HAY_BASE = Boolean(process.env.DATABASE_URL);

/**
 * Anota una consulta. **Nunca hace fallar la respuesta de Migue.**
 *
 * Si la base no está o el insert falla, se traga el error y sigue. El orden de
 * importancia es claro: que el vecino reciba su respuesta vale más que que
 * nosotros tengamos la estadística. Un registro que puede tumbar el chat es
 * peor que no tener registro.
 *
 * Se espera el insert en vez de dispararlo y seguir: en serverless la función
 * puede terminar en cuanto se manda la respuesta, y una promesa suelta se
 * cancela a mitad de camino. Es un insert de una fila.
 */
export async function registrarConsulta(datos: {
  pregunta: string;
  resultado: ResultadoConsulta;
  notaSlug?: string;
  contextoSlug?: string;
}): Promise<void> {
  if (!HAY_BASE) return;
  try {
    await db().consultaMigue.create({
      data: {
        pregunta: datos.pregunta.slice(0, 500),
        resultado: datos.resultado,
        notaSlug: datos.notaSlug ?? null,
        contextoSlug: datos.contextoSlug ?? null,
      },
    });
  } catch (e) {
    // En producción se traga el error: ver arriba, la respuesta vale más que
    // la estadística. En desarrollo NO, porque si no el registro puede estar
    // roto durante semanas sin que nadie se entere — pasó exactamente eso la
    // primera vez, con el cliente de Prisma sin regenerar.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[migue] no se pudo registrar la consulta:", e);
    }
  }
}

export interface ResumenMigue {
  total: number;
  porResultado: Record<string, number>;
  /** Las que no supimos contestar, agrupadas por texto exacto. */
  sinRespuesta: { pregunta: string; veces: number; ultima: string }[];
  /** Las notas por las que más se preguntó. */
  notasConsultadas: { notaSlug: string; veces: number }[];
}

/**
 * Lo que muestra el tablero.
 *
 * El agrupado de las preguntas sin respuesta es por **texto exacto**, no por
 * significado. Agrupar por significado está fuera de alcance, y decirlo importa:
 * "cuándo abre el registro civil" y "horario del registro civil" van a aparecer
 * como dos filas. Para lo que el tablero tiene que servir —ver qué falta— dos
 * filas parecidas alcanzan; un agrupado semántico mal hecho escondería temas.
 */
export async function resumenMigue(dias = 30): Promise<ResumenMigue> {
  if (!HAY_BASE) {
    return {
      total: 0,
      porResultado: {},
      sinRespuesta: [],
      notasConsultadas: [],
    };
  }

  const desde = new Date(Date.now() - dias * 24 * 3600_000);
  const consultas = await db().consultaMigue.findMany({
    where: { fecha: { gte: desde } },
    orderBy: { fecha: "desc" },
    select: { pregunta: true, resultado: true, notaSlug: true, fecha: true },
  });

  const porResultado: Record<string, number> = {};
  const sinRespuesta = new Map<string, { veces: number; ultima: Date }>();
  const notas = new Map<string, number>();

  for (const c of consultas) {
    porResultado[c.resultado] = (porResultado[c.resultado] ?? 0) + 1;

    if (c.resultado === "sin_respuesta") {
      // La clave normaliza espacios y mayúsculas para que "Horario?" y
      // "horario ?" no cuenten como dos temas distintos. Se guarda el texto tal
      // como lo escribieron, que es lo que hay que leer.
      const clave = c.pregunta.trim().toLowerCase().replace(/\s+/g, " ");
      const previo = sinRespuesta.get(clave);
      if (previo) previo.veces++;
      else sinRespuesta.set(clave, { veces: 1, ultima: c.fecha });
    }

    if (c.notaSlug) notas.set(c.notaSlug, (notas.get(c.notaSlug) ?? 0) + 1);
  }

  // El texto original de la primera aparición (que es la más reciente, porque
  // vienen ordenadas desc).
  const textoDe = new Map<string, string>();
  for (const c of consultas) {
    const clave = c.pregunta.trim().toLowerCase().replace(/\s+/g, " ");
    if (!textoDe.has(clave)) textoDe.set(clave, c.pregunta);
  }

  return {
    total: consultas.length,
    porResultado,
    sinRespuesta: [...sinRespuesta.entries()]
      .map(([clave, v]) => ({
        pregunta: textoDe.get(clave) ?? clave,
        veces: v.veces,
        ultima: v.ultima.toISOString(),
      }))
      .sort((a, b) => b.veces - a.veces || b.ultima.localeCompare(a.ultima)),
    notasConsultadas: [...notas.entries()]
      .map(([notaSlug, veces]) => ({ notaSlug, veces }))
      .sort((a, b) => b.veces - a.veces),
  };
}
