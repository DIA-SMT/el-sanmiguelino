import { db } from "@/lib/db";
import { aHoraTucuman, desdeHoraTucuman } from "@/lib/fecha-edicion";

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
  /** Le pidieron a Migue que le LEA EN VOZ ALTA la página que está mirando.
   *
   *  Es su propio caso y no "nota" a propósito: no es una pregunta que Migue
   *  contestó, es una orden que ejecutó. Contarla como respondida inflaría la
   *  cobertura del tablero exactamente igual que la charla, que ya hubo que
   *  sacar del conteo por eso mismo. */
  | "leer"
  | "sin_respuesta";

/**
 * Lo que el tablero puede recibir: los cinco resultados conocidos, más el cajón
 * de los que todavía no conoce.
 *
 * **El cajón no es defensa de más, es la contracara de una decisión del
 * esquema**: en la base `resultado` es texto y no enum a propósito, "para que
 * sumar un caso no sea una migración con lock" (está escrito en el modelo). O
 * sea que el esquema *promete* que van a aparecer valores nuevos en la base
 * antes de que este código sepa de ellos —un despliegue que agrega un caso, una
 * instancia vieja leyendo la misma base—. Antes ese valor se afirmaba a ciegas
 * como `ResultadoConsulta` y llegaba así hasta la pantalla, donde no encontraba
 * ni nombre ni color: contadores en NaN y una celda vacía. Con el cajón la fila
 * se sigue viendo, dice "Otro resultado", y el tablero aguanta hasta que
 * alguien sume el caso acá. Sacarlo devuelve el NaN.
 */
export type ResultadoEnTablero = ResultadoConsulta | "otro";

/**
 * Los conocidos. Es un objeto tipado y no un array suelto para que el
 * compilador obligue: si mañana se suma un caso a `ResultadoConsulta` y nadie
 * lo agrega acá, esto no compila. Con una lista suelta el olvido sería mudo y
 * el caso nuevo caería en "otro" haciéndose pasar por un valor desconocido de
 * la base, que es justo lo contrario de lo que "otro" quiere decir.
 */
const CONOCIDOS: Record<ResultadoConsulta, true> = {
  saludo: true,
  indice: true,
  diario: true,
  nota: true,
  leer: true,
  sin_respuesta: true,
};

/**
 * El borde entre el texto crudo de la base y el tipo del tablero. Existe uno
 * solo y está acá, que es donde la fila deja de ser una fila de Postgres.
 *
 * Se usa `Object.hasOwn` y no `crudo in CONOCIDOS`: `in` también dice que sí
 * para las claves del prototipo, así que un `resultado` guardado como
 * "toString" o "constructor" pasaría por conocido y volvería a colarse.
 */
function resultadoEnTablero(crudo: string): ResultadoEnTablero {
  return Object.hasOwn(CONOCIDOS, crudo) ? (crudo as ResultadoConsulta) : "otro";
}

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

  /**
   * Cuántas de cada resultado, **con la clave tal como vino de la base**.
   *
   * A propósito no pasa por `resultadoEnTablero`, al revés que `ultimas`, y la
   * diferencia no es un descuido: son dos consumos distintos. `ultimas` dibuja
   * una fila y necesita sí o sí un nombre y un color, así que lo desconocido
   * tiene que caer en un cajón que exista. El anillo, en cambio, no recorre
   * este objeto: recorre su propio orden canónico y busca las claves que
   * conoce, de modo que un valor nuevo no se dibuja, no entra en el total del
   * gráfico y no puede dar NaN. Y `total` es la cantidad de filas, no la suma
   * de esto, así que tampoco descuadra ningún cartel.
   *
   * Ganamos algo por dejarla cruda: **es el único lugar del tablero donde un
   * resultado nuevo queda a la vista con su nombre**. Normalizarlo a "otro" acá
   * también borraría *cuál* apareció, que es el dato que hace falta para
   * decidir si sumarlo a `ResultadoConsulta`.
   */
  porResultado: Record<string, number>;
  /** Las que no supimos contestar, agrupadas por texto exacto. */
  sinRespuesta: { pregunta: string; veces: number; ultima: string }[];
  /** Las notas por las que más se preguntó. */
  notasConsultadas: { notaSlug: string; veces: number }[];

  /** Un punto por día, del más viejo al más nuevo, con los días sin
   *  consultas en 0. `dia` es "AAAA-MM-DD" en hora de Tucumán. */
  serie: { dia: string; total: number; sinRespuesta: number }[];

  /** Consultas de hoy, en hora de Tucumán. */
  hoy: number;

  /** Las últimas consultas, la más reciente primero, para la tabla.
   *  `fecha` es ISO. */
  ultimas: {
    id: string;
    pregunta: string;
    resultado: ResultadoEnTablero;
    notaSlug: string | null;
    contextoSlug: string | null;
    fecha: string;
  }[];
}

