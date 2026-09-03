/**
 * Los campos que se derivan del cuerpo de una nota.
 *
 * Viven acá, y no en `utils.ts` ni adentro del repo, porque tienen **dos**
 * usuarios que obligatoriamente tienen que coincidir: el repo mock, que los
 * calcula al proyectar, y `prisma/seed.mts`, que los escribe en columnas de
 * Postgres. Si cada uno tuviera su copia, la migración de la etapa 4 cambiaría
 * los datos sin que nadie lo note: mismos textos, distintos minutos.
 *
 * El único import es de TIPO, y eso es lo que lo mantiene ejecutable por Node
 * suelto: `import type` se borra al quitar los tipos, así que el alias `@/`
 * nunca se resuelve en tiempo de ejecución. Un import de valor con alias sí
 * rompería la semilla, que corre fuera de Next.
 */
import type { BloqueNota } from "@/lib/types";

/**
 * El texto plano de un bloque, sea del tipo que sea.
 *
 * Existe porque no todos los bloques tienen un campo `texto`: una ficha tiene
 * un título y una lista de entradas. Antes las dos funciones de abajo hacían
 * `b.texto` sobre cualquier bloque, así que la primera ficha habría metido la
 * cadena "undefined" en el índice del buscador y hecho explotar el conteo de
 * palabras.
 *
 * El `switch` es exhaustivo a propósito, con el `never` del final: agregar un
 * tipo de bloque nuevo sin pasar por acá deja de compilar, que es exactamente
 * lo que hay que forzar. Fallar en el build es barato; un índice de búsqueda
 * sucio en silencio, no.
 */
export function textoDeBloque(bloque: BloqueNota): string {
  switch (bloque.tipo) {
    case "parrafo":
    case "subtitulo":
    case "destacado":
      return bloque.texto;
    case "cita":
      // El autor y el cargo van INCLUIDOS. Antes se devolvía sólo el texto, y
      // eso dejaba a quien habla fuera del índice del buscador y fuera del
      // contexto que ve Migue: buscar "intendenta" no daba nada, y a "qué dijo
      // la intendenta sobre las plazas" Migue contestaba que no estaba en la
      // edición —teniendo la cita delante, pero sin saber de quién era—.
      //
      // En un diario, quién dijo algo es tan buscable como lo que dijo.
      return [bloque.texto, bloque.autor, bloque.cargo]
        .filter(Boolean)
        .join(" ");
    case "ficha":
      return [
        bloque.titulo,
        ...bloque.entradas.flatMap((e) => [e.lead, e.texto]),
      ].join(" ");
    case "foto":
      // El epígrafe y el crédito, no el `alt`. El `alt` describe la imagen para
      // quien no la ve y suele repetir lo que ya dice el epígrafe; meterlo
      // duplicaría cada foto en el índice y le comería contexto a Migue.
      //
      // El crédito SÍ va: "¿de quién son las fotos de las plazas?" es una
      // pregunta razonable, y la respuesta está impresa en la página.
      return [bloque.epigrafe, bloque.credito].filter(Boolean).join(" ");
    default: {
      const _exhaustivo: never = bloque;
      return _exhaustivo;
    }
  }
}

export function minutosDeLectura(bloques: BloqueNota[]): number {
  const palabras = bloques.reduce(
    (total, b) => total + textoDeBloque(b).trim().split(/\s+/).length,
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
export function textoPlanoDe(bloques: BloqueNota[]): string {
  return bloques.map(textoDeBloque).join(" ");
}
