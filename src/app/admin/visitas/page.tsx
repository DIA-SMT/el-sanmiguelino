import Link from "next/link";
import { CalendarDays, CalendarRange, Eye, Sigma } from "lucide-react";
import {
  BannerPanel,
  EstadoVacio,
  SeccionPanel,
  TABLA,
  TarjetaDato,
  ZonaDeTabla,
} from "@/components/admin/piezas";
import { GraficoVisitas } from "@/components/admin/grafico-visitas";
import { PaginasPorUrl } from "@/components/admin/paginas-por-url";
import { requerirAdmin } from "@/lib/auth/dal";
import { fechaHablada } from "@/lib/fecha-edicion";
import {
  notasMasLeidas,
  resumenDeVisitas,
  visitasPorDia,
  visitasPorEdicion,
} from "@/lib/repos/visitas";

export const metadata = { title: "Visitas" };

const POR_PAGINA = 15;
const NUMERO = new Intl.NumberFormat("es-AR");

/**
 * Cuánto se lee el diario: visitas por día, las notas más leídas y cada
 * edición.
 *
 * Los números son de páginas abiertas, no de personas: el contador no
 * reconoce a nadie (ver `repos/visitas.ts`), así que la pantalla nunca dice
 * "lectores". Empieza a contar el día que se publicó; lo anterior no existe.
 */
export default async function AdminVisitas({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  await requerirAdmin();
  const { pagina: crudo } = await searchParams;
  const pedida = Math.max(1, Math.floor(Number(crudo)) || 1);

  const [resumen, serie, primera, ediciones] = await Promise.all([
    resumenDeVisitas(),
    visitasPorDia(30),
    notasMasLeidas(pedida, POR_PAGINA),
    visitasPorEdicion(),
  ]);
  const ultima = Math.max(1, Math.ceil(primera.total / POR_PAGINA));
  const pagina = Math.min(pedida, ultima);
  const notas = pedida > ultima ? await notasMasLeidas(ultima, POR_PAGINA) : primera;

  return (
    <>
      <BannerPanel
        titulo="Visitas"
        bajada="Cuántas veces se abrieron las páginas del diario. No cuenta robots ni a quienes administran el panel."
      />

      {resumen.desde === null ? (
        <EstadoVacio ilustracion="estadisticas">
          Todavía no hay visitas. El contador empieza a sumar desde que se
          publicó: en cuanto alguien abra el diario, aparecen acá.
        </EstadoVacio>
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TarjetaDato
              icono={Eye}
              color="azul"
              titulo="Hoy"
              valor={NUMERO.format(resumen.hoy)}
              nota="Desde la medianoche"
            />
            <TarjetaDato
              icono={CalendarDays}
              color="celeste"
              titulo="Últimos 7 días"
              valor={NUMERO.format(resumen.ultimos7)}
            />
            <TarjetaDato
              icono={CalendarRange}
              color="celeste"
              titulo="Últimos 30 días"
              valor={NUMERO.format(resumen.ultimos30)}
            />
            <TarjetaDato
              icono={Sigma}
              color="oro"
              titulo="En total"
              valor={NUMERO.format(resumen.total)}
              nota={`Desde el ${fechaHablada(new Date(`${resumen.desde}T12:00:00Z`))}`}
            />
          </div>

          <SeccionPanel
            id="visitas-por-dia"
            titulo="Visitas por día"
            bajada="Los últimos 30 días. Pasá el mouse por una barra para ver el número."
          >
            <GraficoVisitas serie={serie} />
          </SeccionPanel>

          <SeccionPanel
            id="notas-mas-leidas"
            titulo="Las notas más leídas"
            bajada="Ordenadas por los últimos 30 días."
          >
            {notas.total === 0 ? (
              <p className="text-panel-sm text-panel-tinta-3">
                Todavía nadie abrió una nota.
              </p>
            ) : (
              <>
                <ZonaDeTabla
                  id="zona-tabla-notas-leidas"
                  nombre="Notas más leídas. Si la tabla es más ancha que la pantalla, se desplaza al costado con las flechas."
                >
                  <table className={`${TABLA.tabla} min-w-[36rem]`}>
                    <caption className="sr-only">
                      Notas más leídas en los últimos 30 días, con el total.
                    </caption>
                    <thead>
                      <tr>
                        {["Nota", "Últimos 30 días", "En total"].map((t) => (
                          <th key={t} scope="col" className={TABLA.cabecera}>
                            {t}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {notas.filas.map((n) => (
                        <tr key={n.slug} className={TABLA.fila}>
                          <td className={TABLA.celda}>
                            <Link
                              href={`/nota/${n.slug}`}
                              className="font-medium text-panel-tinta hover:text-accent hover:underline"
                            >
                              {n.titulo}
                            </Link>
                            <span className="block text-panel-xs text-panel-tinta-3">
                              {n.edicion}
                            </span>
                          </td>
                          <td className={`${TABLA.celda} tabular-nums`}>
                            {NUMERO.format(n.ultimos30)}
                          </td>
                          <td className={`${TABLA.celda} tabular-nums`}>
                            {NUMERO.format(n.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ZonaDeTabla>
                <PaginasPorUrl
                  parametro="pagina"
                  pagina={pagina}
                  totalPaginas={ultima}
                  etiqueta="Páginas de notas más leídas"
                />
              </>
            )}
          </SeccionPanel>

          <SeccionPanel
            id="visitas-por-edicion"
            titulo="Por edición"
            bajada="Todas las visitas a sus notas y a su página, desde que hay contador."
          >
            <ul className="divide-y divide-panel-borde">
              {ediciones.map((e) => (
                <li key={e.edicion} className="flex items-center justify-between gap-3 py-2.5 text-panel-sm">
                  <span className="text-panel-tinta">{e.edicion}</span>
                  <span className="font-semibold tabular-nums text-panel-tinta">
                    {NUMERO.format(e.visitas)}
                  </span>
                </li>
              ))}
            </ul>
          </SeccionPanel>

          <p className="text-panel-xs text-panel-tinta-3">
            Una visita es una página abierta. Si la misma persona vuelve a la
            misma página al otro día, cuenta otra vez; si la recarga enseguida,
            no. El contador no sabe quién lee, así que no puede decir cuántas
            personas distintas fueron.
          </p>
        </div>
      )}
    </>
  );
}
