import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  FileText,
  Layers,
  Pencil,
  Plus,
} from "lucide-react";
import {
  Aviso,
  BannerPanel,
  Pildora,
  SeccionPanel,
  TarjetaDato,
  clasesDeBoton,
} from "@/components/admin/piezas";
import { requerirAdmin } from "@/lib/auth/dal";
import { getIndice, getResumenEdicion, repoEscribe } from "@/lib/repos/edicion";

export const metadata = { title: "Notas" };

/**
 * Listado de notas de la edición en curso.
 *
 * Pide permiso por su cuenta aunque el layout ya lo haya hecho: el layout
 * cubre el cromo, no los datos. La regla que dejó la fuga de la etapa 1 es que
 * **el componente que tiene los datos es el que pide permiso**, y acá los
 * títulos de la edición son datos.
 *
 * Cada fila lleva a su editor. Si no hay motor de escritura —sin DATABASE_URL
 * el diario lee del archivo semilla— el listado se degrada a sólo lectura y lo
 * dice, en vez de ofrecer un botón que perdería todo al recargar.
 *
 * La primera nota del índice se marca aparte porque **es la de tapa**: la
 * portada del diario abre con su cuerpo. Eso antes no se veía en ningún lado
 * —las once notas se leían todas iguales— y es justamente el dato que cambia
 * qué encuentra el lector al abrir el diario.
 */