/**
 * Cuántas consultas entran en `ultimas`.
 *
 * La tabla es para mirar las últimas preguntas con los ojos, no para auditar el
 * mes: con la ventana de 30 días esto puede ser un findMany de miles de filas y
 * mandarlas todas al cliente serializadas en el HTML del server component es
 * pagar megabytes para dibujar un scroll que nadie recorre.
 *
 * **Cuando el tope se alcanza, la pantalla lo puede decir sin campo nuevo:**
 * `ultimas.length` es `min(TOPE_ULTIMAS, total)`, así que `total >
 * ultimas.length` significa exactamente "esto está recortado" y da el número
 * para escribir "las últimas 200 de 1.348". Se resolvió así y no con un
 * booleano `truncadas` para no agregar al contrato un dato que ya está.
 */
const TOPE_ULTIMAS = 200;

/**
 * El día de Tucumán ("AAAA-MM-DD") en el que cayó ese instante.
 *
 * Se apoya en `aHoraTucuman` en vez de formatear acá con un `Intl` propio: ese
 * helper le pregunta el desfase al sistema **para esa fecha** en vez de restar
 * tres horas a mano, y dos mecanismos paralelos para lo mismo son el lugar
 * exacto donde uno se actualiza y el otro no. Un día partido en el huso
 * equivocado corre todo el gráfico y hace que "hoy" mienta toda la mañana.
 */
function diaTucuman(instante: Date): string {
  return aHoraTucuman(instante).slice(0, 10);
}

/**
 * Los días de la ventana, del más viejo al más nuevo, terminando hoy.
 *
 * La aritmética se hace sobre el **mediodía UTC** de cada día y no sobre las
 * 00:00: restar 24 horas desde el mediodía nunca cruza el borde del día ni
 * aunque en el medio haya un cambio de hora, y acá sólo hace falta contar
 * fechas del calendario, no instantes.
 */
function diasDeLaVentana(dias: number, ahora: Date): string[] {
  const base = new Date(`${diaTucuman(ahora)}T12:00:00.000Z`).getTime();
  const claves: string[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    claves.push(new Date(base - i * 24 * 3600_000).toISOString().slice(0, 10));
  }
  return claves;
}

/**
 * Lo que muestra el tablero.
 *
 * El agrupado de las preguntas sin respuesta es por **texto exacto**, no por
 * significado. Agrupar por significado está fuera de alcance, y decirlo importa:
 * "cuándo abre el registro civil" y "horario del registro civil" van a aparecer
 * como dos filas. Para lo que el tablero tiene que servir —ver qué falta— dos
 * filas parecidas alcanzan; un agrupado semántico mal hecho escondería temas.
 *
 * Todo sale de **un solo `findMany` recorrido una sola vez**. La serie por día,
 * el total de hoy y la tabla de últimas se calculan en ese mismo recorrido: son
 * tres cortes distintos de las mismas filas, y pedirlas tres veces más a la
 * base sería pagar tres viajes para no aprender nada nuevo.
 */
