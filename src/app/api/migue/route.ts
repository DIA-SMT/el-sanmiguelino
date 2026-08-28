import { NextResponse, type NextRequest } from "next/server";
import { getUsuario } from "@/lib/auth/session";
import {
  getCompletas,
  getIndice,
  getProximaEdicion,
  getPublicadas,
  getResumenEdicion,
} from "@/lib/repos/edicion";
import { fechaHablada } from "@/lib/fecha-edicion";
import type { NotaCompleta } from "@/lib/types";
import { textoDeBloque } from "@/lib/derivar";
import { registrarConsulta, type ResultadoConsulta } from "@/lib/repos/migue";
import {
  migueTieneModelo,
  preguntarAlModelo,
  type NotaParaElModelo,
} from "@/lib/migue/openrouter";
import {
  ES_SOLO_UN_SALUDO,
  HABLA_DE_OTRA,
  PIDE_EL_INDICE,
  PIDE_AUDIO_DE_OTRA_NOTA,
  PALABRAS_DEL_PEDIDO,
  PIDE_QUE_LE_LEA,
  respuestaSobreElDiario,
  simplificar,
  type SobreElDiario,
} from "@/lib/migue/interpretacion";
import {
  textoDeResumenDeNota,
  textoDeResumenDeTapa,
} from "@/lib/voz/texto-para-escuchar";
import {
  contarConsultaAlModelo,
  limpiarVentanasViejas,
} from "@/lib/migue/tope";

/**
 * Migue.
 *
 * Tres caminos, en este orden:
 *
 * 1. **Saludo e índice** se responden acá, sin modelo. Son deterministas —la
 *    lista de notas es exacta— y así no se paga una llamada por cada "hola".
 * 2. **Todo lo demás va al modelo** (OpenRouter), con las notas de la edición
 *    en el prompt y la orden de no salir de ahí.
 * 3. **Si el modelo no está** —sin clave, caído, lento— se cae al buscador por
 *    palabras clave de siempre. Que Migue conteste peor es mejor que Migue no
 *    conteste.
 *
 * El contrato hacia afuera no cambió nunca: POST { pregunta, notaSlug? } →
 * { respuesta, notaSlug? }.
 */

/**
 * Cuánto texto de la edición se le manda al modelo.
 *
 * Con ocho notas entran todas y Migue puede contestar sobre cualquiera, que es
 * lo que se quiere. El tope existe para el día que la edición crezca: se
 * mandan primero las que más puntaje sacaron, así lo que se recorta es siempre
 * lo menos relacionado con la pregunta.
 */
const TOPE_CONTEXTO = 24_000;


const STOPWORDS = new Set(
  "el la los las un una unos unas de del al a en y o que se su sus por para con sobre es son fue como mas más hay este esta estos estas donde cuando quien cual cuales qué cómo dónde cuándo quién cuál me te le nos".split(
    " ",
  ),
);

