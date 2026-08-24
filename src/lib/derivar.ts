/**
 * Los campos que se derivan del cuerpo de una nota.
 *
 * Viven acá, y no en `utils.ts` ni adentro del repo, porque tienen **dos**
 * usuarios que obligatoriamente tienen que coincidir: el repo mock, que los
 * calcula al proyectar, y `prisma/seed.ts`, que los escribe en columnas de
 * Postgres. Si cada uno tuviera su copia, la migración de la etapa 4 cambiaría
 * los datos sin que nadie lo note: mismos textos, distintos minutos.
 *
 * No importa nada con el alias `@/` a propósito: la semilla la ejecuta Node
 * suelto, fuera de Next, y ahí el alias no existe.
 */

/** Un bloque cualquiera del cuerpo; a estas dos funciones sólo les importa el
 *  texto. */
type ConTexto = { texto: string };

export function minutosDeLectura(bloques: ConTexto[]): number {
  const palabras = bloques.reduce(
    (total, b) => total + b.texto.trim().split(/\s+/).length,
    0,
  );
  return Math.max(1, Math.round(palabras / 200));
}

/**
 * El cuerpo como una sola cadena, para buscar.
 *
 * El resaltado de resultados corta el fragmento con índices sobre **esta**
 * cadena, así que el `join(" ")` no es una decisión de formato: cambiarlo por
 * `"\n"` o por `""` corre todos los índices y el resaltado empieza a subrayar
 * la palabra equivocada.
 */
export function textoPlanoDe(bloques: ConTexto[]): string {
  return bloques.map((b) => b.texto).join(" ");
}
