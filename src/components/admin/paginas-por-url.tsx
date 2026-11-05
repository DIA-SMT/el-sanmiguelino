"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PaginadoNumerado } from "@/components/admin/piezas";

/**
 * El paginado numerado para una lista que arma el servidor: cambiar de página
 * es cambiar un parámetro de la dirección (`?envios=2`), y la página se vuelve
 * a pedir. Así la página actual se puede compartir y sobrevive a una recarga.
 */
export function PaginasPorUrl({
  parametro,
  pagina,
  totalPaginas,
  etiqueta,
  resumen,
}: {
  parametro: string;
  pagina: number;
  totalPaginas: number;
  etiqueta: string;
  resumen?: React.ReactNode;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const actuales = useSearchParams();
  return (
    <PaginadoNumerado
      pagina={pagina}
      totalPaginas={totalPaginas}
      etiqueta={etiqueta}
      resumen={resumen}
      alIr={(n) => {
        const p = new URLSearchParams(actuales.toString());
        if (n <= 1) p.delete(parametro);
        else p.set(parametro, String(n));
        const q = p.toString();
        router.push(q ? `${ruta}?${q}` : ruta, { scroll: false });
      }}
    />
  );
}