function tokenizar(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/[^a-zñ0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function textoDeNota(nota: NotaCompleta): string {
  return [
    nota.titulo,
    nota.bajada,
    ...nota.cuerpo.map(textoDeBloque),
    nota.imagen?.epigrafe ?? "",
  ].join(" ");
}

function mejorParrafo(nota: NotaCompleta, tokens: string[]): string {
  const parrafos = nota.cuerpo.filter((b) => b.tipo === "parrafo");
  let mejor = parrafos[0]?.texto ?? nota.bajada;
  let mejorPuntaje = 0;
  for (const p of parrafos) {
    const propios = new Set(tokenizar(p.texto));
    const puntaje = tokens.filter((t) => propios.has(t)).length;
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = p.texto;
    }
  }
  return mejor;
}

/**
 * Responde y **anota**, en un solo lugar.
 *
 * Antes había cuatro `return NextResponse.json(...)` sueltos. Con el registro,
 * cuatro salidas serían cuatro oportunidades de olvidarse de anotar una, y la
 * que se olvidaría es justo la que importa: el caso "no supe contestar" es el
 * último y el más fácil de pasar por alto.
 */
async function responder(
  resultado: ResultadoConsulta,
  respuesta: string,
  datos: {
    pregunta: string;
    notaSlug?: string;
    contextoSlug?: string;
    /**
     * El texto que el cliente tiene que DECIR en voz alta, si hay alguno.
     *
     * Viaja aparte de `respuesta` porque son dos cosas distintas: `respuesta`
     * es lo que Migue escribe en la burbuja y `leer` es lo que suena. Se
     * parecen pero no son iguales —la burbuja puede decir "te leo el título y
     * la bajada" y la voz decir el título y la bajada—, y sobre todo: la voz
     * la pone el navegador del lector, así que el servidor sólo puede mandar
     * el texto. Nunca audio.
     */
    leer?: string;
  },
) {
  const { leer, ...paraElRegistro } = datos;
  await registrarConsulta({ ...paraElRegistro, resultado });
  return NextResponse.json({ respuesta, notaSlug: datos.notaSlug, leer });
}

export async function POST(request: NextRequest) {
  const usuario = await getUsuario();
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: {
    pregunta?: string;
    notaSlug?: string;
    /** El slug de la ultima nota que Migue cito, que el cliente devuelve para
     *  que un "dame un audio de eso" tenga referente. Se verifica contra la
     *  edicion antes de usarlo: llega del navegador. */
    ultimaNota?: unknown;
    /** Los turnos anteriores del chat, que manda el cliente. */
    historial?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const pregunta = (body.pregunta ?? "").trim();

  /**
   * El hilo de la conversación, saneado.
   *
   * Llega del cliente, así que no se confía: se valida la forma, se descartan
   * los turnos que no la cumplen y se recorta el largo. Es texto que va a
   * entrar en el prompt del modelo, y lo que entra en un prompt tiene que
   * llegar acotado.
   *
   * No se guarda en ningún lado: viaja en el pedido y muere ahí. El registro
   * de consultas sigue siendo una pregunta suelta y anónima.
   */
  const historial = (Array.isArray(body.historial) ? body.historial : [])
    .filter(
      (t): t is { rol: "usuario" | "migue"; texto: string } =>
        typeof t === "object" &&
        t !== null &&
        ((t as { rol?: unknown }).rol === "usuario" ||
          (t as { rol?: unknown }).rol === "migue") &&
        typeof (t as { texto?: unknown }).texto === "string" &&
        (t as { texto: string }).texto.trim() !== "",
    )
    .slice(-12)
    .map((t) => ({ rol: t.rol, texto: t.texto.slice(0, 800) }));
  if (!pregunta) {
    return NextResponse.json({ error: "Falta la pregunta" }, { status: 400 });
  }

  const [edicion, indice, proxima, publicadas] = await Promise.all([
    getResumenEdicion(),
    getIndice(),
    getProximaEdicion(),
    getPublicadas(),
  ]);

  /**
   * Los hechos del diario en sí.
   *
   * Todo sale de la base. Es la regla de siempre —Migue no habla de memoria—
   * aplicada a un tema del que hasta ahora no le pasábamos nada, y por eso a
   * "¿cuándo sale la próxima edición?" contestaba que eso no estaba en la
   * edición de agosto: cierto, y completamente inútil.
   */
  const diario: SobreElDiario = {
    mes: edicion.mes,
    numero: edicion.numero,
    proxima: proxima
      ? { mes: proxima.mes, fecha: fechaHablada(proxima.publicaEn) }
      : undefined,
    archivo: publicadas.filter((e) => e.slug !== edicion.slug).map((e) => e.mes),
  };
  const tokens = tokenizar(pregunta);
  // Lo que miran los atajos: sin tildes y en minúscula. Ver simplificar().
  const simple = simplificar(pregunta);

  /**
   * Los atajos deterministas sólo valen para el PRIMER mensaje.
   *
   * Saltean el modelo, así que por definición no ven la conversación: son la
   * forma más directa de perder el hilo. Y el atajo del índice es de gatillo
   * ancho —"notas", "temas", "trae"—, así que en medio de una charla se comía
   * preguntas que pedían otra cosa y contestaba la lista de siempre.
   *
   * Con un mensaje solo ahorran una llamada y responden mejor que el modelo,
   * porque la lista de notas es exacta. Con conversación encima, todo va al
   * modelo, que es el único que puede saber a qué se refiere un "decime".
   */
  const empezandoDeCero = historial.length === 0;

  // Saludo / smalltalk
  if (empezandoDeCero && ES_SOLO_UN_SALUDO.test(simple)) {
    return responder(
      "saludo",
      `¡Hola, ${usuario.nombre.split(" ")[0]}! Soy Migue 👋. Puedo contarte qué trae la edición de ${edicion.mes} o responder preguntas sobre cualquiera de sus notas. ¿Qué te interesa?`,
      { pregunta, contextoSlug: body.notaSlug },
    );
  }

  // Índice de la edición
  if (
    empezandoDeCero &&
    PIDE_EL_INDICE.some((patron) => patron.test(simple)) &&
    !HABLA_DE_OTRA.test(simple)
  ) {
    const lista = indice.map((n) => `• ${n.titulo} (${n.seccion})`).join("\n");
    return responder(
      "indice",
      `La edición de ${edicion.mes} trae estas notas:\n${lista}\n\nPreguntame por cualquiera y te cuento más.`,
      { pregunta, contextoSlug: body.notaSlug },
    );
  }

  /**
   * "Leeme esto": Migue lee en voz alta la página en la que está parado.
   *
   * **No resume nada.** Dice el título y la bajada tal como los escribió el
   * redactor, que es la decisión de fondo de toda esta función: El Sanmiguelino
   * es una publicación oficial del municipio, y una voz que le lee a un vecino
   * un horario o una dirección que un modelo completó es un riesgo que ningún
   * ahorro justifica. La bajada además ya *es* el resumen —es obligatoria y la
   * aprobó un editor—, así que pedirle a un modelo que resuma lo que ya viene
   * resumido sería pagar plata y latencia para empeorar.
   *
   * Por eso el atajo va ANTES del modelo y ni siquiera cuenta contra el tope de
   * consultas de la hora: no hay nada que preguntarle a nadie.
   *
   * A diferencia del saludo y del índice, este atajo vale también en medio de
   * una charla: ver el comentario de `PIDE_QUE_LE_LEA`.
   *
   * El texto sale de `indice`, que ya está pedido arriba y trae la bajada: no
   * hace falta `getCompletas()` ni una consulta más.
   */
  if (PIDE_QUE_LE_LEA(simple)) {
    const abierta = body.notaSlug
      ? indice.find((n) => n.slug === body.notaSlug)
      : undefined;

    if (abierta) {
      return responder(
        "leer",
        `Te leo el título y la bajada de “${abierta.titulo}”. Tocá de nuevo para que pare.`,
        {
          pregunta,
          notaSlug: abierta.slug,
          contextoSlug: body.notaSlug,
          leer: textoDeResumenDeNota(abierta),
        },
      );
    }

    const principal = indice[0];
    if (principal) {
      return responder("leer", `Te leo la tapa de ${edicion.mes}.`, {
        pregunta,
        contextoSlug: body.notaSlug,
        leer: textoDeResumenDeTapa(edicion, principal),
      });
    }

    // Una edición sin notas cargadas. Pasa en la vista previa de una edición
    // vacía, que ya rompió la portada una vez.
    return responder(
      "leer",
      "Todavía no hay nada cargado en esta edición para leerte.",
      { pregunta, contextoSlug: body.notaSlug },
    );
  }

  /**
   * "Dame un resumen en audio de bacheo": el audio de una nota que NO es la
   * que está mirando.
   *
   * Salió de un caso real en producción, escrito desde la tapa. El pedido de
   * audio estaba, pero la referencia a la página no —y no podía estar, porque
   * la página era la tapa y la nota era otra—, así que el atajo de arriba no
   * disparaba y Migue contestaba por escrito que eso no lo tenía.
   *
   * **Si no hay una nota claramente mejor que las demás, NO lee y deja pasar al
   * modelo.** Leerle en voz alta la nota equivocada es peor que contestarle
   * bien por escrito: en pantalla un desacierto se ve de un vistazo, hablado
   * hay que escucharlo entero para darse cuenta.
   *
   * "Claramente" son dos condiciones, y las dos hacen falta: que la mejor
   * puntúe, y que puntúe MÁS que la segunda. Con un empate no hay forma de
   * saber a cuál se refería —"la nota de la plaza" con dos notas sobre plazas—
   * y elegir la primera sería elegir por orden de carga.
   *
   * Se busca sobre el índice, que ya está pedido arriba y trae titular y
   * bajada. No hace falta `getCompletas()`: quien pide "el audio de bacheo"
   * nombra el tema como lo nombra el titular, no con una palabra enterrada en
   * el séptimo párrafo.
   */
  if (PIDE_AUDIO_DE_OTRA_NOTA(simple)) {
    // Sin las palabras del pedido, lo que queda es el tema. Ver el comentario
    // de PALABRAS_DEL_PEDIDO: sin esto "resumen" y "audio" puntúan contra la
    // nota que habla de Migue y se llevan el desempate.
    const delTema = tokens.filter((t) => !PALABRAS_DEL_PEDIDO.has(t));

    if (delTema.length > 0) {
      /*
       * El titular pesa el triple que la bajada, y ese peso es lo que hace
       * utilizable a la regla del desempate.
       *
       * Sin él, "la nota sobre el transporte" empataba: una nota lo lleva en el
       * titular y otra —la del bacheo— menciona "los corredores del transporte
       * público" en su bajada, al pasar. Con las dos en uno, no había ganador
       * claro y Migue no leía nada, que es correcto pero inútil: para quien
       * pregunta, una de las dos es obviamente la nota "del transporte".
       *
       * El titular dice de qué ES la nota; la bajada puede nombrar cualquier
       * cosa que la nota toque. Tres es suficiente para que un titular le gane
       * a una mención y poco para que le gane a otro titular.
       */
      const puntuadas = indice
        .map((n) => {
          const enTitulo = new Set(tokenizar(n.titulo));
          const enResto = new Set(tokenizar(`${n.bajada} ${n.seccion}`));
          const puntaje = delTema.reduce(
            (t, palabra) =>
              t + (enTitulo.has(palabra) ? 3 : enResto.has(palabra) ? 1 : 0),
            0,
          );
          return { nota: n, puntaje };
        })
        .sort((a, b) => b.puntaje - a.puntaje);

      const mejor = puntuadas[0];
      const segunda = puntuadas[1];
      if (mejor && mejor.puntaje > 0 && mejor.puntaje > (segunda?.puntaje ?? 0)) {
        return responder(
          "leer",
          `Te leo el título y la bajada de “${mejor.nota.titulo}”. Tocá de nuevo para que pare.`,
          {
            pregunta,
            notaSlug: mejor.nota.slug,
            contextoSlug: body.notaSlug,
            leer: textoDeResumenDeNota(mejor.nota),
          },
        );
      }
    }
    /**
     * "Me interesa eso, dame un resumen en audio": el referente está en la
     * conversación, no en el mensaje.
     *
     * Salió de producción, y es la forma en que la gente habla de verdad: se
     * pregunta por el bacheo, Migue contesta, y el pedido de audio dice "eso".
     * Sin esto Migue respondía por escrito que eso no lo tenía, con la nota
     * recién nombrada dos burbujas más arriba.
     *
     * **Es la única concesión de los atajos de la voz al hilo de la charla**, y
     * se puede hacer sin adivinar nada porque no se interpreta la conversación:
     * el cliente devuelve el `notaSlug` que esta misma ruta le mandó en el turno
     * anterior, y acá se verifica contra la edición. Lo que llega del navegador
     * no se cree, se comprueba.
     *
     * Va DESPUÉS de buscar por tema: si el mensaje nombra una nota, esa gana.
     * "Dame un audio de la peatonal" en medio de una charla sobre el bacheo
     * tiene que leer la peatonal.
     */
    const ultima =
      typeof body.ultimaNota === "string"
        ? indice.find((n) => n.slug === body.ultimaNota)
        : undefined;
    if (ultima) {
      return responder(
        "leer",
        `Te leo el título y la bajada de “${ultima.titulo}”. Tocá de nuevo para que pare.`,
        {
          pregunta,
          notaSlug: ultima.slug,
          contextoSlug: body.notaSlug,
          leer: textoDeResumenDeNota(ultima),
        },
      );
    }

    // Sin tema claro y sin nota en el hilo se sigue de largo a propósito:
    // contesta el modelo, que puede preguntar a cuál se refería. Un `return`
    // acá sería un "no sé qué leerte" que corta la conversación en vez de
    // continuarla.
  }

  // Recuperación por puntaje sobre todas las notas (con leve sesgo a la nota abierta)
  // Migue busca sobre el cuerpo de todas: acá sí hace falta la edición entera.
  const completas = await getCompletas(indice.map((n) => n.slug));
  const notaAbierta = body.notaSlug
    ? (completas.find((n) => n.slug === body.notaSlug) ?? null)
    : null;
  let mejorNota: NotaCompleta | null = null;
  let mejorPuntaje = 0;
  for (const nota of completas) {
    const propios = new Set(tokenizar(textoDeNota(nota)));
    let puntaje = tokens.filter((t) => propios.has(t)).length;
    if (notaAbierta && nota.slug === notaAbierta.slug) puntaje += 1;
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejorNota = nota;
    }
  }

  // --- El modelo -----------------------------------------------------------
  //
  // El tope se cuenta ANTES de armar el contexto: si ya se pasó, no tiene
  // sentido recorrer la edición entera para un prompt que no se va a mandar.
  const tope = migueTieneModelo()
    ? await contarConsultaAlModelo(usuario.id)
    : { permitido: false };

  if (migueTieneModelo() && tope.permitido) {
    // Se ordenan por puntaje y se manda todo lo que entre en el tope: el
    // modelo elige mejor que nuestro puntaje, pero el puntaje sirve para
    // decidir QUÉ recortar si no entra todo.
    const puntuadas = completas
      .map((n) => {
        const propios = new Set(tokenizar(textoDeNota(n)));
        return { nota: n, puntaje: tokens.filter((t) => propios.has(t)).length };
      })
      .sort((a, b) => b.puntaje - a.puntaje);

    const paraElModelo: NotaParaElModelo[] = [];
    let usado = 0;
    for (const { nota } of puntuadas) {
      const texto = textoDeNota(nota);
      if (usado + texto.length > TOPE_CONTEXTO && paraElModelo.length >= 3) break;
      usado += texto.length;
      paraElModelo.push({
        slug: nota.slug,
        titulo: nota.titulo,
        seccion: nota.seccion,
        texto,
      });
    }

    const delModelo = await preguntarAlModelo({
      pregunta,
      notas: paraElModelo,
      diario,
      // Para que "resumime esta página" tenga a qué referirse.
      abierta: notaAbierta
        ? { slug: notaAbierta.slug, titulo: notaAbierta.titulo }
        : null,
      nombreUsuario: usuario.nombre.split(" ")[0],
      historial,
    });

    if (delModelo) {
      // El slug que dice el modelo se verifica contra la edición: si se lo
      // inventó o citó uno viejo, se descarta. Un enlace a una nota que no
      // existe es peor que no enlazar.
      const slugValido =
        delModelo.notaSlug &&
        indice.some((n) => n.slug === delModelo.notaSlug)
          ? delModelo.notaSlug
          : undefined;

      /**
       * La charla se anota como saludo, que es lo único que el tablero NO
       * cuenta como pregunta. El prompt nuevo invita a conversar, y sin esto
       * cada "gracias" y cada "escuchame" entraba como pregunta respondida e
       * inflaba la cobertura.
       */
      const resultado = delModelo.sinRespuesta
        ? "sin_respuesta"
        : delModelo.charla
          ? "saludo"
          : "nota";

      return responder(resultado, delModelo.texto, {
        pregunta,
        notaSlug: slugValido,
        contextoSlug: body.notaSlug,
      });
    }
    // Si devolvió null seguimos al buscador de abajo, a propósito.
  }

  // Llegar acá con el modelo configurado significa una de dos: OpenRouter no
  // respondió, o se alcanzó el tope de la hora. En los dos casos Migue sigue
  // contestando con el buscador: un asistente que se planta y dice "no puedo
  // atenderte" es peor que uno que contesta un poco peor, y el vecino no tiene
  // por qué enterarse de nuestros costos.
  void limpiarVentanasViejas();

  // --- Sin modelo: el buscador por palabras clave ---------------------------
  //
  // Las preguntas sobre el diario mismo se contestan igual acá. Sin esto, el
  // día que se llene el cupo de la hora "¿cuándo sale la próxima?" vuelve a
  // recibir "no encontré nada en la edición de agosto", que es justo la
  // respuesta que hubo que arreglar.
  if (!mejorNota || mejorPuntaje < 2) {
    // Antes de darse por vencido: ¿preguntaban por el diario mismo?
    const sobreElDiario = respuestaSobreElDiario(simple, diario);
    if (sobreElDiario) {
      return responder("diario", sobreElDiario, {
        pregunta,
        contextoSlug: body.notaSlug,
      });
    }

    // La salida que le da sentido al registro entero: cada una de estas es
    // un tema que los vecinos buscan y el diario no cubre.
    return responder(
      "sin_respuesta",
      `Sobre eso no encontré nada en la edición de ${edicion.mes}. Puedo ayudarte con lo que sí está publicado: preguntame, por ejemplo, "¿qué notas trae esta edición?".`,
      { pregunta, contextoSlug: body.notaSlug },
    );
  }

  const extracto = mejorParrafo(mejorNota, tokens);
  return responder(
    "nota",
    `Según la nota “${mejorNota.titulo}” (${mejorNota.seccion}):\n\n${extracto}`,
    { pregunta, notaSlug: mejorNota.slug, contextoSlug: body.notaSlug },
  );
}
