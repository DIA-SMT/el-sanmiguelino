"use client";

import { useId, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  ChipFiltro,
  PaginadoNumerado,
  Pildora,
  clasesDeBoton,
  clasesDeCampo,
} from "@/components/admin/piezas";
import type { RegistroDelPanel } from "@/lib/repos/auditoria";
import { cn, tiempoRelativo } from "@/lib/utils";

/**
 * El registro de actividad del panel.
 *
 * Cada fila ya viene escrita del servidor —`resumen`—, y eso no es pereza: la
 * frase se arma cuando pasa la cosa, con los datos a la vista, porque después
 * pueden no existir. "Borró el comentario de Juan Pérez" no se puede componer
 * más tarde: el comentario no está y ese es justamente el caso que hay que
 * poder explicar.
 *
 * El filtrado es en memoria, sobre la tanda que llegó. Mismo criterio que la
 * lista de usuarios y la tabla de consultas de Migue: para este volumen, meter
 * el filtro en la URL sería una vuelta al servidor por cada tecla.
 */

/** Cuántas filas por página. Cada una es un renglón y medio, así que entran
 *  más que en la lista de usuarios. */
const POR_PAGINA = 30;

/**
 * Los nombres de pantalla de cada clase de cosa, y su color.
 *
 * Son sólo rótulos: la lista de acciones y a qué objeto pertenece cada una vive
 * en `repos/auditoria.ts`, que es servidor. Acá no se decide nada, se traduce
 * para mostrar — si aparece un objeto que este mapa no conoce, se muestra su
 * clave cruda y sin color, que es mejor que esconder la fila.
 */
const OBJETOS: Record<string, { nombre: string; color: string }> = {
  comentario: { nombre: "Comentarios", color: "var(--grafico-nota)" },
  usuario: { nombre: "Usuarios", color: "var(--grafico-indice)" },
  edicion: { nombre: "Ediciones", color: "var(--grafico-diario)" },
  nota: { nombre: "Notas", color: "var(--grafico-acento)" },
  suscripciones: { nombre: "Suscripciones", color: "var(--grafico-alerta)" },
};

/** Fecha completa: acá el "hace 3 h" no alcanza. Un registro de auditoría se
 *  lee para reconstruir qué pasó y cuándo, y para eso hace falta el instante,
 *  en hora de Tucumán como todo el resto del panel. */
const FECHA = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Tucuman",
  day: "numeric",
  month: "numeric",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

