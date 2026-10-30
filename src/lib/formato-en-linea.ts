/**
 * Negrita y cursiva adentro de un párrafo.
 *
 * Lo pidió la redacción (2026-10-30): no había forma de poner en cursiva el
 * título de una obra —*Bases y puntos de partida*— ni en negrita una palabra.
 * El párrafo sigue siendo texto: el formato se marca con asteriscos, como en
 * un mensaje de WhatsApp o en Markdown, y el editor los pone solos con los
 * botones (nadie tiene que escribirlos a mano).
 *
 * - `**así**` es negrita.
 * - `*así*` es cursiva.
 * - `***así***` son las dos.
 *
 * **Un asterisco suelto no es formato.** El impreso trae notas al pie
 * ("Molina*", "*Doctor en teología…") y tienen que seguir viéndose igual. Por
 * eso una marca sólo abre si NO viene pegada a una letra por la izquierda y
 * va seguida de algo que no es espacio, y sólo cierra si va pegada al texto y
 * no sigue una letra. "Molina*" no abre nada; "*Doctor" abre, pero si no hay
 * un cierre en el mismo párrafo queda tal cual.
 *
 * Puro y sin React: lo usan el diario para dibujar, el editor para la vista
 * previa, y `derivar.ts` para que el buscador y Migue lean el texto sin
 * asteriscos.
 */

export interface Tramo {
  texto: string;
  negrita: boolean;
  cursiva: boolean;
}

/*
 * Una marca: tres, dos o un asterisco, con el contenido adentro.
 * - `(^|[^\p{L}\p{N}*])`: lo que hay antes no es letra, número ni asterisco.
 * - `(?=\S)` … `(?<=\S)`: el contenido no empieza ni termina con espacio.
 * - `[^*\n]+?`: adentro no hay asteriscos ni saltos de línea.
 * - `(?![\p{L}\p{N}*])`: lo que sigue no es letra, número ni asterisco.
 */
const MARCA =
  /(^|[^\p{L}\p{N}*])(\*{1,3})(?=\S)([^*\n]+?)(?<=\S)\2(?![\p{L}\p{N}*])/gu;

/** El texto partido en tramos con su formato. Sin marcas, un solo tramo. */
export function tramosConFormato(texto: string): Tramo[] {
  const tramos: Tramo[] = [];
  let desde = 0;
  for (const m of texto.matchAll(MARCA)) {
    const [entero, antes, marca, adentro] = m;
    const inicio = (m.index ?? 0) + antes.length;
    if (inicio > desde) {
      tramos.push({ texto: texto.slice(desde, inicio), negrita: false, cursiva: false });
    }
    tramos.push({
      texto: adentro,
      negrita: marca.length >= 2,
      cursiva: marca.length !== 2,
    });
    desde = (m.index ?? 0) + entero.length;
  }
  if (desde < texto.length || tramos.length === 0) {
    tramos.push({ texto: texto.slice(desde), negrita: false, cursiva: false });
  }
  return tramos;
}

/** El texto sin las marcas de formato: lo que se busca y lo que lee Migue. */
export function sinFormato(texto: string): string {
  return tramosConFormato(texto)
    .map((t) => t.texto)
    .join("");
}

/**
 * Pone o saca una marca alrededor de una selección de un campo de texto.
 *
 * Devuelve el texto nuevo y dónde queda la selección, para que el editor la
 * vuelva a marcar: así se puede apretar Negrita y después Cursiva sobre las
 * mismas palabras. Si la selección ya está envuelta en esa marca, la saca. Sin
 * selección, deja las marcas con el cursor en el medio para escribir adentro.
 *
 * Los espacios de las puntas quedan afuera: con doble click en una palabra
 * algunos navegadores seleccionan también el espacio de después, y
 * "**palabra **" no cierra.
 */
export function alternarMarca(
  texto: string,
  inicio: number,
  fin: number,
  marca: "**" | "*",
): { texto: string; inicio: number; fin: number } {
  let a = inicio;
  let b = fin;
  while (a < b && /\s/.test(texto[a])) a++;
  while (b > a && /\s/.test(texto[b - 1])) b--;

  const n = marca.length;
  // ¿Ya está marcado? Se cuentan los asteriscos pegados a cada lado: uno o
  // tres tienen cursiva, dos o tres tienen negrita.
  let antes = 0;
  while (texto[a - 1 - antes] === "*") antes++;
  let despues = 0;
  while (texto[b + despues] === "*") despues++;
  const yaEsta =
    n === 1
      ? antes % 2 === 1 && despues % 2 === 1
      : antes >= 2 && despues >= 2;
  if (yaEsta) {
    return {
      texto: texto.slice(0, a - n) + texto.slice(a, b) + texto.slice(b + n),
      inicio: a - n,
      fin: b - n,
    };
  }
  return {
    texto: texto.slice(0, a) + marca + texto.slice(a, b) + marca + texto.slice(b),
    inicio: a + n,
    fin: b + n,
  };
}
