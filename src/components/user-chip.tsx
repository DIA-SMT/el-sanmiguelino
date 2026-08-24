"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import type { Usuario } from "@/lib/types";

export function UserChip({ usuario }: { usuario: Usuario }) {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  async function cerrarSesion() {
    setSaliendo(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch {
      setSaliendo(false);
    }
  }

  const iniciales = usuario.nombre
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-2.5 border border-line bg-chrome py-1 pl-1 pr-3">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center bg-ink font-sans text-[0.6rem] font-bold tracking-wider text-paper"
        >
          {iniciales}
        </span>
        <span className="max-w-[9rem] truncate font-sans text-[0.7rem] font-medium text-ink">
          {usuario.nombre}
        </span>
      </span>
      <button
        type="button"
        onClick={cerrarSesion}
        disabled={saliendo}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        className="pressable inline-flex h-9 w-9 items-center justify-center border border-line bg-chrome text-ink-2 hover:border-ink hover:text-ink disabled:opacity-50"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