function fechaCorta(iso: string): string {
  const p = new Map(
    FECHA.formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  const dia = (p.get("day") ?? "").padStart(2, "0");
  const mes = (p.get("month") ?? "").padStart(2, "0");
  const hora = (p.get("hour") ?? "").padStart(2, "0");
  const minuto = (p.get("minute") ?? "").padStart(2, "0");
  return `${dia}/${mes}, ${hora}:${minuto}`;
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function RegistroPanelLista({
  registro,
  total,
}: {
  registro: RegistroDelPanel[];
  /** El total de la base, que puede ser mayor que la tanda que llegó. */
  total: number;
}) {
  const idBuscador = useId();
  const idLista = useId();
  const [busqueda, setBusqueda] = useState("");
  const [objeto, setObjeto] = useState<string | null>(null);
  const [soloGraves, setSoloGraves] = useState(false);
  const [pagina, setPagina] = useState(1);

  function buscar(texto: string) {
    setBusqueda(texto);
    setPagina(1);
  }

  function filtrarPor(clave: string | null) {
    setObjeto(clave);
    setPagina(1);
  }

  function alternarGraves() {
    setSoloGraves((v) => !v);
    setPagina(1);
  }

  /* Se busca sobre el resumen, el nombre de quien lo hizo y el identificador
     de la cosa tocada: son las tres formas en que alguien llega a este registro
     —"qué pasó con tal comentario", "qué tocó fulano", "qué le hicieron a la
     edición de septiembre"—. */
  const porBusqueda = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return registro;
    return registro.filter(
      (r) =>
        normalizar(r.resumen).includes(q) ||
        normalizar(r.autorNombre).includes(q) ||
        (r.objetoId ?? "").toLowerCase().includes(q),
    );
  }, [registro, busqueda]);

  /** Las clases de cosa que de verdad aparecen en la tanda. Un chip que promete
   *  cero filas es una pregunta sin respuesta para quien mira. */
  const presentes = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const r of porBusqueda) {
      cuenta.set(r.objeto, (cuenta.get(r.objeto) ?? 0) + 1);
    }
    return [...cuenta.entries()];
  }, [porBusqueda]);

  const graves = useMemo(
    () => porBusqueda.filter((r) => r.grave).length,
    [porBusqueda],
  );

  const filtradas = useMemo(
    () =>
      porBusqueda.filter(
        (r) => (!objeto || r.objeto === objeto) && (!soloGraves || r.grave),
      ),
    [porBusqueda, objeto, soloGraves],
  );

  const hayFiltro = busqueda.trim() !== "" || objeto !== null || soloGraves;
  const recortado = total > registro.length;

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const primeraFila = (paginaActual - 1) * POR_PAGINA;
  const enPantalla = filtradas.slice(primeraFila, primeraFila + POR_PAGINA);

  function irA(destino: number) {
    setPagina(Math.min(Math.max(destino, 1), totalPaginas));
    document.getElementById(idLista)?.scrollIntoView({ block: "start" });
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="relative min-w-[13rem] flex-1 sm:max-w-xs">
          <label htmlFor={idBuscador} className="sr-only">
            Buscar en el registro
          </label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-panel-tinta-3"
            aria-hidden="true"
          />
          <input
            id={idBuscador}
            type="search"
            value={busqueda}
            onChange={(e) => buscar(e.target.value)}
            placeholder="Buscar por qué pasó o por quién"
            className={cn(clasesDeCampo("tarjeta"), "pl-9")}
          />
        </div>

        <div className="flex flex-wrap gap-panel-controles">
          <ChipFiltro
            cuenta={porBusqueda.length}
            activo={objeto === null}
            onClick={() => filtrarPor(null)}
          >
            Todo
          </ChipFiltro>
          {presentes.map(([clave, cuenta]) => (
            <ChipFiltro
              key={clave}
              cuenta={cuenta}
              color={OBJETOS[clave]?.color}
              activo={objeto === clave}
              onClick={() => filtrarPor(objeto === clave ? null : clave)}
            >
              {OBJETOS[clave]?.nombre ?? clave}
            </ChipFiltro>
          ))}
        </div>
      </div>

      {/* El filtro que de verdad se usa cuando algo falta: se llevó algo puesto.
          Va aparte de los otros chips porque cruza todas las clases de cosa —un
          borrado de comentario y una descarga del padrón no comparten objeto—,
          y mezclarlo con ellos haría creer que es uno más de la misma lista. */}
      {graves > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-panel-xs font-medium text-panel-tinta-3">
            Además
          </span>
          <ChipFiltro
            cuenta={graves}
            color="var(--grafico-alerta)"
            activo={soloGraves}
            onClick={alternarGraves}
          >
            Sólo lo que se llevó algo
          </ChipFiltro>
        </div>
      )}

      <p
        aria-live="polite"
        className="text-panel-xs tabular-nums text-panel-tinta-3"
      >
        {recortado ? (
          <>
            {filtradas.length} de las {registro.length} últimas · {total} en
            total
          </>
        ) : (
          <>
            {filtradas.length} de {total}{" "}
            {total === 1 ? "movimiento" : "movimientos"}
          </>
        )}
        {hayFiltro ? " · hay un filtro puesto" : ""}
      </p>

      {filtradas.length === 0 ? (
        <div className="rounded-panel-2 border border-panel-borde bg-panel-tarjeta-2 px-4 py-5 text-center">
          <p className="text-panel-base text-panel-tinta-2">
            {registro.length === 0
              ? "Todavía no hay nada anotado. El registro se llena solo: cada cambio que se haga en el panel deja su renglón."
              : "Ningún movimiento coincide con este filtro."}
          </p>
          {registro.length > 0 && (
            <button
              type="button"
              onClick={() => {
                buscar("");
                filtrarPor(null);
                setSoloGraves(false);
              }}
              className={`${clasesDeBoton({
                tamano: "chico",
                sobre: "hundida",
              })} mt-3`}
            >
              Limpiar el filtro
            </button>
          )}
        </div>
      ) : (
        <ul
          id={idLista}
          className="-mx-4 divide-y divide-panel-borde border-y border-panel-borde sm:-mx-5"
        >
          {enPantalla.map((r) => (
            <li
              key={r.id}
              className={cn(
                "border-l-2 px-4 py-3 sm:px-5",
                r.grave
                  ? "border-l-[var(--grafico-alerta)] bg-panel-tarjeta-2"
                  : "border-l-transparent",
              )}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-panel-base text-panel-tinta">
                  {r.resumen}
                </span>
                {OBJETOS[r.objeto] && (
                  <Pildora
                    tono={OBJETOS[r.objeto].color}
                    sobre={r.grave ? "hundida" : "tarjeta"}
                  >
                    {OBJETOS[r.objeto].nombre}
                  </Pildora>
                )}
              </div>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-panel-xs text-panel-tinta-3">
                <span className="tabular-nums">{fechaCorta(r.fecha)}</span>
                <span aria-hidden="true">·</span>
                <span>{tiempoRelativo(r.fecha)}</span>
                <span aria-hidden="true">·</span>
                {/* El nombre y el id: el nombre para leer, el id porque es lo
                    que aparece en el rastro de un rol cambiado y en los
                    comentarios, así que es lo que permite cruzar. */}
                <span className="text-panel-tinta-2">{r.autorNombre}</span>
                <span className="font-mono">{r.autorId}</span>
                {r.objetoId && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{r.objetoId}</span>
                  </>
                )}
              </p>
              {r.detalle && Object.keys(r.detalle).length > 0 && (
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-panel-xs text-panel-tinta-3">
                  {Object.entries(r.detalle).map(([clave, valor]) => (
                    <span key={clave}>
                      {clave}:{" "}
                      <span className="text-panel-tinta-2">
                        {valor === null || valor === undefined
                          ? "—"
                          : String(valor)}
                      </span>
                    </span>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <PaginadoNumerado
        pagina={paginaActual}
        totalPaginas={totalPaginas}
        alIr={irA}
        etiqueta="Páginas del registro"
        resumen={
          <>
            {primeraFila + 1}–{primeraFila + enPantalla.length} de{" "}
            {filtradas.length}
          </>
        }
      />

      <p role="status" aria-live="polite" className="sr-only">
        {filtradas.length === 0
          ? "Ningún movimiento coincide."
          : `Página ${paginaActual} de ${totalPaginas}. Movimientos ${primeraFila + 1} a ${primeraFila + enPantalla.length} de ${filtradas.length}.`}
      </p>
    </div>
  );
}
