import Link from "next/link";
import { SeccionPanel, TABLA, ZonaDeTabla } from "@/components/admin/piezas";
import { PaginasPorUrl } from "@/components/admin/paginas-por-url";
import { fechaLegible } from "@/lib/newsletter/cola";
import type {
  EnvioEnHistorial,
  ResumenDeSuscripciones,
} from "@/lib/newsletter/estadisticas";

const NUMERO = new Intl.NumberFormat("es-AR");

/**
 * «Cómo viene»: los números del newsletter que de verdad se saben (ver
 * `lib/newsletter/estadisticas.ts`). Donde no hay dato, lo dice con palabras
 * en vez de mostrar un cero que parece una medición.
 */
export function EstadisticasNewsletter({
  suscripciones,
  historial,
  pagina,
  porPagina,
}: {
  suscripciones: ResumenDeSuscripciones;
  historial: { filas: EnvioEnHistorial[]; total: number };
  pagina: number;
  porPagina: number;
}) {
  return (
    <SeccionPanel
      id="estadisticas"
      titulo="Cómo viene"
      bajada={`Los últimos ${suscripciones.dias} días, y cada envío. Sólo lo que se sabe: no se miden aperturas ni clics.`}
    >
      <div className="grid gap-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-panel-sm sm:grid-cols-4">
          {[
            ["Se anotaron", suscripciones.altas],
            ["Confirmaron", suscripciones.confirmaciones],
            ["Se dieron de baja", suscripciones.bajas],
          ].map(([nombre, valor]) => (
            <div key={nombre as string}>
              <dt className="text-panel-tinta-3">{nombre}</dt>
              <dd className="text-panel-lg font-semibold text-panel-tinta">
                {NUMERO.format(valor as number)}
              </dd>
            </div>
          ))}
          <div>
            <dt className="text-panel-tinta-3">Confirmaron de los nuevos</dt>
            <dd className="text-panel-tinta">
              {suscripciones.confirmaronDeLasAltas ? (
                <>
                  <span className="text-panel-lg font-semibold">
                    {NUMERO.format(suscripciones.confirmaronDeLasAltas.confirmaron)}
                  </span>{" "}
                  de {NUMERO.format(suscripciones.confirmaronDeLasAltas.de)}
                </>
              ) : (
                <span className="text-panel-tinta-3">
                  Nadie se anotó en este período
                </span>
              )}
            </dd>
          </div>
        </dl>

        {historial.total === 0 ? (
          <p className="text-panel-sm text-panel-tinta-3">
            Todavía no salió ningún newsletter: cuando salga el primero,
            acá va a estar a cuántos les llegó.
          </p>
        ) : (
          <>
            <ZonaDeTabla
              id="zona-tabla-envios"
              nombre="Envíos del newsletter. Si la tabla es más ancha que la pantalla, se desplaza al costado con las flechas."
            >
              <table className={`${TABLA.tabla} min-w-[46rem]`}>
                <caption className="sr-only">
                  Cada newsletter que salió, del más nuevo al más viejo.
                </caption>
                <thead>
                  <tr>
                    {["Newsletter", "Salió", "Le llegó a", "No salió", "Bajas en la semana"].map((t) => (
                      <th key={t} scope="col" className={TABLA.cabecera}>
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historial.filas.map((f) => (
                    <tr key={f.id} className={TABLA.fila}>
                      <td className={TABLA.celda}>
                        <Link
                          href={`/admin/newsletter/${f.id}`}
                          className="font-medium text-panel-tinta hover:text-accent hover:underline"
                        >
                          {f.asunto}
                        </Link>
                        {f.simulados > 0 && (
                          <span className="block text-panel-xs text-panel-tinta-3">
                            De práctica: no le llegó a nadie
                          </span>
                        )}
                        {f.estado === "cancelado" && (
                          <span className="block text-panel-xs text-panel-tinta-3">
                            Se detuvo; {NUMERO.format(f.cancelados)} sin recibirlo
                          </span>
                        )}
                      </td>
                      <td className={`${TABLA.celda} whitespace-nowrap`}>
                        {fechaLegible(f.iniciado)}
                      </td>
                      <td className={TABLA.celda}>
                        {f.simulados > 0 && f.enviados === 0
                          ? "—"
                          : `${NUMERO.format(f.enviados)} de ${NUMERO.format(f.destinatarios)}`}
                      </td>
                      <td className={TABLA.celda}>
                        {NUMERO.format(f.fallidos)}
                        {f.omitidos > 0 && (
                          <span className="block text-panel-xs text-panel-tinta-3">
                            y {NUMERO.format(f.omitidos)} que se dieron de baja antes
                          </span>
                        )}
                      </td>
                      <td className={TABLA.celda}>
                        {NUMERO.format(f.bajasEnLaSemana)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ZonaDeTabla>
            <PaginasPorUrl
              parametro="envios"
              pagina={pagina}
              totalPaginas={Math.ceil(historial.total / porPagina)}
              etiqueta="Páginas de envíos"
            />
          </>
        )}

        <p className="text-panel-xs text-panel-tinta-3">
          «Le llegó a» cuenta los correos que salieron del diario. Si
          después alguno rebotó en el buzón de la persona, eso no se ve
          acá. «Bajas en la semana» son las personas que se dieron de baja
          con el enlace de un correo en los 7 días siguientes al envío.
        </p>
      </div>
    </SeccionPanel>
  );
}
