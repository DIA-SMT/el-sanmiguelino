import type { BloqueNota } from "@/lib/types";
import { pegarTextos, type LineaExpuesta } from "./estructura.ts";

/**
 * Armar la estructura de una página mirándola, en vez de deducirla por reglas.
 *
 * **Por qué existe.** La heurística de `estructura.ts` decide qué es cada cosa
 * por geometría y tipografía: tamaño, negrita, columna, interlineado. Con una
 * página de prosa a tres columnas eso alcanza y sobra. Con un recuadro que
 * tiene DOS columnas propias adentro de esas tres, no: en la página 5 de agosto
 * el recuadro «Ocho plazas, ocho formas de construir comunidad» salió partido en
 * dos mitades desiguales. Las cuatro plazas de la columna derecha quedaron
 * perfectas —encabezado y texto alternados— y las cuatro de la izquierda
 * quedaron con sus encabezados apilados uno tras otro y sus descripciones
 * fundidas en un solo párrafo de 1.053 caracteres.
 *
 * Eso no es feo, es incorrecto: en ese párrafo conviven los 3.640 m² de Las
 * Américas, las 450 especies de Lucio Dupuy, el mural de Maradona de
 * Convivencia y el Punto de Lectura de Azopardo, sin nada que diga cuál es de
 * cuál. Una publicación oficial no puede atribuir mal un dato.
 *
 * Se podría escribir una regla más —detectar recuadros y tratarlos como una
 * grilla aparte— y sería la enésima: cada maqueta nueva trae un caso nuevo y el
 * conversor se vuelve una pila de excepciones que nadie sostiene. Un modelo que
 * MIRA la página ve lo que ve una persona en dos segundos: que eso es una lista
 * de ocho plazas y que cada texto pertenece a su encabezado.
 *
 * **La regla que hace esto seguro: el modelo no escribe una sola palabra.**
 *
 * Recibe las líneas numeradas y devuelve NÚMEROS DE LÍNEA. El texto se arma acá
 * concatenando esas líneas con la misma función que usa la heurística. Es
 * imposible que invente un dato, un metro cuadrado o un nombre: no tiene por
 * dónde. Lo único que decide es el orden y qué es cada cosa.
 *
 * Y no puede perder nada: se comprueba que **cada línea** termine en un bloque y
 * que ninguna aparezca dos veces. Si algo no cierra, se descarta la respuesta
 * entera y la página se arma con la heurística de siempre. Ante la duda, lo de
 * antes.
 *
 * **No hay un cajón de descarte, y eso es deliberado.** La primera versión le
 * daba al modelo una lista «mueblería» donde poner lo que sobraba, y ahí se fue
 * contenido real: en la página 8 mandó a ese cajón «También se crearán:», «una
 * pista de skate;» y «un canil equipado;». El reparto seguía siendo exhaustivo
 * —todas las líneas tenían destino— así que el control lo daba por bueno y el
 * texto no llegaba a la nota. Las líneas que entran acá ya vienen sin la
 * mueblería del impreso, filtrada por `lineasDePagina`: todo lo que llega es
 * contenido y tiene que salir en algún bloque.
 *
 * Es puro: no importa `server-only` ni el cliente HTTP. Quien llama le pasa una
 * función para hablar con el modelo, así el mismo código sirve en el script de
 * consola y en el servidor, y se puede probar sin gastar una llamada.
 */

/** Lo que el modelo tiene que devolver, en números de línea. */
export interface MaquetaPropuesta {
  titulo: number[];
  bajada: number[];
  bloques: BloquePropuesto[];
}

export type BloquePropuesto =
  | { tipo: "parrafo" | "subtitulo" | "destacado"; lineas: number[] }
  | { tipo: "cita"; lineas: number[]; autor: number[]; cargo?: number[] }
  | { tipo: "lista"; items: number[][]; titulo?: number[] }
  | {
      tipo: "ficha";
      titulo: number[];
      entradas: { lead: number[]; texto: number[] }[];
    };

