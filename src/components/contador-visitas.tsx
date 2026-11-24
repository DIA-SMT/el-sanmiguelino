"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { rutaContable } from "@/lib/visitas";

/**
 * Avisa al servidor que se abrió una página del diario, para el contador de
 * visitas del panel. No manda nada más que la ruta: ni quién, ni de dónde.
 *
 * Va en el layout raíz y escucha la ruta: con la navegación del cliente, pasar
 * de una nota a otra no recarga la página, y sin esto sólo se contaría la
 * primera. Lo que no es del diario (el panel, el ingreso) no se manda.
 *
 * `sendBeacon` y no `fetch`: no frena la página ni se pierde si el lector se
 * va enseguida. Si el navegador no lo tiene, un `fetch` con `keepalive`.
 */
export function ContadorDeVisitas() {
  const ruta = usePathname();

  useEffect(() => {
    const contable = rutaContable(ruta);
    if (!contable) return;
    const cuerpo = JSON.stringify({ ruta: contable });
    try {
      const tipo = new Blob([cuerpo], { type: "application/json" });
      if (navigator.sendBeacon?.("/api/visita", tipo)) return;
      void fetch("/api/visita", {
        method: "POST",
        body: cuerpo,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Sin contador no pasa nada: leer el diario no depende de esto.
    }
  }, [ruta]);

  return null;
}
