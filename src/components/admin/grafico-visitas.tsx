import { diaCorto, diaLargo, techoLindo } from "@/components/admin/graficos-migue";

/**
 * Visitas por día: una barra por día, de los últimos 30.
 *
 * Una sola serie, así que no hay leyenda: el título de la sección dice qué es.
 * Barras y no línea porque cada día es una cuenta cerrada, no un valor que
 * fluye; y un día en cero tiene que verse como hueco, no como una pendiente.
 *
 * El color es `--grafico-nota`, el mismo dato-principal que los gráficos de
 * Migue: ya tiene el contraste medido contra la tarjeta clara y la oscura.
 * Ningún número va en el color de la serie: los textos van en tinta.
 *
 * El detalle de cada día aparece al pasar el mouse. Para el teclado y los
 * lectores de pantalla está la tabla desplegable de abajo, con todos los
 * valores: el gráfico entero es una imagen con su nombre. Sin JavaScript: es
 * CSS.
 */
export function GraficoVisitas({
  serie,
}: {
  serie: { dia: string; cantidad: number }[];
}) {
  const techo = techoLindo(Math.max(0, ...serie.map((d) => d.cantidad)));
  const NUMERO = new Intl.NumberFormat("es-AR");
  const rotulos = new Set([0, Math.floor((serie.length - 1) / 2), serie.length - 1]);

  return (
    <figure className="font-sans">
      <div className="flex gap-2">
        {/* El eje: el techo, la mitad y el cero. Recesivo, en tinta apagada. */}
        <div
          aria-hidden="true"
          className="flex h-48 w-10 shrink-0 flex-col justify-between text-right text-panel-xs leading-none text-panel-tinta-3"
        >
          <span>{NUMERO.format(techo)}</span>
          <span>{NUMERO.format(techo / 2)}</span>
          <span>0</span>
        </div>

        <div className="min-w-0 flex-1">
          <div
            role="img"
            aria-label={`Visitas por día de los últimos ${serie.length} días. El detalle está en la tabla de abajo.`}
            className="relative flex h-48 items-end gap-[2px] border-b border-panel-borde"
          >
            {/* Las líneas de la mitad y del techo, apenas marcadas. */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-panel-borde" />
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-panel-borde" />

            {serie.map((d, i) => {
              const alto = techo > 0 ? (d.cantidad / techo) * 100 : 0;
              const texto = `${diaLargo(d.dia)}: ${NUMERO.format(d.cantidad)} ${d.cantidad === 1 ? "visita" : "visitas"}`;
              return (
                <div
                  key={d.dia}
                  // La columna entera es el blanco del mouse, no sólo la
                  // barra: un día con dos visitas tiene una barra de tres
                  // píxeles.
                  className="group relative flex h-full min-w-0 flex-1 items-end"
                >
                  {d.cantidad > 0 && (
                    <span
                      aria-hidden="true"
                      className="block w-full rounded-t-[4px] group-hover:opacity-80"
                      style={{
                        height: `${Math.max(alto, 1.5)}%`,
                        background: "var(--grafico-nota)",
                      }}
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute bottom-full z-10 mb-2 hidden whitespace-nowrap rounded-panel-3 border border-panel-borde bg-panel-tarjeta px-2.5 py-1.5 text-panel-xs text-panel-tinta shadow-panel group-hover:block ${
                      // En la mitad derecha el cartel se abre hacia la izquierda: centrado,
                      // el de los últimos días se salía de la tarjeta.
                      i >= serie.length / 2 ? "right-0" : "left-0"
                    }`}
                  >
                    {texto}
                  </span>
                </div>
              );
            })}
          </div>

          <div aria-hidden="true" className="mt-1.5 flex gap-[2px] text-panel-xs leading-none text-panel-tinta-3">
            {serie.map((d, i) => (
              <span
                key={d.dia}
                className={`min-w-0 flex-1 whitespace-nowrap ${
                  i === serie.length - 1 ? "text-right" : i === 0 ? "text-left" : "text-center"
                }`}
              >
                {rotulos.has(i) ? diaCorto(d.dia) : ""}
              </span>
            ))}
          </div>
        </div>
      </div>

      <details className="mt-4 text-panel-sm">
        <summary className="cursor-pointer text-panel-tinta-2 hover:text-panel-tinta">
          Ver los números día por día
        </summary>
        <table className="mt-2 w-full border-collapse text-panel-sm">
          <caption className="sr-only">Visitas por día</caption>
          <thead>
            <tr>
              <th scope="col" className="py-1 text-left font-medium text-panel-tinta-3">Día</th>
              <th scope="col" className="py-1 text-right font-medium text-panel-tinta-3">Visitas</th>
            </tr>
          </thead>
          <tbody>
            {[...serie].reverse().map((d) => (
              <tr key={d.dia} className="border-t border-panel-borde">
                <td className="py-1 text-panel-tinta">{diaLargo(d.dia)}</td>
                <td className="py-1 text-right tabular-nums text-panel-tinta">{NUMERO.format(d.cantidad)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