export default async function AdminNotas() {
  await requerirAdmin();
  const puedeEditar = repoEscribe();
  const [edicion, indice] = await Promise.all([
    getResumenEdicion(),
    getIndice(),
  ]);

  const minutos = indice.reduce((total, n) => total + n.minutosLectura, 0);
  const secciones = [...new Set(indice.map((n) => n.seccion))];

  return (
    <>
      <BannerPanel
        titulo="Notas de la edición"
        bajada={
          <>
            {edicion.mes} · N.º {edicion.numero}
            {edicion.tema ? <> · {edicion.tema}</> : null}
          </>
        }
      >
        {puedeEditar && (
          <Link
            href="/admin/nota/nueva"
            className={clasesDeBoton({ tono: "primario" })}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nota nueva
          </Link>
        )}
      </BannerPanel>

      {/* UNA sola escalera vertical para todo el panel: la pila de bloques va
          en un `grid gap-6` y ningún hijo trae su propio `mt-`. Las cinco
          pantallas tenían tres mecanismos distintos —esta grilla, un
          `space-y-*` y cuatro `mt-` sueltos—, y el resultado era que la misma
          fila de tarjetas de dato respiraba distinto según en qué pantalla
          estuviera parado el que mira. El `mb-6` del banner es el mismo
          número, así que la escalera arranca desde arriba. */}
      <div className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TarjetaDato
            icono={FileText}
            color="azul"
            titulo="Notas en la edición"
            valor={String(indice.length)}
            nota="La primera va en la tapa; el resto sale numerado desde la página 2."
          />
          <TarjetaDato
            icono={Clock}
            color="celeste"
            titulo="Minutos de lectura"
            valor={String(minutos)}
            nota="La edición entera, de punta a punta."
          />
          <TarjetaDato
            icono={Layers}
            color="oro"
            titulo={secciones.length === 1 ? "Sección" : "Secciones"}
            valor={String(secciones.length)}
            nota={secciones.join(" · ")}
          />
        </div>

        {/* Que el panel diga en qué estado está es parte de no mentir. Sin motor
            de escritura no se ofrece editar: un botón que promete guardar y
            pierde todo al recargar es peor que no tenerlo. */}
        {puedeEditar ? (
          <Aviso icono={AlertTriangle} tono="var(--grafico-diario)">
            Lo que se guarda acá sale publicado al instante: todavía no hay
            borradores ni historial de versiones. La moderación de comentarios y
            el tablero de Migue son los próximos pasos.
          </Aviso>
        ) : (
          <Aviso icono={AlertTriangle} tono="var(--grafico-alerta)">
            Sólo lectura: no hay base de datos configurada, así que el diario
            está sirviendo el archivo semilla y cualquier cambio se perdería.
            Falta <code className="font-mono">DATABASE_URL</code>.
          </Aviso>
        )}

        <SeccionPanel
          id="paginas-de-la-edicion"
          titulo="Páginas de la edición"
          bajada="En el orden en que las encuentra el lector."
        >
          {/* Una edición recién creada no tiene notas todavía, y es un estado
              normal —se crea el número y se le van cargando—. Con la lista
              vacía la tarjeta quedaba con título y nada abajo, que se lee como
              que algo falló. */}
          {indice.length === 0 && (
            <p className="rounded-panel-2 bg-panel-tarjeta-2 px-4 py-6 text-center text-panel-base text-panel-tinta-2">
              Esta edición todavía no tiene notas.
              {puedeEditar ? " La primera que cargues va a la tapa." : null}
            </p>
          )}

          {/* Las notas van como filas hundidas dentro de la tarjeta, no como
              tarjetas sueltas: son una lista ordenada de once títulos, y once
              tarjetas blancas flotando una debajo de la otra pesan más que la
              lista que representan. Para eso está `--panel-tarjeta-2`. */}
          <ul className="grid gap-2">
            {indice.map((nota, i) => {
              const enTapa = i === 0;
              return (
                <li
                  key={nota.slug}
                  className="relative flex flex-wrap items-center gap-x-4 gap-y-2 overflow-hidden rounded-panel-2 bg-panel-tarjeta-2 py-3 pr-3.5 pl-6"
                >
                  {/* El filete sólo se pinta en la de tapa; en las demás queda
                      del color del borde, para que todas alineen igual y la
                      única que salta sea la que efectivamente es distinta. */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 w-1"
                    style={{
                      background: enTapa
                        ? "var(--grafico-nota)"
                        : "var(--panel-borde)",
                    }}
                  />
                  {/* La marca de tapa NO es una `Pildora`: no lleva caja ni
                      fondo porque es la primera columna de una lista, y tiene
                      que alinear con el "Pág. 3" de las filas de abajo. Una
                      píldora acá desalinearía las once filas para decir lo
                      mismo. La píldora está tres líneas más abajo, donde sí
                      hay un estado. */}
                  {enTapa ? (
                    <span className="inline-flex w-14 shrink-0 items-center gap-1.5 text-panel-xs font-semibold text-panel-tinta">
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: "var(--grafico-nota)" }}
                      />
                      Tapa
                    </span>
                  ) : (
                    <span className="w-14 shrink-0 text-panel-xs font-medium tabular-nums text-panel-tinta-3">
                      Pág. {i + 2}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 basis-56">
                    <Link
                      href={
                        puedeEditar
                          ? `/admin/nota/${nota.slug}`
                          : `/nota/${nota.slug}`
                      }
                      className="text-panel-lg font-semibold text-panel-tinta transition-colors hover:text-accent"
                    >
                      {nota.titulo}
                    </Link>
                    <span className="mt-1 block text-panel-xs text-panel-tinta-3">
                      {nota.seccion} · {nota.minutosLectura} min ·{" "}
                      {/* El slug va en mono pero en el MISMO paso que el resto
                          de la línea: bajarlo medio punto —estaba en 0.68rem—
                          no lo distingue, la tipografía ya lo hace, y le suma
                          un tamaño más a la escala. */}
                      <code className="font-mono">{nota.slug}</code>
                    </span>
                  </span>
                  {puedeEditar ? (
                    /* La fila es `--panel-tarjeta-2`, así que el botón apoya
                       sobre superficie hundida y `sobre="hundida"` le pone el
                       relleno contrario. `shrink-0` se concatena y no se pasa
                       por `cn()`: `cn()` es tailwind-merge sin configurar y se
                       lleva puesto el `text-panel-sm` de la pieza (ver la nota
                       de los botones en `piezas.tsx`). */
                    <Link
                      href={`/admin/nota/${nota.slug}`}
                      className={`${clasesDeBoton({
                        tamano: "chico",
                        sobre: "hundida",
                      })} shrink-0`}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      Editar
                    </Link>
                  ) : (
                    /* La fila es `--panel-tarjeta-2`, así que la píldora apoya
                       sobre superficie hundida y `sobre="hundida"` le pone el
                       fondo contrario. Antes esto era la tercera copia de la
                       píldora escrita a mano en el panel. */
                    <Pildora tono="var(--grafico-nota)" sobre="hundida">
                      Publicada
                    </Pildora>
                  )}
                </li>
              );
            })}
          </ul>
        </SeccionPanel>
      </div>
    </>
  );
}
