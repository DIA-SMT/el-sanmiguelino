import type { Edicion, Nota } from "@/lib/types";

/** Fragmento del texto donde apareció lo buscado, partido para poder resaltar
 *  la coincidencia sin volver a buscarla en el componente. */
export interface Fragmento {
  antes: string;
  coincidencia: string;
  despues: string;
}

export interface Resultado {
  nota: Nota;
  /** dónde pegó: manda para ordenar los resultados */
  donde: "titulo" | "bajada" | "seccion" | "cuerpo";
  fragmento: Fragmento | null;
}

/** Mínimo de caracteres para que la búsqueda valga la pena. Con menos, todo
 *  coincide con todo. */
export const MINIMO_CONSULTA = 2;

const PESO: Record<Resultado["donde"], number> = {
  titulo: 0,
  bajada: 1,
  seccion: 2,
  cuerpo: 3,
};

/**
 * Minúsculas y sin tildes, pero **manteniendo el largo**: cada carácter de
 * entrada da exactamente un carácter de salida. Es lo que permite después
 * cortar el fragmento con los índices del texto original. Con un
 * `normalize("NFD")` sobre la cadena entera, "á" pasa a ser dos caracteres y
 * el resaltado sale corrido.
 */
function normalizar(texto: string): string {
  let salida = "";
  for (const caracter of texto) {
    const limpio = caracter
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
    salida += limpio.length === caracter.length ? limpio : caracter;
  }
  return salida;
}

function fragmentoDe(texto: string, consulta: string): Fragmento | null {
  const i = normalizar(texto).indexOf(consulta);
  if (i < 0) return null;

  const desde = Math.max(0, i - 70);
  const hasta = Math.min(texto.length, i + consulta.length + 90);
  return {
    antes: (desde > 0 ? "…" : "") + texto.slice(desde, i),
    coincidencia: texto.slice(i, i + consulta.length),
    despues:
      texto.slice(i + consulta.length, hasta) +
      (hasta < texto.length ? "…" : ""),
  };
}

function cuerpoDe(nota: Nota): string {
  return nota.cuerpo.map((b) => b.texto).join(" ");
}

/**
 * Busca en la edición: título, bajada, sección y cuerpo. Devuelve una entrada
 * por nota —la del campo más relevante donde pegó— ordenada por esa
 * relevancia y, a igualdad, por el orden de tapa.
 */
export function buscarEnEdicion(
  edicion: Edicion,
  consulta: string,
): Resultado[] {
  const buscada = normalizar(consulta.trim());
  if (buscada.length < MINIMO_CONSULTA) return [];

  const resultados: Resultado[] = [];

  edicion.notas.forEach((nota) => {
    const campos: [Resultado["donde"], string][] = [
      ["titulo", nota.titulo],
      ["bajada", nota.bajada],
      ["seccion", nota.seccion],
      ["cuerpo", cuerpoDe(nota)],
    ];

    for (const [donde, texto] of campos) {
      const fragmento = fragmentoDe(texto, buscada);
      if (!fragmento) continue;
      // El título y la sección ya se muestran enteros en el resultado: no
      // hace falta repetirlos como fragmento.
      resultados.push({
        nota,
        donde,
        fragmento: donde === "titulo" || donde === "seccion" ? null : fragmento,
      });
      return;
    }
  });

  return resultados.sort((a, b) => PESO[a.donde] - PESO[b.donde]);
}