export async function resumenMigue(dias = 30): Promise<ResumenMigue> {
  // La ventana se mide en días enteros, así que un `dias` de 0 o negativo no
  // significa nada: el mínimo es el día de hoy.
  const ventana = Math.max(1, Math.trunc(dias));
  const diasVentana = diasDeLaVentana(ventana, new Date());
  const hoyClave = diasVentana[diasVentana.length - 1];

  // Un punto por día de la ventana, ya en cero. Los días sin ninguna consulta
  // tienen que estar igual: un gráfico de línea al que le faltan días junta los
  // que quedan y miente sobre la forma de la curva —un fin de semana muerto se
  // ve como una meseta en vez de como el pozo que fue—.
  const porDia = new Map(
    diasVentana.map((dia) => [dia, { total: 0, sinRespuesta: 0 }]),
  );

  if (!HAY_BASE) {
    // Sin base la pantalla igual se dibuja: la serie viene con los días en cero
    // y no vacía, así que el gráfico muestra el eje del mes en vez de un hueco
    // que parece un error de la pantalla.
    return {
      total: 0,
      porResultado: {},
      sinRespuesta: [],
      notasConsultadas: [],
      serie: diasVentana.map((dia) => ({ dia, total: 0, sinRespuesta: 0 })),
      hoy: 0,
      ultimas: [],
    };
  }

  // Arranca a las 00:00 **de Tucumán** del día más viejo, no "hace 30×24 horas".
  // Con el corte a la hora exacta el primer día de la serie quedaba partido al
  // medio y el gráfico abría siempre con un pozo que no existió: era medio día
  // de datos dibujado como un día entero.
  //
  // La hora de arranque es la del PRIMER PUNTO de la serie —`diasVentana[0]`,
  // no un día antes—, así que la ventana no se pasa de largo: con 30 puntos
  // entran los 30 días de calendario que van del primero al de hoy, ni 29 ni 31.
  //
  // El `??` es un último recurso que hoy no se alcanza: la cadena la arma
  // `toISOString`, así que siempre pasa el formato que pide `desdeHoraTucuman`.
  // Si algún día se alcanzara traería un puñado de filas del día anterior al
  // primer punto, que el `if (punto)` de abajo deja fuera de la serie.
  const desde =
    desdeHoraTucuman(`${diasVentana[0]}T00:00`) ??
    new Date(Date.now() - ventana * 24 * 3600_000);

  const consultas = await db().consultaMigue.findMany({
    where: { fecha: { gte: desde } },
    orderBy: { fecha: "desc" },
    select: {
      id: true,
      pregunta: true,
      resultado: true,
      notaSlug: true,
      contextoSlug: true,
      fecha: true,
    },
  });

  const porResultado: Record<string, number> = {};
  // El texto va guardado en la misma entrada y no en un Map aparte: recorrer
  // otra vez las miles de filas de la ventana para quedarse con el texto de las
  // pocas decenas sin respuesta era normalizar 4.000 preguntas y llenar 3.000
  // claves para leer 60.
  const sinRespuesta = new Map<
    string,
    { veces: number; ultima: Date; texto: string }
  >();
  const notas = new Map<string, number>();

  for (const c of consultas) {
    // Por la clave NORMALIZADA, igual que `ultimas`. Si acá se contara por el
    // texto crudo de la base, un resultado que la pantalla todavía no conoce
    // abriría su propia clave y el anillo la descartaría en silencio: el número
    // del centro dejaría de coincidir con el total de la cabecera y los
    // porcentajes se calcularían sobre un subconjunto sin avisar. El cajón
    // "otro" tiene que empezar acá o no sirve de nada.
    const clave = resultadoEnTablero(c.resultado);
    porResultado[clave] = (porResultado[clave] ?? 0) + 1;

    // El `if` no sobra: `desde` se calcula antes de la consulta, y si la
    // medianoche de Tucumán cae justo en el medio la fila del día siguiente no
    // tendría casillero. Que no cuente es mejor que que explote.
    const punto = porDia.get(diaTucuman(c.fecha));
    if (punto) {
      punto.total++;
      if (c.resultado === "sin_respuesta") punto.sinRespuesta++;
    }

    if (c.resultado === "sin_respuesta") {
      // La clave normaliza espacios y mayúsculas para que "Horario?" y
      // "horario ?" no cuenten como dos temas distintos. Se guarda el texto tal
      // como lo escribieron, que es lo que hay que leer: el de la primera
      // aparición, que es la más reciente porque vienen ordenadas desc.
      const clave = c.pregunta.trim().toLowerCase().replace(/\s+/g, " ");
      const previo = sinRespuesta.get(clave);
      if (previo) previo.veces++;
      else
        sinRespuesta.set(clave, {
          veces: 1,
          ultima: c.fecha,
          texto: c.pregunta,
        });
    }

    if (c.notaSlug) notas.set(c.notaSlug, (notas.get(c.notaSlug) ?? 0) + 1);
  }

  return {
    total: consultas.length,
    porResultado,
    sinRespuesta: [...sinRespuesta.values()]
      .map((v) => ({
        pregunta: v.texto,
        veces: v.veces,
        ultima: v.ultima.toISOString(),
      }))
      .sort((a, b) => b.veces - a.veces || b.ultima.localeCompare(a.ultima)),
    notasConsultadas: [...notas.entries()]
      .map(([notaSlug, veces]) => ({ notaSlug, veces }))
      .sort((a, b) => b.veces - a.veces),
    serie: diasVentana.map((dia) => {
      const punto = porDia.get(dia);
      return {
        dia,
        total: punto?.total ?? 0,
        sinRespuesta: punto?.sinRespuesta ?? 0,
      };
    }),
    hoy: porDia.get(hoyClave)?.total ?? 0,
    // Ya vienen ordenadas por fecha desc, así que las primeras son las últimas.
    ultimas: consultas.slice(0, TOPE_ULTIMAS).map((c) => ({
      id: c.id,
      pregunta: c.pregunta,
      // Acá estaba `c.resultado as ResultadoConsulta`, que es una afirmación
      // falsa apenas la base trae un caso que este código todavía no conoce
      // —y el esquema promete que eso va a pasar: ver `ResultadoEnTablero`—.
      // Se mapea en vez de afirmar.
      resultado: resultadoEnTablero(c.resultado),
      notaSlug: c.notaSlug,
      contextoSlug: c.contextoSlug,
      fecha: c.fecha.toISOString(),
    })),
  };
}
