"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import { moderarComentarioAction } from "@/app/admin/acciones";
import { tiempoRelativo } from "@/lib/utils";
import type { ComentarioModerable } from "@/lib/types";

/**
 * Un comentario en la pantalla de moderación.
 *
 * Dar de baja pide un motivo antes de ejecutar. No es burocracia: el motivo
 * queda guardado con el comentario junto a quién lo bajó y cuándo, y es lo
 * único que después permite explicarle a un vecino por qué su comentario no
 * está. Se puede dejar vacío —hay casos obvios— pero hay que pasar por el
 * paso, que es lo que convierte la baja en una decisión y no en un reflejo.
 */
export function FilaComentario({
  comentario,
  tituloNota,
}: {
  comentario: ComentarioModerable;
  tituloNota?: string;
}) {
  const router = useRouter();
  const [enCurso, iniciar] = useTransition();
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const oculto = comentario.estado === "oculto";

  function moderar(accion: "bajar" | "restituir") {
    setError(null);
    iniciar(async () => {
      const res = await moderarComentarioAction(
        comentario.id,
        accion,
        accion === "bajar" ? motivo : undefined,
      );
      if (!res.ok) {
        setError(res.error ?? "No se pudo moderar.");
        return;
      }
      setPidiendoMotivo(false);
      setMotivo("");
      router.refresh();
    });
  }

  return (
    <li
      className={
        oculto
          ? "border-l-2 border-line bg-paper-2 py-4 pl-4 pr-1"
          : "border-l-2 border-transparent py-4 pl-4 pr-1"
      }
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-sans text-[0.85rem] font-semibold text-ink">
          {comentario.usuarioNombre}
        </span>
        <span className="font-sans text-[0.72rem] text-ink-3">
          {tiempoRelativo(comentario.fecha)}
        </span>
        {tituloNota && (
          <span className="min-w-0 font-sans text-[0.72rem] text-ink-3">
            sobre <span className="text-ink-2">{tituloNota}</span>
          </span>
        )}
        {oculto && (
          <span className="inline-flex items-center gap-1.5 border border-line px-2 py-0.5 font-sans text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-ink-3">
            <EyeOff className="h-3 w-3" aria-hidden="true" />
            De baja
          </span>
        )}
      </div>

      <p
        className={
          oculto
            ? "mt-2 max-w-3xl font-serif text-[0.95rem] leading-relaxed text-ink-3 line-through decoration-line"
            : "mt-2 max-w-3xl font-serif text-[0.95rem] leading-relaxed text-ink"
        }
      >
        {comentario.texto}
      </p>

      {oculto && comentario.ocultadoEn && (
        <p className="mt-2 font-sans text-[0.72rem] text-ink-3">
          Dado de baja {tiempoRelativo(comentario.ocultadoEn)}
          {comentario.ocultadoPor ? ` por ${comentario.ocultadoPor}` : ""}
          {comentario.motivoBaja ? ` · ${comentario.motivoBaja}` : ""}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="inline-flex items-center gap-3 font-sans text-[0.72rem] tabular-nums text-ink-3">
          <span className="inline-flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" aria-hidden="true" />
            {comentario.likes}
          </span>
          <span className="inline-flex items-center gap-1">
            <ThumbsDown className="h-3 w-3" aria-hidden="true" />
            {comentario.dislikes}
          </span>
        </span>

        {oculto ? (
          <button
            type="button"
            onClick={() => moderar("restituir")}
            disabled={enCurso}
            className="pressable inline-flex items-center gap-1.5 border border-line px-3 py-1.5 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ink-2 hover:border-ink hover:text-ink disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            Restituir
          </button>
        ) : pidiendoMotivo ? (
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo (queda guardado; puede ir vacío)"
              className="min-w-0 flex-1 border border-line bg-chrome px-2.5 py-1.5 font-sans text-[0.78rem] text-ink focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => moderar("bajar")}
              disabled={enCurso}
              className="pressable shrink-0 border border-ink bg-ink px-3 py-1.5 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-paper disabled:opacity-50"
            >
              {enCurso ? "Bajando…" : "Confirmar baja"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPidiendoMotivo(false);
                setMotivo("");
              }}
              className="pressable shrink-0 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ink-3 hover:text-ink"
            >
              Cancelar
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setPidiendoMotivo(true)}
            className="pressable inline-flex items-center gap-1.5 border border-line px-3 py-1.5 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ink-2 hover:border-ink hover:text-ink"
          >
            <EyeOff className="h-3 w-3" aria-hidden="true" />
            Dar de baja
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 font-sans text-[0.75rem] text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </li>
  );
}
