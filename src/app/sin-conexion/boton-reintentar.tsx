"use client";

import { RotateCw } from "lucide-react";

/** Vuelve a pedir la página que no llegó. Es un `reload` y no un
 *  `router.refresh()`: la URL de la barra es la de la nota que se pidió, y lo
 *  que hay que repetir es esa navegación completa, con el worker de por medio. */
export function BotonReintentar() {
  return (
    <div className="mt-7 flex justify-center">
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="pressable group inline-flex items-center gap-2.5 bg-ink px-6 py-3 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-paper hover:bg-accent hover:text-accent-contrast"
      >
        <RotateCw
          className="h-3.5 w-3.5 transition-transform duration-500 group-hover:rotate-180"
          aria-hidden="true"
        />
        Reintentar
      </button>
    </div>
  );
}
