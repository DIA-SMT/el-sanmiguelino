"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { moverNotaAction } from "@/app/admin/acciones";
import { clasesDeBotonIcono } from "@/components/admin/piezas";

/**
 * Las flechas para subir o bajar una nota escrita en la lista del panel.
 *
 * Cada flecha ya trae a dónde va: detrás de qué nota (`"__primera"` para
 * ponerla primera), o `null` si no se puede mover para ese lado. Lo calcula la
 * página, que tiene la lista entera; la regla que manda la vuelve a aplicar el
 * servidor (`nuevoOrden()`), así que una lista vieja no puede hacer nada que
 * la regla no deje.
 */
export function MoverNota({
  slug,
  titulo,
  subirA,
  bajarA,
}: {
  slug: string;
  titulo: string;
  subirA: string | null;
  bajarA: string | null;
}) {
  const router = useRouter();
  const [moviendo, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function mover(despuesDe: string) {
    setError(null);
    iniciar(async () => {
      try {
        const res = await moverNotaAction({ slug, despuesDe });
        if (!res.ok) setError(res.error ?? "No se pudo mover.");
        router.refresh();
      } catch {
        setError("No se pudo hablar con el servidor.");
      }
    });
  }

  // Sobre la fila, que es superficie hundida.
  const clase = clasesDeBotonIcono({ sobre: "hundida" });
  return (
    <>
      <span className="flex shrink-0 items-center gap-panel-controles">
        <button
          type="button"
          onClick={() => subirA && mover(subirA)}
          disabled={moviendo || subirA === null}
          aria-label={`Subir «${titulo}»`}
          title="Subir"
          className={clase}
        >
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => bajarA && mover(bajarA)}
          disabled={moviendo || bajarA === null}
          aria-label={`Bajar «${titulo}»`}
          title="Bajar"
          className={clase}
        >
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </button>
      </span>
      {error && (
        <p role="alert" className="basis-full text-panel-sm text-panel-tinta-2">
          {error}
        </p>
      )}
    </>
  );
}
