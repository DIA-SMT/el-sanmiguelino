"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export function BotonIngresar({ destino }: { destino: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"idle" | "cargando" | "error">("idle");

  async function ingresar() {
    setEstado("cargando");
    try {
      const res = await fetch("/api/auth/login", { method: "POST" });
      if (!res.ok) throw new Error();
      router.push(destino.startsWith("/") ? destino : "/diario");
      router.refresh();
    } catch {
      setEstado("error");
    }
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={ingresar}
        disabled={estado === "cargando"}
        className="pressable inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-3 font-sans text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-strong disabled:opacity-60"
      >
        {estado === "cargando" && (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        )}
        {estado === "cargando" ? "Conectando con Cidituc…" : "Ingresar con Cidituc"}
      </button>
      {estado === "error" && (
        <p role="alert" className="mt-3 font-sans text-xs text-red-700 dark:text-red-400">
          No pudimos conectar con Cidituc. Revisá tu conexión y volvé a intentar.
        </p>
      )}
    </div>
  );
}
