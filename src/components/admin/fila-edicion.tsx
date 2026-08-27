"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, Pencil, X } from "lucide-react";
import {
  enfocarEdicionAction,
  guardarEdicionAction,
} from "@/app/admin/acciones";
import { cn } from "@/lib/utils";

export interface EdicionFila {
  slug: string;
  mes: string;
  numero: number;
  anio: number;
  etiqueta: string | null;
  /** Valor para el input, en hora de Tucumán. "" si no tiene fecha. */
  publicaEnLocal: string;
  /** Texto legible de la fecha, o null. */
  publicaEnTexto: string | null;
  notas: number;
  estado: "publicada" | "programada" | "sin_fecha";
}

const campo =
  "w-full border border-line bg-chrome px-2.5 py-1.5 font-sans text-[0.82rem] text-ink focus:border-accent focus:outline-none";

const ETIQUETAS: Record<EdicionFila["estado"], string> = {
  publicada: "En la calle",
  programada: "Programada",
  sin_fecha: "Sin fecha",
};

export function FilaEdicion({
  edicion,
  enFoco,
  esLaPublicada,
}: {
  edicion: EdicionFila;
  /** Está siendo mirada por el panel y el diario. */
  enFoco: boolean;
  /** Es la que el lector ve ahora mismo. */
  esLaPublicada: boolean;
}) {
  const router = useRouter();
  const [enCurso, iniciar] = useTransition();
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fecha, setFecha] = useState(edicion.publicaEnLocal);

  function guardarFecha() {
    setError(null);
    iniciar(async () => {
      try {
        const res = await guardarEdicionAction({
          slug: edicion.slug,
          mes: edicion.mes,
          numero: edicion.numero,
          anio: edicion.anio,
          etiqueta: edicion.etiqueta ?? "",
          publicaEn: fecha,
        });
        if (!res.ok) {
          setError(res.error ?? "No se pudo guardar.");
          return;
        }
        setEditando(false);
        router.refresh();
      } catch {
        setError("No se pudo hablar con el servidor.");
      }
    });
  }

  /**
   * Pone (o saca) la edición en vista previa.
   *
   * Con `irAlDiario`, además **lleva al diario**. Sin eso, "Verla en el
   * diario" sólo marcaba el foco y volvía a dibujar la misma fila: desde donde
   * está parado el editor no pasa nada visible, y encima el botón se convierte
   * en "Dejar de verla", así que tampoco queda a mano cómo ir a mirarla. La
   * lectura obvia es que la previsualización no anda.
   */
  function enfocar(slug: string | null, irAlDiario = false) {
    iniciar(async () => {
      await enfocarEdicionAction(slug);
      if (irAlDiario) router.push("/diario");
      else router.refresh();
    });
  }

  return (
    <li className={cn("py-4", enFoco && "border-l-2 border-accent pl-4")}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-sans text-[0.95rem] font-semibold text-ink">
          {edicion.mes}
        </span>
        <span className="font-sans text-[0.75rem] text-ink-3">
          N.º {edicion.numero} · {edicion.notas}{" "}
          {edicion.notas === 1 ? "nota" : "notas"} ·{" "}
          <code className="font-mono text-[0.72rem]">{edicion.slug}</code>
        </span>
        <span
          className={cn(
            "border px-2 py-0.5 font-sans text-[0.62rem] font-semibold uppercase tracking-[0.12em]",
            esLaPublicada
              ? "border-ink bg-ink text-paper"
              : "border-line text-ink-3",
          )}
        >
          {esLaPublicada ? "En la calle" : ETIQUETAS[edicion.estado]}
        </span>
        {enFoco && (
          <span className="inline-flex items-center gap-1.5 border border-accent px-2 py-0.5 font-sans text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-accent">
            <Eye className="h-3 w-3" aria-hidden="true" />
            Viéndola
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        {editando ? (
          <span className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <span className="font-sans text-[0.72rem] text-ink-3">
                Sale el
              </span>
              <input
                type="datetime-local"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={cn(campo, "w-auto")}
              />
              <span className="font-sans text-[0.7rem] text-ink-3">
                hora de Tucumán
              </span>
            </label>
            <button
              type="button"
              onClick={guardarFecha}
              disabled={enCurso}
              className="pressable inline-flex items-center gap-1.5 border border-ink bg-ink px-3 py-1.5 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-paper disabled:opacity-50"
            >
              <Check className="h-3 w-3" aria-hidden="true" />
              {enCurso ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditando(false);
                setFecha(edicion.publicaEnLocal);
                setError(null);
              }}
              className="pressable font-sans text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ink-3 hover:text-ink"
            >
              Cancelar
            </button>
          </span>
        ) : (
          <>
            <span className="font-sans text-[0.8rem] text-ink-2">
              {edicion.publicaEnTexto ? (
                <>Sale el {edicion.publicaEnTexto}</>
              ) : (
                <span className="text-ink-3">
                  Sin fecha: no sale sola hasta que se le ponga una.
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="pressable inline-flex items-center gap-1.5 border border-line px-3 py-1.5 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ink-2 hover:border-ink hover:text-ink"
            >
              <Pencil className="h-3 w-3" aria-hidden="true" />
              Cambiar fecha
            </button>
          </>
        )}

        {enFoco ? (
          <>
            {/* Ya está en foco: lo que falta es poder ir a verla. */}
            <Link
              href="/diario"
              className="pressable inline-flex items-center gap-1.5 border border-accent bg-accent-wash px-3 py-1.5 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-accent hover:bg-accent hover:text-accent-contrast"
            >
              <Eye className="h-3 w-3" aria-hidden="true" />
              Ir al diario
            </Link>
            <button
              type="button"
              onClick={() => enfocar(null)}
              disabled={enCurso}
              className="pressable inline-flex items-center gap-1.5 border border-line px-3 py-1.5 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ink-2 hover:border-ink hover:text-ink disabled:opacity-50"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              Dejar de verla
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => enfocar(edicion.slug, true)}
            disabled={enCurso}
            className="pressable inline-flex items-center gap-1.5 border border-line px-3 py-1.5 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ink-2 hover:border-ink hover:text-ink disabled:opacity-50"
          >
            <Eye className="h-3 w-3" aria-hidden="true" />
            Verla en el diario
          </button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-2 font-sans text-[0.75rem] text-red-700 dark:text-red-400"
        >
          {error}
        </p>
      )}
    </li>
  );
}
