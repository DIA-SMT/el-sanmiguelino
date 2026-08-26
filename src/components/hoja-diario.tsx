import { PasadorPaginas } from "@/components/pasador-paginas";
import { paginasDeEdicion } from "@/lib/data/paginas";
import { getIndice, getIndiceDe } from "@/lib/repos/edicion";
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
  const paginas = paginasDeEdicion(
    edicionSlug ? await getIndiceDe(edicionSlug) : await getIndice(),
  );
  const indice = numeroPagina === null ? -1 : numeroPagina - 1;

  return (
    <div className={cn("hoja grano mx-auto w-full max-w-6xl", className)}>
      {children}

      <div className="px-4 pb-7 sm:px-6">
        {indice >= 0 && (
          <PasadorPaginas
            anterior={paginas[indice - 1] ?? null}
            siguiente={paginas[indice + 1] ?? null}
            numero={paginas[indice].numero}
            total={paginas.length}
          />
        )}
      </div>
    </div>
  );
}
