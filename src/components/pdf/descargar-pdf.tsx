import { FileDown } from "lucide-react";

/**
 * El pie de una página del facsímil: el número entero, para bajarlo.
 *
 * No es una comodidad. La página que se ve arriba es un canvas con una capa de
 * texto encima, y eso alcanza para leer y para un lector de pantalla **si el
 * PDF tiene texto**. Cuando el número viene escaneado no lo tiene, y entonces
 * esto es lo único que queda: el archivo original, para abrirlo con el lector
 * de PDF de cada uno, que puede agrandarlo, releerlo con sus propias
 * herramientas o imprimirlo.
 *
 * Va en todas las páginas y no sólo en la tapa: nadie debería tener que volver
 * a la primera hoja para encontrar el archivo.
 */
export function DescargarPdf({
  url,
  mes,
  paginas,
}: {
  url: string;
  mes: string;
  paginas: number;
}) {
  return (
    <p className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-hairline pt-4">
      <a
        href={url}
        target="_blank"
        rel="noopener"
        className="enlace inline-flex items-center gap-1.5 font-sans text-[0.82rem]"
      >
        <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
        Descargar {mes} en PDF
      </a>
      <span className="meta">
        {paginas} {paginas === 1 ? "página" : "páginas"}
      </span>
    </p>
  );
}