export interface ResultadoMaqueta {
  ok: boolean;
  /** Los bloques ya armados, con el texto sacado de las líneas. */
  cuerpo?: BloqueNota[];
  titulo?: string;
  bajada?: string;
  descartado?: string[];
  /** Por qué no se pudo usar la respuesta del modelo. Va al informe: un
   *  rechazo silencioso es indistinguible de que el modelo no se llamó. */
  motivo?: string;
}

/** El modelo puede devolver `null` en un campo opcional aunque el contrato
 * pida un arreglo. Se valida antes de usar spreads o `for...of`: un JSON
 * defectuoso tiene que activar el segundo intento, nunca tumbar la acción. */
function validarForma(m: MaquetaPropuesta): string | null {
  const ids = (valor: unknown, nombre: string): string | null => {
    if (!Array.isArray(valor)) return `${nombre} no es un arreglo`;
    if (valor.some((i) => !Number.isInteger(i))) return `${nombre} contiene un id inválido`;
    return null;
  };
  for (const [nombre, valor] of [["titulo", m.titulo], ["bajada", m.bajada]] as const) {
    const error = ids(valor, nombre);
    if (error) return error;
  }
  if (!Array.isArray(m.bloques)) return "faltan los bloques";
  for (const [i, bloque] of m.bloques.entries()) {
    if (!bloque || typeof bloque !== "object" || typeof bloque.tipo !== "string") {
      return `el bloque ${i + 1} no tiene tipo`;
    }
    if (bloque.tipo === "ficha") {
      const error = ids(bloque.titulo, `bloques[${i}].titulo`);
      if (error) return error;
      if (!Array.isArray(bloque.entradas)) return `bloques[${i}].entradas no es un arreglo`;
      for (const [j, entrada] of bloque.entradas.entries()) {
        if (!entrada || typeof entrada !== "object") return `bloques[${i}].entradas[${j}] inválida`;
        for (const campo of ["lead", "texto"] as const) {
          const error = ids(entrada[campo], `bloques[${i}].entradas[${j}].${campo}`);
          if (error) return error;
        }
      }
      continue;
    }
    if (bloque.tipo === "lista") {
      if (!Array.isArray(bloque.items)) return `bloques[${i}].items no es un arreglo`;
      if (bloque.titulo !== undefined) {
        const error = ids(bloque.titulo, `bloques[${i}].titulo`);
        if (error) return error;
      }
      for (const [j, item] of bloque.items.entries()) {
        const error = ids(item, `bloques[${i}].items[${j}]`);
        if (error) return error;
      }
      continue;
    }
    if (bloque.tipo === "cita") {
      for (const campo of ["lineas", "autor"] as const) {
        const error = ids(bloque[campo], `bloques[${i}].${campo}`);
        if (error) return error;
      }
      if (bloque.cargo !== undefined) {
        const error = ids(bloque.cargo, `bloques[${i}].cargo`);
        if (error) return error;
      }
      continue;
    }
    if (!["parrafo", "subtitulo", "destacado"].includes(bloque.tipo)) {
      return `tipo de bloque desconocido: ${bloque.tipo}`;
    }
    const error = ids(bloque.lineas, `bloques[${i}].lineas`);
    if (error) return error;
  }
  return null;
}

/** Quita null de campos opcionales antes de validar. JSON permite representar
 * un campo ausente como null, pero el resto del conversor trabaja con arreglos
 * reales. Los IDs siguen pasando por `validarForma`, así que esto no puede
 * ocultar una línea perdida. */
function normalizarOpcionales(m: MaquetaPropuesta): MaquetaPropuesta {
  return {
    ...m,
    bloques: Array.isArray(m.bloques)
      ? m.bloques.map((bloque) => {
          if (!bloque || typeof bloque !== "object") return bloque;
          if (bloque.tipo === "ficha" && bloque.titulo == null) {
            return { ...bloque, titulo: [] };
          }
          if (bloque.tipo === "lista" && bloque.titulo == null) {
            const { titulo: _titulo, ...sinTitulo } = bloque;
            return sinTitulo;
          }
          if (bloque.tipo === "cita" && bloque.cargo == null) {
            const { cargo: _cargo, ...sinCargo } = bloque;
            return sinCargo;
          }
          return bloque;
        })
      : m.bloques,
  };
}

