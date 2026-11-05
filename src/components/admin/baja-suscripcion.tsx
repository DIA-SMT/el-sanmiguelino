"use client";

import { useState, useTransition } from "react";
import { darDeBajaSuscripcionAction } from "@/app/admin/newsletter/acciones";
import { clasesDeBoton } from "@/components/admin/piezas";

/**
 * «Dar de baja», en la fila de un vecino: para cuando pide no recibir más el
 * newsletter por otro canal (teléfono, en persona). Pregunta antes, porque
 * para volver la persona tiene que anotarse y confirmar de nuevo.
 */
export function BajaSuscripcion({ id, nombre }: { id: string; nombre: string }) {
  const [preguntando, setPreguntando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  if (!preguntando) {
    return (
      <button
        type="button"
        onClick={() => setPreguntando(true)}
        className={clasesDeBoton({ tono: "fantasma", tamano: "chico" })}
        aria-label={`Dar de baja a ${nombre}`}
      >
        Dar de baja
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={enCurso}
        onClick={() =>
          iniciar(async () => {
            try {
              const r = await darDeBajaSuscripcionAction(id);
              if (!r.ok) setError(r.error ?? "No se pudo.");
            } catch {
              setError("No se pudo hablar con el servidor.");
            }
          })
        }
        className={clasesDeBoton({ tono: "destructivo", tamano: "chico" })}
      >
        {enCurso ? "Dando de baja…" : "Sí, dar de baja"}
      </button>
      <button
        type="button"
        onClick={() => {
          setPreguntando(false);
          setError(null);
        }}
        className={clasesDeBoton({ tono: "fantasma", tamano: "chico" })}
      >
        Cancelar
      </button>
      {error && (
        <span role="alert" className="text-panel-xs text-red-700 dark:text-red-300">
          {error}
        </span>
      )}
    </div>
  );
}
