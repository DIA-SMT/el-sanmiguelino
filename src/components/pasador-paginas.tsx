import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PaginaEdicion } from "@/lib/data/paginas";

/**
 * Pie de la hoja: el foliado y el paso de página con el título a la vista.
 *
 * Es solo el pie impreso. Las flechas al costado, el teclado y el gesto del
 * dedo viven en `MandoPaginas`, en el layout del escritorio: son el mando, no
 * el papel, y así siguen respondiendo mientras la próxima hoja carga.
 */
export function PasadorPaginas({
  anterior,
  siguiente,
  numero,
  total,
}: {
  anterior: PaginaEdicion | null;
  siguiente: PaginaEdicion | null;
  numero: number;
  total: number;
}) {
  const claseBoton =
    "pressable group inline-flex max-w-[42%] items-center gap-2 border border-line bg-chrome px-3.5 py-2.5 font-sans text-[0.7rem] font-medium text-ink hover:border-ink hover:bg-paper-2";

  return (
    <div className="mt-10 border-t border-ink pt-5">
      <div className="flex items-center justify-between gap-3">
        {anterior ? (
          <Link
            href={anterior.href}
            transitionTypes={["pagina-atras"]}
            prefetch
            className={claseBoton}
          >
            <ChevronLeft
              className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:-translate-x-1"
              aria-hidden="true"
            />
            <span className="truncate">
              <span className="sr-only">Página anterior: </span>
              {anterior.titulo}
            </span>
          </Link>
        ) : (
          <span />
        )}

        <p className="meta shrink-0">
          Página <span className="text-ink">{numero}</span> de {total}
        </p>

        {siguiente ? (
          <Link
            href={siguiente.href}
            transitionTypes={["pagina-adelante"]}
            prefetch
            className={claseBoton}
          >
            <span className="truncate">
              <span className="sr-only">Página siguiente: </span>
              {siguiente.titulo}
            </span>
            <ChevronRight
              className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
        ) : (
          <span />
        )}
      </div>

      {/* La ayuda depende de con qué se está leyendo. `any-pointer` y no
          `pointer` a propósito: en una notebook táctil el puntero principal
          sigue siendo el trackpad, pero el dedo también sirve. */}
      <p className="mt-4 text-center font-serif text-[0.8rem] italic text-ink-3">
        <span className="[@media(any-pointer:coarse)]:hidden">
          Deslizá dos dedos en el trackpad para pasar de página, o usá las
          flechas ← →
        </span>
        <span className="hidden [@media(any-pointer:coarse)]:inline">
          Deslizá para pasar de página, o usá las flechas ← →
        </span>
      </p>
    </div>
  );
}
