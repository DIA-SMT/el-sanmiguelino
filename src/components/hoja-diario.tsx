import { PasadorPaginas } from "@/components/pasador-paginas";
import { paginasDeEdicion } from "@/lib/data/paginas";
import { getEdicion } from "@/lib/repos/edicion";
import { cn } from "@/lib/utils";

/**
 * Hoja de diario: la página apoyada sobre el escritorio, con su trama de
 * fibra, su pie y el pasador de páginas. `numeroPagina` en null para
 * pantallas que no forman parte de la numeración (listado de sección).
 */
export async function HojaDiario({
  numeroPagina,
  children,
  className,
}: {
  numeroPagina: number | null;
  children: React.ReactNode;
  className?: string;
}) {
  const paginas = paginasDeEdicion(await getEdicion());
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
