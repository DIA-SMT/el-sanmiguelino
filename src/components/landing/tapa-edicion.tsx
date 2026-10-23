import { DiarioEnPerspectiva } from "@/components/landing/diario-en-perspectiva";
import { PaginaPdf } from "@/components/pdf/pagina-pdf";
import type { EdicionResumen } from "@/lib/types";

/**
 * La tapa de la edición en curso, en la columna derecha del encabezado de la
 * landing.
 *
 * **Si el número salió como PDF, es la tapa de verdad**: la página 1 del
 * impreso, dibujada con el mismo visor que usa `/diario` (`PaginaPdf`). Hasta
 * acá un facsímil caía en `DiarioEnPerspectiva`, que sin notas escritas sólo
 * puede dibujar la bandera y una barra de secciones —una hoja casi en blanco
 * justo en el lugar más visible del sitio—. Ninguna tapa se inventa: o es el
 * PDF, o es la miniatura armada con las notas reales de la edición.
 *
 * Abrir el PDF desde acá no es tiempo perdido: el visor guarda el documento ya
 * abierto (`abrirPdf()` cachea por URL), así que quien pasa de la landing a
 * `/diario` encuentra la tapa dibujada.
 *
 * La pila de hojas de atrás es la misma idea que la de la miniatura en ángulo,
 * acá plana: el ejemplar apoyado sobre los anteriores. Con `aria-hidden`
 * porque es decoración; la tapa sí tiene nombre, el de `etiqueta`.
 */
export function TapaEdicion({ edicion }: { edicion: EdicionResumen }) {
  if (!edicion.pdf) return <DiarioEnPerspectiva />;

  return (
    <div className="fade-up-2 mx-auto w-full max-w-[21rem] sm:max-w-[25rem] lg:mr-0">
      <div className="relative [transform:rotate(1.2deg)]">
        {[
          { x: 12, y: 12, giro: -2.4 },
          { x: 6, y: 6, giro: -1.2 },
        ].map(({ x, y, giro }) => (
          <div
            key={giro}
            aria-hidden="true"
            className="absolute inset-0 border border-line bg-paper-2 shadow-flotante"
            style={{ transform: `translate(${x}px, ${y}px) rotate(${giro}deg)` }}
          />
        ))}
        <div className="relative border border-line bg-paper p-2 shadow-flotante">
          <PaginaPdf
            url={edicion.pdf.url}
            pagina={1}
            etiqueta={`Tapa de El Sanmiguelino, ${edicion.mes}`}
          />
        </div>
      </div>
    </div>
  );
}
