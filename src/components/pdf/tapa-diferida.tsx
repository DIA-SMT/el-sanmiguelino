"use client";

import { useEffect, useRef, useState } from "react";
import { PaginaPdf } from "@/components/pdf/pagina-pdf";

/**
 * La página 1 de un PDF, dibujada recién cuando está por entrar en pantalla.
 *
 * Existe por el archivo: cada tarjeta de un número impreso muestra su tapa, y
 * cada tapa es un PDF entero de varios megas. Montar `PaginaPdf` en todas a la
 * vez abriría todos los PDF del archivo al cargar la página, aunque el lector
 * nunca baje hasta los de 2026. Con esto se abre sólo lo que se mira.
 *
 * Hasta que se monta, la caja reserva el lugar con la proporción de una tapa
 * del impreso, para que la grilla no salte cuando llega el dibujo. El margen
 * del observador (300px) es para que la tapa ya esté dibujándose cuando el
 * lector llega, y no recién entonces.
 */
export function TapaDiferida({
  url,
  etiqueta,
}: {
  url: string;
  etiqueta: string;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [cerca, setCerca] = useState(false);

  useEffect(() => {
    const elemento = caja.current;
    if (!elemento || cerca) return;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) setCerca(true);
      },
      { rootMargin: "300px" },
    );
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [cerca]);

  return (
    <div ref={caja} className={cerca ? undefined : "aspect-[29/42] w-full"}>
      {cerca ? <PaginaPdf url={url} pagina={1} etiqueta={etiqueta} /> : null}
    </div>
  );
}
