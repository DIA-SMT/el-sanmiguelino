"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enfocarEdicionAction } from "@/app/admin/acciones";
import { clasesDeCampo } from "@/components/admin/piezas";
import { cn } from "@/lib/utils";

export interface EdicionParaElegir {
  slug: string;
  nombre: string;
  /** "publicada", "sale el 11 de noviembre", "sin fecha". */
  estado: string;
}

/**
 * Qué edición lista «Notas de la edición».
 *
 * Antes la única manera de editar las notas de otra edición —la que se está
 * armando, o una del archivo— era ir a Ediciones, tocar «Verla en el diario» y
 * volver. Nadie lo adivinaba: el 2026-11-08 una redactora creyó que había
 * perdido los permisos.
 *
 * Usa el mismo mecanismo que aquel botón (`enfocarEdicionAction`, la cookie de
 * la edición en foco) y no uno propio a propósito: el orden de las notas, la
 * nota nueva y el diario ya siguen a la edición en foco, así que con una sola
 * fuente de verdad todo el panel habla de la misma edición. "" es volver a la
 * que está en la calle.
 */
export function ElegirEdicionNotas({
  ediciones,
  enFoco,
}: {
  ediciones: EdicionParaElegir[];
  /** El slug en foco, o null si se está viendo la que está en la calle. */
  enFoco: string | null;
}) {
  const router = useRouter();
  const [enCurso, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="notas-edicion" className="text-panel-sm font-medium text-panel-tinta-2">
        Edición
      </label>
      <select
        id="notas-edicion"
        value={enFoco ?? ""}
        disabled={enCurso}
        onChange={(e) => {
          const slug = e.target.value;
          setError(null);
          iniciar(async () => {
            try {
              await enfocarEdicionAction(slug || null);
              router.refresh();
            } catch {
              // Lo realista es que se haya vencido la sesión.
              setError("No se pudo cambiar. Recargá la página y fijate si seguís adentro.");
            }
          });
        }}
        className={cn(clasesDeCampo("tarjeta"), "w-auto min-w-0 max-w-full")}
      >
        <option value="">La que está en la calle</option>
        {ediciones.map((e) => (
          <option key={e.slug} value={e.slug}>
            {e.nombre} ({e.estado})
          </option>
        ))}
      </select>
      <span
        className={cn(
          "text-panel-sm",
          error ? "text-[var(--grafico-alerta)]" : "text-panel-tinta-3",
        )}
        aria-live="polite"
      >
        {enCurso ? "Cambiando…" : (error ?? "")}
      </span>
    </div>
  );
}
