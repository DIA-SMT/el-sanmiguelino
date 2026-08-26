"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { guardarEdicionAction } from "@/app/admin/acciones";
import { cn } from "@/lib/utils";

const campo =
  "w-full border border-line bg-chrome px-2.5 py-1.5 font-sans text-[0.85rem] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none";
const etiqueta =
  "block font-sans text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-2";

/**
 * Alta de la edición del mes que viene.
 *
 * La fecha es opcional a propósito: se puede crear septiembre hoy, cargarle las
 * notas durante tres semanas y recién al final ponerle la fecha. Sin fecha no
 * sale nunca sola, que es exactamente lo que uno quiere de una edición en
 * preparación.
 */
export function NuevaEdicion({ siguienteNumero }: { siguienteNumero: number }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [enCurso, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mes, setMes] = useState("");
  const [slug, setSlug] = useState("");
  const [numero, setNumero] = useState(String(siguienteNumero));
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [publicaEn, setPublicaEn] = useState("");

  function crear() {
    setError(null);
    iniciar(async () => {
      try {
        const res = await guardarEdicionAction({
          slug,
          mes,
          numero: Number(numero),
          anio: Number(anio),
          publicaEn,
          esNueva: true,
        });
        if (!res.ok) {
          setError(res.error ?? "No se pudo crear.");
          return;
        }
        setAbierto(false);
        setMes("");
        setSlug("");
        setPublicaEn("");
        router.refresh();
      } catch {
        setError("No se pudo hablar con el servidor.");
      }
    });
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="pressable mt-5 inline-flex items-center gap-2 border border-ink px-4 py-2 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink hover:bg-ink hover:text-paper"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Edición nueva
      </button>
    );
  }

  return (
    <section className="mt-5 border border-ink px-5 py-5">
      <h2 className="font-sans text-[0.9rem] font-bold text-ink">
        Edición nueva
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label>
          <span className={etiqueta}>Mes</span>
          <input
            value={mes}
            onChange={(e) => {
              setMes(e.target.value);
              // El slug se propone solo desde el mes, y se puede corregir.
              if (!slug || slug === proponerSlug(mes)) {
                setSlug(proponerSlug(e.target.value));
              }
            }}
            className={cn(campo, "mt-1.5")}
            placeholder="Septiembre de 2026"
          />
        </label>
        <label>
          <span className={etiqueta}>Slug</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={cn(campo, "mt-1.5 font-mono text-[0.8rem]")}
            placeholder="septiembre-2026"
          />
        </label>
        <label>
          <span className={etiqueta}>Número</span>
          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            inputMode="numeric"
            className={cn(campo, "mt-1.5")}
          />
        </label>
        <label>
          <span className={etiqueta}>Año</span>
          <input
            value={anio}
            onChange={(e) => setAnio(e.target.value)}
            inputMode="numeric"
            className={cn(campo, "mt-1.5")}
          />
        </label>
        <label className="sm:col-span-2">
          <span className={etiqueta}>Sale el (hora de Tucumán)</span>
          <input
            type="datetime-local"
            value={publicaEn}
            onChange={(e) => setPublicaEn(e.target.value)}
            className={cn(campo, "mt-1.5 w-auto")}
          />
          <span className="mt-1 block font-sans text-[0.72rem] text-ink-3">
            Se puede dejar vacía y ponerla después. Sin fecha, la edición no
            sale sola: es lo que permite prepararla con semanas de
            anticipación.
          </span>
        </label>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 font-sans text-[0.78rem] text-red-700 dark:text-red-400"
        >
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={crear}
          disabled={enCurso}
          className="pressable bg-accent px-5 py-2 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-accent-contrast hover:bg-accent-strong disabled:opacity-50"
        >
          {enCurso ? "Creando…" : "Crear edición"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="pressable font-sans text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-3 hover:text-ink"
        >
          Cancelar
        </button>
      </div>
    </section>
  );
}

function proponerSlug(mes: string): string {
  return mes
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\bde\b/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
