import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EstadoVacio, SeccionPanel } from "@/components/admin/piezas";
import type { RegistroDelPanel } from "@/lib/repos/auditoria";
import { tiempoRelativo } from "@/lib/utils";

/**
 * Lo último que pasó en el panel, en la pantalla de entrada.
 *
 * Es la "Actividad reciente" del boceto del kit visual, pero **sale del
 * registro de auditoría y de ningún otro lado**: el boceto mostraba "Nuevo
 * usuario registrado" o "Nueva nota publicada" con nombres inventados, y acá
 * no se muestra nada que no haya quedado anotado por `anotar()`. Si una acción
 * no se anota —el agujero conocido del registro—, tampoco aparece acá.
 *
 * No filtra ni pagina: son los últimos renglones y un enlace a la pantalla
 * entera. Quien quiere buscar algo va a Auditoría, que es donde están los
 * filtros.
 *
 * Server Component a propósito: la fecha relativa se calcula una vez en el
 * servidor, que es donde está el pedido, y la lista no tiene nada que hacer en
 * el cliente.
 */
export function ActividadReciente({
  registro,
}: {
  registro: RegistroDelPanel[];
}): React.ReactElement {
  const ahora = new Date();

  return (
    <SeccionPanel
      id="actividad-reciente"
      titulo="Actividad reciente"
      bajada="Del registro de auditoría."
      acciones={
        <Link
          href="/admin/auditoria"
          className="pressable inline-flex items-center gap-1 rounded-panel-3 text-panel-sm font-semibold text-accent hover:text-accent-strong"
        >
          Ver todo
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      }
    >
      {registro.length === 0 ? (
        <EstadoVacio ilustracion="auditoria">
          Todavía no hay movimientos anotados.
        </EstadoVacio>
      ) : (
        <ol className="grid gap-2">
          {registro.map((r) => (
            <li
              key={r.id}
              className="relative overflow-hidden rounded-panel-2 bg-panel-tarjeta-2 py-2.5 pr-3 pl-4"
            >
              {/* El filete marca lo grave —un borrado, un bloqueo— igual que
                  en Auditoría; en las demás queda del color del borde para
                  que todas alineen. La palabra la dice el resumen. */}
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-1"
                style={{
                  background: r.grave
                    ? "var(--grafico-alerta)"
                    : "var(--panel-borde)",
                }}
              />
              <p className="line-clamp-2 text-panel-sm text-panel-tinta">
                {r.resumen}
              </p>
              <p className="mt-0.5 text-panel-xs text-panel-tinta-3">
                {r.autorNombre} ·{" "}
                <time dateTime={r.fecha}>{tiempoRelativo(r.fecha, ahora)}</time>
              </p>
            </li>
          ))}
        </ol>
      )}
    </SeccionPanel>
  );
}
