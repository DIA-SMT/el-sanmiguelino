/**
 * El nombre de una persona, escrito como lo escribiría un diario.
 *
 * Cidituc devuelve los nombres en MAYÚSCULAS —"ALFREDO AGUSTIN BRITO"—, y ese
 * nombre se muestra al pie de los comentarios y en la cabecera. En un diario una
 * firma en mayúsculas se lee como si gritara: el impreso no firma así ninguna
 * nota, y la web no tiene por qué ser la excepción.
 *
 * Lo que este módulo **no** puede hacer: devolver las tildes. Cidituc mandó
 * "AGUSTIN" sin tilde, y de ahí no sale "Agustín" sin inventar. Se arregla en el
 * origen o no se arregla.
 *
 * Es puro y sin imports a propósito: `scripts/verificar-cidituc.mjs` corre esta
 * misma función, no una copia.
 */

/**
 * Partículas que van en minúscula cuando no abren el nombre.
 *
 * "San" **no** está y no es un olvido: en "San Martín" no es una partícula, es
 * parte del apellido. Lo mismo "Santa" y "Santo".
 */
const PARTICULAS = new Set([
  "de", "del", "la", "las", "el", "los", "y", "e",
  "da", "das", "do", "dos",
  "di", "du", "van", "von", "der", "den", "bin", "ibn",
]);

/** Los separadores que hay adentro de un nombre y que no son un espacio. */
const SEPARADORES = /([\s'’-]+)/u;

function capitalizar(palabra: string): string {
  if (!palabra) return palabra;
  // `toLocaleUpperCase` y no `toUpperCase`: con nombres acentuados y con ñ el
  // resultado es el mismo, pero la intención queda escrita.
  return palabra[0].toLocaleUpperCase("es") + palabra.slice(1).toLocaleLowerCase("es");
}

/**
 * ¿Viene todo en un solo caso?
 *
 * Si el nombre trae mayúsculas Y minúsculas, alguien —o algún sistema— ya decidió
 * cómo se escribe, y no lo tocamos: es lo que evita que un "de la Vega" bien
 * escrito termine como "De La Vega", y que un "DiCaprio" o un "McDonald" queden
 * arruinados. Sólo se normaliza lo que claramente no fue escrito, sino volcado.
 */
function unSoloCaso(valor: string): boolean {
  const tieneMinuscula = /\p{Ll}/u.test(valor);
  const tieneMayuscula = /\p{Lu}/u.test(valor);
  return !(tieneMinuscula && tieneMayuscula);
}

export function nombreDeDiario(bruto: string): string {
  // Espacios de más, incluidos los del medio: Cidituc los manda tal cual salen
  // de dos columnas concatenadas.
  const limpio = bruto.trim().replace(/\s+/gu, " ");
  if (!limpio) return limpio;
  if (!unSoloCaso(limpio)) return limpio;

  const partes = limpio.split(SEPARADORES);
  let esPrimeraPalabra = true;

  return partes
    .map((parte) => {
      // Los separadores vuelven tal cual: el split con grupo los conserva.
      if (SEPARADORES.test(parte)) return parte;

      const minuscula = parte.toLocaleLowerCase("es");
      // La primera palabra se capitaliza siempre, aunque sea una partícula: un
      // nombre que arranca con "de" arranca con "De".
      const capitalizada =
        !esPrimeraPalabra && PARTICULAS.has(minuscula)
          ? minuscula
          : capitalizar(parte);
      esPrimeraPalabra = false;
      return capitalizada;
    })
    .join("");
}