/** Cómo se le habla al modelo. Lo pone quien llama. */
export type Consulta = (peticion: {
  instrucciones: string;
  pedido: string;
  imagenBase64: string;
}) => Promise<string>;

/**
 * Lo que se le pide, y lo que NO se le pide.
 *
 * No se le pide que escriba, que resuma, que corrija ni que mejore nada. Se le
 * pide que reparta líneas. Todo lo que no sea un número de línea en la
 * respuesta se ignora.
 */
const INSTRUCCIONES = `
Sos el maquetador de un diario municipal. Te doy la IMAGEN de una página del
impreso y la lista NUMERADA de sus líneas de texto, con la posición de cada una.

Tu trabajo es decir qué es cada línea y en qué orden se lee, devolviendo SOLO
NÚMEROS DE LÍNEA. No escribas texto de la nota: no te lo voy a leer. El texto lo
armo yo con las líneas que me indiques.

Mirá la imagen para entender la maqueta. Es lo que la geometría sola no alcanza
a resolver: un recuadro de datos puede tener DOS columnas propias adentro de una
página de tres, y entonces un encabezado y su descripción quedan lejos en
coordenadas y pegados en la página.

Devolvé un JSON con esta forma exacta:

{
  "titulo": [n],
  "bajada": [n, ...],
  "bloques": [
    {"tipo": "parrafo", "lineas": [n, ...]},
    {"tipo": "subtitulo", "lineas": [n, ...]},
    {"tipo": "destacado", "lineas": [n, ...]},
    {"tipo": "cita", "lineas": [n, ...], "autor": [n], "cargo": [n]},
    {"tipo": "ficha", "titulo": [n], "entradas": [{"lead": [n], "texto": [n, ...]}]},
    {"tipo": "lista", "items": [[n], [n], [n, n]], "titulo": [n]}
  ]
}

Reglas:
- Emití JSON compacto, sin sangría ni explicación alrededor. Cuando un campo
  opcional no corresponda, omitilo: no uses null.
- CADA línea tiene que aparecer exactamente una vez: en el título, en la bajada
  o en un bloque. Ninguna dos veces y NINGUNA AFUERA.
- No hay dónde descartar. Las líneas que te paso ya vienen limpias: el folio, el
  cabezal y el sello del impreso se sacaron antes. Todo lo que te llega es
  contenido de la nota y tiene que aparecer en la salida. Si algo te parece
  sobrante, es un epígrafe o un dato suelto: ponelo como párrafo al final antes
  que dejarlo afuera.
- Un RECUADRO DE DATOS —un marco con un título y varias entradas, cada una con
  su encabezado EN NEGRITA y su descripción— es UNA ficha con todas sus
  entradas, aunque en el papel esté en dos columnas. Es el caso que más importa.
- UNA ENUMERACIÓN es "lista": ítems cortos, uno por renglón, sin una
  descripción propia. En la página 4 del impreso, al costado del mapa, están los
  nombres de las 67 plazas uno debajo del otro: eso es una lista de 67 ítems, no
  un párrafo. Cada ítem es un arreglo de líneas, porque un nombre largo puede
  ocupar dos renglones. El "titulo" es opcional y va sólo si la lista lo tiene
  impreso encima.
- UNA LISTA CON VIÑETAS NO ES UNA FICHA: es "lista". Si los ítems empiezan con •
  o con un guión y no tienen un encabezado en negrita propio, cada ítem es un
  ítem de la lista. Una entrada de ficha se reconoce porque su encabezado está
  en negrita y termina en dos puntos, no porque el ítem ocupe dos renglones.
- NUNCA partas un ítem en encabezado y descripción por dónde cae el corte del
  renglón. Si al hacerlo te queda una palabra cortada al medio —«la restauración
  de los monu» / «mentos a Jorge Luis Borges»— es la señal de que no era una
  entrada de ficha: era un párrafo.
- El orden de "bloques" es el orden en que se lee la nota.
- CADA PÁRRAFO DEL IMPRESO ES UN BLOQUE. No juntes en uno solo dos párrafos que
  en el papel están separados: se reconocen por la sangría de la primera línea o
  por el espacio entre ellos. Una nota de seis párrafos tiene que devolver seis
  bloques "parrafo", no uno con todo adentro. Es el error más fácil de cometer
  acá y el que más se nota al leer.
- Si una cita no tiene autor visible, no la marques como cita: es un destacado.
`.trim();

