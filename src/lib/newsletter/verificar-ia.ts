/**
 * El control de lo que escribe la IA para el newsletter: que no traiga datos
 * que no están en las notas.
 *
 * El prompt ya se lo prohíbe, pero un prompt es un pedido, no una garantía. Un
 * newsletter de la Municipalidad con una fecha o un nombre inventado es
 * información falsa firmada por el Estado, así que lo que se puede comprobar
 * se comprueba:
 *
 * - **Números** (fechas, años, horas, montos, porcentajes, cantidades): cada
 *   uno tiene que aparecer en el texto de las notas.
 * - **Nombres propios** (palabras con mayúscula que no abren una oración):
 *   cada uno tiene que aparecer en las notas, salvo unos pocos que son del
 *   diario mismo.
 *
 * No es infalible —una frase puede ser falsa con palabras que sí están en la
 * nota—, y por eso el borrador siempre lo revisa una persona antes de guardar.
 * Lo que hace es atrapar el error más grave y más común: el dato concreto que
 * el modelo completa de memoria.
 *
 * Puro, sin servidor: se prueba con Node suelto.
 */

/** Sin tildes y en minúscula, para comparar "Tucumán" con "tucuman". */
function plano(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** "15.000", "15000" y "15 000" son el mismo número; "10:30" es una hora. */
function numeros(texto: string): string[] {
  return (texto.match(/\d[\d.,:\s]*\d|\d/g) ?? [])
    .map((n) => n.replace(/[.\s]/g, "").replace(/,$/, ""))
    .filter(Boolean);
}

/** Palabras que pueden ir con mayúscula aunque no estén en la nota: son del
 *  diario o de cómo se escribe un correo. */
const NOMBRES_DEL_DIARIO = new Set(
  [
    "el",
    "la",
    "los",
    "las",
    "sanmiguelino",
    "san",
    "miguel",
    "de",
    "tucuman",
    "municipalidad",
    "diario",
    "edicion",
    "novedades",
    "hola",
    "vecinas",
    "vecinos",
  ].map(plano),
);

/** Las palabras con mayúscula que no abren una oración. */
function nombresPropios(texto: string): string[] {
  const salida: string[] = [];
  // Una palabra abre oración si viene al principio o después de . ! ? : o «
  // (y de un salto de línea).
  const re = /(^|[.!?:¡¿«"\n]\s*|\s)([A-ZÁÉÍÓÚÑ][\p{L}]+)/gu;
  for (const m of texto.matchAll(re)) {
    const antes = m[1];
    const palabra = m[2];
    const abreOracion = antes === "" || /[.!?:¡¿«"\n]/.test(antes);
    if (abreOracion) continue;
    if (NOMBRES_DEL_DIARIO.has(plano(palabra))) continue;
    salida.push(palabra);
  }
  return salida;
}

/**
 * Lo que el texto afirma y las fuentes no respaldan. Vacío = pasó el control.
 */
export function datosSinRespaldo(texto: string, fuentes: string[]): string[] {
  const todo = fuentes.join("\n");
  const numerosDeLaFuente = new Set(numeros(todo));
  const fuentePlana = plano(todo);
  const faltan = new Set<string>();

  for (const n of numeros(texto)) {
    if (!numerosDeLaFuente.has(n)) faltan.add(n);
  }
  for (const nombre of nombresPropios(texto)) {
    if (!fuentePlana.includes(plano(nombre))) faltan.add(nombre);
  }
  return [...faltan];
}

/**
 * Deja sólo el formato que entiende el correo (`**negrita**` y `*cursiva*`):
 * sin títulos de markdown, viñetas, enlaces ni comillas raras alrededor.
 */
export function limpiarTexto(texto: string, tope: number): string {
  const limpio = texto
    .replace(/^#+\s*/gm, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^["'«“]+|["'»”]+$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (limpio.length <= tope) return limpio;
  // Se corta en la última oración que entra, no en el medio de una palabra.
  const corte = limpio.slice(0, tope);
  const fin = Math.max(corte.lastIndexOf(". "), corte.lastIndexOf(".\n"));
  return (fin > tope * 0.5 ? corte.slice(0, fin + 1) : corte).trim();
}

/**
 * El primer objeto JSON de una respuesta. Los modelos a veces lo envuelven en
 * ```json o le agregan una frase antes: se busca la primera llave y su par.
 */
export function leerJson(crudo: string): unknown {
  const inicio = crudo.indexOf("{");
  const fin = crudo.lastIndexOf("}");
  if (inicio < 0 || fin <= inicio) return null;
  try {
    return JSON.parse(crudo.slice(inicio, fin + 1));
  } catch {
    return null;
  }
}
