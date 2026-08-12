import { PasadorPaginas } from "@/components/pasador-paginas";
import { paginasDeEdicion } from "@/lib/data/paginas";
import { edicionActual } from "@/lib/data/edicion-actual";
import { cn } from "@/lib/utils";

/**
 * Hoja de diario: la página apoyada sobre el escritorio, con su pie y el
 * pasador de páginas. `numeroPagina` en null para pantallas que no forman
 * parte de la numeración (listado de sección).
 */
export function HojaDiario({
  numeroPagina,
  children,
  className,
}: {
  numeroPagina: number | null;
  children: React.ReactNode;
  className?: string;
}) {
  const paginas = paginasDeEdicion(edicionActual);
  const indice = numeroPagina === null ? -1 : numeroPagina - 1;

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-6xl border border-line bg-paper shadow-[0_1px_3px_rgba(0,0,0,0.10),0_10px_30px_-12px_rgba(0,0,0,0.25)]",
        className,
      )}
    >
      {children}

      <div className="px-4 pb-6 sm:px-6">
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