/** Arma el texto de una lista de líneas, con la misma unión que la heurística:
 *  resuelve el corte de palabra al final del renglón. */
function textoDe(lineas: LineaExpuesta[], ids: number[]): string {
  const porId = new Map(lineas.map((l) => [l.i, l]));
  let texto = "";
  for (const id of ids) {
    const l = porId.get(id);
    if (!l) continue;
    texto = texto ? pegarTextos(texto, l.texto) : l.texto.trim();
  }
  return texto.trim();
}

/** El texto de un bloque ya armado. Para el control final: hay que poder
 *  comparar lo que salió contra lo que entró. */
function textoDeBloqueArmado(b: BloqueNota): string {
  if (b.tipo === "ficha") {
    return b.titulo + " " + b.entradas.map((e) => e.lead + " " + e.texto).join(" ");
  }
  if (b.tipo === "cita") {
    return [b.texto, b.autor, b.cargo].filter(Boolean).join(" ");
  }
  if (b.tipo === "foto") return [b.alt, b.epigrafe].filter(Boolean).join(" ");
  if (b.tipo === "lista") {
    return [b.titulo, ...b.items].filter(Boolean).join(" ");
  }
  return b.texto;
}

/** Todos los números de línea que usa una maqueta, en orden de aparición. */
function idsDe(m: MaquetaPropuesta): number[] {
  const ids: number[] = [...m.titulo, ...m.bajada];
  for (const b of m.bloques) {
    if (b.tipo === "ficha") {
      ids.push(...b.titulo);
      for (const e of b.entradas) ids.push(...e.lead, ...e.texto);
    } else if (b.tipo === "lista") {
      ids.push(...(b.titulo ?? []));
      for (const item of b.items) ids.push(...item);
    } else if (b.tipo === "cita") {
      ids.push(...b.lineas, ...b.autor, ...(b.cargo ?? []));
    } else {
      ids.push(...b.lineas);
    }
  }
  return ids;
}

/**
 * El control de fidelidad. **Es la mitad que hace usable a la otra.**
 *
 * Sin esto, un modelo que se saltea tres líneas produce una nota a la que le
 * falta un dato y nadie se entera hasta que un vecino lo nota. Con esto, lo
 * peor que puede pasar es que la página se arme como se armaba antes.
 */
function revisar(
  m: MaquetaPropuesta,
  lineas: LineaExpuesta[],
): string | null {
  const usados = idsDe(m);
  const existentes = new Set(lineas.map((l) => l.i));

  const inventados = usados.filter((i) => !existentes.has(i));
  if (inventados.length) {
    return `devolvió líneas que no existen: ${inventados.slice(0, 5).join(", ")}`;
  }

  const vistos = new Set<number>();
  const repetidos = usados.filter((i) => (vistos.has(i) ? true : (vistos.add(i), false)));
  if (repetidos.length) {
    return `repitió líneas: ${[...new Set(repetidos)].slice(0, 5).join(", ")}`;
  }

  const faltan = lineas.filter((l) => !vistos.has(l.i));
  if (faltan.length) {
    return `dejó ${faltan.length} líneas sin destino: ${faltan
      .map((l) => `${l.i} ("${l.texto.slice(0, 60)}")`)
      .join(", ")}`;
  }

  if (!m.titulo.length) return "no marcó ningún título";
  return null;
}

