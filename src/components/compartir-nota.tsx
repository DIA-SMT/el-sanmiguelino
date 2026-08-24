"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Link2, Share2 } from "lucide-react";

type Estado = "listo" | "copiado" | "error";

/** `navigator.share` no existe en el server. Se lee con
 *  `useSyncExternalStore` —el mismo idioma que usa el toggle de tema— para que
 *  el server rinda `false` y el cliente la verdad, sin desajuste de hidratación
 *  y sin un efecto que dispare un segundo render. No hay a qué suscribirse:
 *  la capacidad del navegador no cambia mientras la página vive. */
const SIN_CAMBIOS = () => () => {};


/**
 * Compartir la nota. Usa el diálogo nativo del sistema donde existe —que en
 * celular es lo que la gente espera— y cae a copiar el enlace donde no.
 */
export function CompartirNota({ titulo }: { titulo: string }) {
  const hayNativo = useSyncExternalStore(
    SIN_CAMBIOS,
    () => "share" in navigator,
    () => false,
  );
  const [estado, setEstado] = useState<Estado>("listo");

  useEffect(() => {
    if (estado === "listo") return;
    const t = window.setTimeout(() => setEstado("listo"), 2500);
    return () => window.clearTimeout(t);
  }, [estado]);

  async function compartir() {
    const url = window.location.href;

    if (hayNativo) {
      try {
        await navigator.share({ title: titulo, url });
        return;
      } catch {
        // Cancelar el diálogo también cae acá: no es un error que mostrar,
        // así que se sigue de largo al copiado como respaldo.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setEstado("copiado");
    } catch {
      setEstado("error");
    }
  }

  const Icono =
    estado === "copiado" ? Check : hayNativo ? Share2 : Link2;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <button
        type="button"
        onClick={compartir}
        className="pressable inline-flex items-center gap-2 border border-line bg-chrome px-4 py-2.5 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-ink hover:border-ink hover:bg-paper-2"
      >
        <Icono className="h-3.5 w-3.5" aria-hidden="true" />
        {estado === "copiado"
          ? "Enlace copiado"
          : hayNativo
            ? "Compartir"
            : "Copiar enlace"}
      </button>

      {/* El aviso va en una región viva: quien no ve el icono cambiar tiene
          que enterarse igual de que se copió. */}
      <p role="status" aria-live="polite" className="meta">
        {estado === "copiado" && "El enlace quedó en el portapapeles"}
        {estado === "error" && "No se pudo copiar el enlace"}
      </p>
    </div>
  );
}
