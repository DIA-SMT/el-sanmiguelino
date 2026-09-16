import { PasadorPaginas } from "@/components/pasador-paginas";
import { paginasDeEdicion } from "@/lib/data/paginas";
import { getIndice, getIndiceDe, getResumenEdicion } from "@/lib/repos/edicion";
import { cn } from "@/lib/utils";

/**
 * Hoja de diario: la página apoyada sobre el escritorio, con su trama de
 * fibra, su pie y el pasador de páginas. `numeroPagina` en null para
 * pantallas que no forman parte de la numeración (listado de sección).
 */
export async function HojaDiario({
  numeroPagina,
  edicionSlug,
  children,
  className,
}: {
  numeroPagina: number | null;
  /** De qué edición es lo que se está mostrando.
   *
   *  Importa para el archivo: una nota de agosto leída cuando el diario ya va
   *  por septiembre tiene que decir "Página 5 de 9" contando sobre agosto. Sin
   *  esto el pie contaba sobre la edición en la calle y el número no
   *  correspondía a nada. */
  edicionSlug?: string;
  children: React.ReactNode;
  className?: string;
}) {
  // Si lo que se está mostrando es de la edición en curso —todo lo que no sea
  // archivo— alcanza con el índice que ya pidió la página. Pedirlo "de" esa
  // edición sería la misma lista por otra consulta.
  const enLaCalle = await getResumenEdicion();
  const esDeLaCalle = !edicionSlug || edicionSlug === enLaCalle.slug;
  const paginas = paginasDeEdicion(
    esDeLaCalle ? await getIndice() : await getIndiceDe(edicionSlug),
    // En el archivo no hay portada: `/diario` es del número del mes. Sin esto
    // el pasador del pie ofrecía "anterior" apuntando a la tapa de OTRA
    // edición.
    { enLaCalle: esDeLaCalle },
  );
  /*
   * La posición sale de BUSCAR el folio, no de restarle uno.
   *
   * `numeroPagina - 1` daba por sentado que el foliado arranca en 1 y va
   * corrido, que es cierto en un número digitalizado y falso en uno de notas
   * escritas —ahí la primera nota es la página 2— y falso también en el
   * archivo, donde la portada no está en la lista.
   */
  const indice =
    numeroPagina === null
      ? -1
      : paginas.findIndex((p) => p.numero === numeroPagina);

  return (
    <div className={cn("hoja grano mx-auto w-full max-w-6xl", className)}>
      {children}

      <div className="px-4 pb-7 sm:px-6">
        {indice >= 0 && (
          <PasadorPaginas
            anterior={paginas[indice - 1] ?? null}
            siguiente={paginas[indice + 1] ?? null}
            numero={paginas[indice].numero}
            /* El total es el folio más ALTO, no cuántas filas hay: en una
               edición de notas escritas la portada es la página 1 y no está en
               esta lista cuando se lee del archivo. */
            total={paginas[paginas.length - 1]?.numero ?? paginas.length}
          />
        )}
      </div>
    </div>
  );
}