/** Saca el JSON de la respuesta, tolerando que venga en un bloque de código. */
function comoJson(crudo: string): unknown {
  const limpio = crudo
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const abre = limpio.indexOf("{");
  const cierra = limpio.lastIndexOf("}");
  if (abre === -1 || cierra <= abre) throw new Error("no vino un objeto JSON");
  return JSON.parse(limpio.slice(abre, cierra + 1));
}

/**
 * Arma la maqueta de una página con el modelo.
 *
 * Nunca tira: cualquier problema —el modelo no contesta, contesta cualquier
 * cosa, se saltea líneas— vuelve `ok: false` con el motivo, y quien llama sigue
 * con la heurística.
 */
export async function maquetarConModelo(opciones: {
  lineas: LineaExpuesta[];
  imagenBase64: string;
  pagina: number;
  consultar: Consulta;
}): Promise<ResultadoMaqueta> {
  const { lineas, imagenBase64, pagina, consultar } = opciones;

  if (lineas.length === 0) return { ok: false, motivo: "la página no tiene texto" };

  const pedido =
    `PÁGINA ${pagina}. Sus ${lineas.length} líneas, numeradas:\n\n` +
    lineas
      .map(
        (l) =>
          `${l.i}\t[col ${l.columna} x${l.x} y${l.y} ${l.tam}pt${l.negrita ? " negrita" : ""}]\t${l.texto}`,
      )
      .join("\n");

  /*
   * Se intenta dos veces, y la segunda con el error en la mano.
   *
   * Los rechazos que aparecieron en agosto no son del tipo «el modelo no
   * entiende la página»: son un número repetido o una línea que quedó sin
   * destino en un reparto de ciento veinte. Repetir el mismo pedido no
   * arreglaría nada —la temperatura es cero— pero decirle exactamente qué
   * estuvo mal sí: es un error de contabilidad y se corrige mirándolo.
   *
   * Dos y no más. Si a la segunda tampoco cierra, la página se arma con la
   * heurística: no vale la pena insistirle a costa de la carga.
   */
  let crudo = "";
  let maqueta: MaquetaPropuesta | null = null;
  let ultimoMotivo = "";

  for (let intento = 1; intento <= 2 && !maqueta; intento++) {
    const correccion =
      intento === 1
        ? ""
        : `

Tu respuesta anterior no se pudo usar: ${ultimoMotivo}.
` +
          "Devolvé el reparto completo de nuevo, corrigiendo eso. Cada línea " +
          "exactamente una vez, ninguna afuera. Incluí también fechas, años y rótulos.\n" +
          "Este fue el JSON anterior que debés corregir:\n" + crudo;
    try {
      crudo = await consultar({
        instrucciones: INSTRUCCIONES,
        pedido: pedido + correccion,
        imagenBase64,
      });
    } catch (e) {
      return { ok: false, motivo: e instanceof Error ? e.message : "falló la consulta" };
    }

    try {
      const propuesta = normalizarOpcionales(comoJson(crudo) as MaquetaPropuesta);
      if (!Array.isArray(propuesta.bloques)) throw new Error("faltan los bloques");
      propuesta.titulo ??= [];
      propuesta.bajada ??= [];
      const forma = validarForma(propuesta);
      if (forma) {
        ultimoMotivo = forma;
        continue;
      }
      const problema = revisar(propuesta, lineas);
      if (problema) {
        ultimoMotivo = problema;
        continue;
      }
      maqueta = propuesta;
    } catch (e) {
      ultimoMotivo = `respuesta ilegible: ${e instanceof Error ? e.message : e}`;
    }
  }

  if (!maqueta) return { ok: false, motivo: ultimoMotivo || "no se pudo maquetar" };

  /* De números de línea a bloques de verdad. Acá es donde el texto entra, y
     entra desde las líneas: el modelo nunca lo tocó. */
  const cuerpo: BloqueNota[] = [];
  for (const b of maqueta.bloques) {
    if (b.tipo === "ficha") {
      const armadas = b.entradas.map((e) => ({
        lead: textoDe(lineas, e.lead),
        texto: textoDe(lineas, e.texto),
      }));
      /*
       * Una entrada a la que le falta el encabezado o la descripción no sirve
       * como entrada de ficha —el tipo pide las dos— pero su texto NO se tira:
       * sale como párrafo.
       *
       * Descartarla en silencio fue una pérdida real: en la página 8 se fueron
       * así «una pista de skate;» y «un canil equipado;», dos ítems de una
       * lista que el modelo mandó sin encabezado. El reparto de líneas seguía
       * siendo perfecto, así que el control no veía nada.
       */
      const entradas = armadas.filter((e) => e.lead && e.texto);
      for (const suelta of armadas) {
        if (suelta.lead && suelta.texto) continue;
        const texto = suelta.lead || suelta.texto;
        if (texto) cuerpo.push({ tipo: "parrafo", texto });
      }
      if (!entradas.length) continue;
      cuerpo.push({
        tipo: "ficha",
        titulo: textoDe(lineas, b.titulo) || "Datos",
        entradas,
      });
      continue;
    }
    if (b.tipo === "lista") {
      const items = b.items
        .map((ids) => textoDe(lineas, ids))
        .filter(Boolean);
      if (!items.length) continue;
      const titulo = b.titulo ? textoDe(lineas, b.titulo) : "";
      cuerpo.push({ tipo: "lista", items, ...(titulo ? { titulo } : {}) });
      continue;
    }
    if (b.tipo === "cita") {
      const texto = textoDe(lineas, b.lineas);
      const autor = textoDe(lineas, b.autor);
      if (!texto) continue;
      // Sin autor no es una cita: el repo no publica citas anónimas.
      if (!autor) {
        cuerpo.push({ tipo: "destacado", texto });
        continue;
      }
      const cargo = b.cargo ? textoDe(lineas, b.cargo) : "";
      cuerpo.push({ tipo: "cita", texto, autor, ...(cargo ? { cargo } : {}) });
      continue;
    }
    const texto = textoDe(lineas, b.lineas);
    if (texto) cuerpo.push({ tipo: b.tipo, texto });
  }

  if (!cuerpo.length) return { ok: false, motivo: "no armó ningún bloque" };

  const titulo = textoDe(lineas, maqueta.titulo);
  const bajada = textoDe(lineas, maqueta.bajada);

  /*
   * El control final, y el único que de verdad garantiza algo: **que el texto
   * de cada línea esté en el resultado**.
   *
   * El control de más arriba mira el reparto de números, y con eso alcanza para
   * atrapar lo que el modelo inventa o repite. Pero no ve lo que se pierde
   * DESPUÉS, al armar los bloques: una entrada de ficha incompleta, un bloque
   * vacío, cualquier camino que descarte en silencio. Dos veces ya se escapó
   * contenido por ahí.
   *
   * Comparar sin espacios ni acentos es la única forma fiel: el PDF corta
   * palabras al final del renglón y la unión las vuelve a pegar, así que
   * «alre» + «dedor» tiene que contar como «alrededor».
   */
  const compacto = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ]/g, "");

  const publicado = compacto(
    [titulo, bajada, ...cuerpo.map(textoDeBloqueArmado)].join(" "),
  );
  const perdidas = lineas.filter((l) => {
    const c = compacto(l.texto);
    return c.length >= 4 && !publicado.includes(c);
  });
  if (perdidas.length) {
    return {
      ok: false,
      motivo: `el texto de ${perdidas.length} líneas no llegó al resultado: ${perdidas
        .slice(0, 3)
        .map((l) => `"${l.texto.slice(0, 34)}"`)
        .join(", ")}`,
    };
  }

  return { ok: true, cuerpo, titulo, bajada };
}
