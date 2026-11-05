"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  CircleStop,
  FlaskConical,
  Undo2,
} from "lucide-react";
import {
  cancelarProgramacionAction,
  detenerEnvioAction,
} from "@/app/admin/newsletter/acciones";
import {
  Aviso,
  PaginadoNumerado,
  Pildora,
  SeccionPanel,
  TABLA,
  ZonaDeTabla,
  clasesDeBoton,
} from "@/components/admin/piezas";
import { BotonActualizar } from "@/components/admin/boton-actualizar";
import { VistaPrevia } from "@/components/admin/editor-boletin";
import { fechaLegible, horaLegible } from "@/lib/newsletter/cola";
import { tiempoRelativo } from "@/lib/utils";

/**
 * Lo que se ve de un newsletter que ya no es borrador: cuándo sale o salió, a
 * cuántos les llegó, a quién no y por qué, y el correo tal cual se mandó.
 *
 * Los números son los de la cola, sin redondear ni estimar: "enviado" quiere
 * decir que el servidor de correo lo aceptó. Si después rebotó en el buzón de
 * la persona, eso hoy no se sabe, y la pantalla no lo afirma.
 */

export type EstadoDelBoletin =
  | "programado"
  | "enviando"
  | "enviado"
  | "cancelado";

export interface DatosDelSeguimiento {
  id: string;
  asunto: string;
  preencabezado: string;
  estado: EstadoDelBoletin;
  programadoPara: string | null;
  programadoPorNombre: string | null;
  envioIniciadoEn: string | null;
  envioTerminadoEn: string | null;
  canceladoEn: string | null;
  canceladoPorNombre: string | null;
  motivoCancelacion: string | null;
  destinatarios: number | null;
  cuentas: {
    enviado: number;
    simulado: number;
    pendiente: number;
    enviando: number;
    fallido: number;
    omitido: number;
    cancelado: number;
  };
  problemas: {
    nombre: string;
    email: string;
    estado: "fallido" | "pendiente";
    intentos: number;
    error: string | null;
    proximoIntento: string;
  }[];
  totalProblemas: number;
  pagina: number;
  porPagina: number;
  html: string;
  /** La hora programada ya llegó o llega en un minuto. Lo calcula el
   *  servidor: con el reloj del navegador, servidor y cliente podrían no
   *  coincidir al hidratar. */
  inminente: boolean;
  /** Lo recibirían hoy, para un programado. */
  activasHoy: number;
  envioReal: boolean;
}

const ESTADOS: Record<EstadoDelBoletin, { nombre: string; tono: string }> = {
  programado: { nombre: "Programado", tono: "var(--grafico-diario)" },
  enviando: { nombre: "Saliendo", tono: "var(--grafico-indice)" },
  enviado: { nombre: "Enviado", tono: "var(--grafico-nota)" },
  cancelado: { nombre: "Detenido", tono: "var(--grafico-alerta)" },
};

const NUMERO = new Intl.NumberFormat("es-AR");

