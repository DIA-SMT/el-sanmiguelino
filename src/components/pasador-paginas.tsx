"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PaginaEdicion } from "@/lib/data/paginas";

/**
 * Pie de página del diario: pasa de página como en el impreso.
 * Las flechas del teclado hacen lo mismo que los botones.
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
  const router = useRouter();

  useEffect(() => {
    function alPresionar(e: KeyboardEvent) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // No robar las flechas mientras se escribe o dentro de un diálogo
      const activo = document.activeElement as HTMLElement | null;
      if (
        activo &&
        (activo.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(activo.tagName) ||
          activo.closest("[role='dialog']"))
      ) {
        return;
      }

      const destino = e.key === "ArrowRight" ? siguiente : anterior;
      if (!destino) return;
      e.preventDefault();
      router.push(destino.href, {
        transitionTypes: [
          e.key === "ArrowRight" ? "pagina-adelante" : "pagina-atras",
        ],
      });
    }

    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [anterior, siguiente, router]);

  const claseBoton =
    "pressable inline-flex max-w-[42%] items-center gap-1.5 border border-line bg-chrome px-3 py-2 font-sans text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent";

  return (
    <div className="mt-8 border-t-[3px] border-double border-ink pt-4">
      <div className="flex items-center justify-between gap-3">
        {anterior ? (
          <Link
            href={anterior.href}
            transitionTypes={["pagina-atras"]}
            className={claseBoton}
            rel="prev"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">
              <span className="sr-only">Página anterior: </span>
              {anterior.titulo}
            </span>
          </Link>
        ) : (
          <span />
        )}

        <p className="shrink-0 font-sans text-[0.65rem] uppercase tracking-[0.2em] text-ink-2">
          Página <span className="tabular-nums">{numero}</span> de{" "}
          <span className="tabular-nums">{total}</span>
        </p>

        {siguiente ? (
          <Link
            href={siguiente.href}
            transitionTypes={["pagina-adelante"]}
            className={claseBoton}
            rel="next"
          >
            <span className="truncate">
              <span className="sr-only">Página siguiente: </span>
              {siguiente.titulo}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </Link>
        ) : (
          <span />
        )}
      </div>
      <p className="mt-3 text-center font-sans text-[0.6rem] text-ink-2">
        Usá las flechas ← → del teclado para pasar de página
      </p>
    </div>
  );
}