export function SeguimientoEnvio({ datos }: { datos: DatosDelSeguimiento }) {
  const router = useRouter();
  const ruta = usePathname();
  const [enCurso, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const c = datos.cuentas;
  const total = datos.destinatarios ?? 0;
  const llegaron = c.enviado + c.simulado;
  const resueltos = llegaron + c.fallido + c.omitido + c.cancelado;
  const porcentaje = total > 0 ? Math.round((resueltos / total) * 100) : 100;
  const practica = c.simulado > 0 || (!datos.envioReal && datos.estado === "programado");

  function cancelarProgramacion() {
    setError(null);
    iniciar(async () => {
      try {
        const r = await cancelarProgramacionAction(datos.id);
        if (!r.ok) setError(r.error ?? "No se pudo cancelar.");
        router.refresh();
      } catch {
        setError("No se pudo hablar con el servidor.");
      }
    });
  }

  function detener() {
    setError(null);
    iniciar(async () => {
      try {
        const r = await detenerEnvioAction(datos.id);
        if (!r.ok) setError(r.error ?? "No se pudo detener.");
        setConfirmando(false);
        router.refresh();
      } catch {
        setError("No se pudo hablar con el servidor.");
      }
    });
  }

  const totalPaginas = Math.max(1, Math.ceil(datos.totalProblemas / datos.porPagina));

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
        <SeccionPanel
          id="nl-estado"
          titulo={datos.asunto}
          bajada={
            datos.programadoPorNombre
              ? `Lo mandó ${datos.programadoPorNombre}.`
              : undefined
          }
        >
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Pildora tono={ESTADOS[datos.estado].tono} enfasis>
                {ESTADOS[datos.estado].nombre}
              </Pildora>
              {(datos.estado === "enviando" || datos.estado === "programado") && (
                <BotonActualizar />
              )}
            </div>

            {practica && (
              <Aviso icono={FlaskConical} tono="var(--grafico-diario)" sobre="tarjeta">
                <strong className="font-semibold text-panel-tinta">
                  Envío de práctica:
                </strong>{" "}
                recorre la lista, pero no le llega a nadie.
              </Aviso>
            )}
            {error && (
              <Aviso icono={AlertTriangle} tono="var(--grafico-alerta)" sobre="tarjeta" rol="alert">
                {error}
              </Aviso>
            )}

            {datos.estado === "programado" && datos.programadoPara && (
              <>
                <p className="flex items-center gap-2 text-panel-base text-panel-tinta">
                  <CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {datos.inminente
                    ? "Sale en el próximo minuto."
                    : `Sale el ${fechaLegible(datos.programadoPara)} (hora de Tucumán).`}
                </p>
                <p className="text-panel-sm text-panel-tinta-2">
                  Hoy lo recibirían {NUMERO.format(datos.activasHoy)}{" "}
                  {datos.activasHoy === 1 ? "persona" : "personas"}. La lista
                  se toma a la hora de salir: quien confirme antes también lo
                  recibe.
                </p>
                <div>
                  <button
                    type="button"
                    onClick={cancelarProgramacion}
                    disabled={enCurso}
                    className={clasesDeBoton()}
                  >
                    <Undo2 className="h-4 w-4" aria-hidden="true" />
                    {enCurso ? "Un momento…" : "Cancelar y volver a editar"}
                  </button>
                </div>
              </>
            )}

            {datos.estado !== "programado" && (
              <>
                <div>
                  <div className="flex items-baseline justify-between gap-3 text-panel-sm text-panel-tinta-2">
                    <span>
                      {practica ? "Recorridos" : "Le llegó a"}{" "}
                      <strong className="text-panel-tinta">
                        {NUMERO.format(llegaron)}
                      </strong>{" "}
                      de {NUMERO.format(total)}
                    </span>
                    <span aria-hidden="true">{porcentaje}% hecho</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="Avance del envío"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={porcentaje}
                    className="mt-2 h-2 overflow-hidden rounded-full bg-panel-tarjeta-2"
                  >
                    <div
                      className="h-full bg-accent"
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-panel-sm sm:grid-cols-3">
                  {[
                    [practica ? "Recorridos" : "Enviados", llegaron],
                    ["Esperando", c.pendiente + c.enviando],
                    ["No salieron", c.fallido],
                    ["Se dieron de baja antes", c.omitido],
                    ["Quedaron sin enviar", c.cancelado],
                  ].map(([nombre, valor]) => (
                    <div key={nombre as string}>
                      <dt className="text-panel-tinta-3">{nombre}</dt>
                      <dd className="font-semibold text-panel-tinta">
                        {NUMERO.format(valor as number)}
                      </dd>
                    </div>
                  ))}
                </dl>

                <p className="text-panel-sm text-panel-tinta-3">
                  {datos.envioIniciadoEn &&
                    `Empezó ${tiempoRelativo(datos.envioIniciadoEn)}.`}{" "}
                  {datos.estado === "enviado" &&
                    datos.envioTerminadoEn &&
                    `Terminó ${tiempoRelativo(datos.envioTerminadoEn)}.`}{" "}
                  {datos.estado === "cancelado" &&
                    (datos.motivoCancelacion ??
                      (datos.canceladoPorNombre
                        ? `Lo detuvo ${datos.canceladoPorNombre}.`
                        : ""))}
                  {datos.estado === "enviando" &&
                    "Sale de a tandas, unas 700 personas por hora. Si a alguien no le sale por un problema pasajero, se reintenta solo."}
                </p>
              </>
            )}

            {datos.estado === "enviando" && (
              <div className="border-t border-panel-borde pt-4">
                {!confirmando ? (
                  <button
                    type="button"
                    onClick={() => setConfirmando(true)}
                    className={clasesDeBoton({ tono: "destructivo", tamano: "chico" })}
                  >
                    <CircleStop className="h-3.5 w-3.5" aria-hidden="true" />
                    Detener el envío
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-panel-sm text-panel-tinta-2">
                      ¿Detenerlo? A quien ya le llegó, le llegó; a{" "}
                      {NUMERO.format(c.pendiente)} no les va a llegar. No se
                      puede retomar.
                    </span>
                    <button
                      type="button"
                      onClick={detener}
                      disabled={enCurso}
                      className={clasesDeBoton({ tono: "destructivo", tamano: "chico" })}
                    >
                      Sí, detener
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmando(false)}
                      className={clasesDeBoton({ tono: "fantasma", tamano: "chico" })}
                    >
                      No
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </SeccionPanel>

        {datos.totalProblemas > 0 && (
          <SeccionPanel
            id="nl-problemas"
            titulo="A quiénes no les llegó todavía"
            bajada="Los que fallaron y los que esperan un nuevo intento."
          >
            <ZonaDeTabla
              id="zona-tabla-problemas"
              nombre="Destinatarios con problemas. Si la tabla es más ancha que la pantalla, se desplaza al costado con las flechas."
            >
              <table className={`${TABLA.tabla} min-w-[40rem]`}>
                <caption className="sr-only">
                  Destinatarios a los que todavía no les llegó el newsletter.
                </caption>
                <thead>
                  <tr>
                    {["Persona", "Qué pasó", "Intentos"].map((t) => (
                      <th key={t} scope="col" className={TABLA.cabecera}>
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {datos.problemas.map((p) => (
                    <tr key={p.email} className={TABLA.fila}>
                      <td className={TABLA.celda}>
                        <span className="block font-medium text-panel-tinta">{p.nombre}</span>
                        <span className="block text-panel-tinta-3">{p.email}</span>
                      </td>
                      <td className={TABLA.celda}>
                        {p.error ?? "—"}
                        {p.estado === "pendiente" && (
                          <span className="block text-panel-tinta-3">
                            Se reintenta a las {horaLegible(p.proximoIntento)}.
                          </span>
                        )}
                      </td>
                      <td className={TABLA.celda}>{p.intentos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ZonaDeTabla>
            <PaginadoNumerado
              pagina={datos.pagina}
              totalPaginas={totalPaginas}
              alIr={(n) => router.push(`${ruta}?pagina=${n}`, { scroll: false })}
              etiqueta="Páginas de destinatarios con problemas"
              resumen={
                <>
                  {(datos.pagina - 1) * datos.porPagina + 1}–
                  {(datos.pagina - 1) * datos.porPagina + datos.problemas.length} de{" "}
                  {NUMERO.format(datos.totalProblemas)}
                </>
              }
            />
          </SeccionPanel>
        )}
      </div>

      <div className="min-w-0 xl:sticky xl:top-6">
        <VistaPrevia
          html={datos.html}
          asunto={datos.asunto}
          preencabezado={datos.preencabezado}
          vacio={false}
        />
      </div>
    </div>
  );
}
