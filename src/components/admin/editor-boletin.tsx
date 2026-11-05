"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,
  FlaskConical,
  Maximize2,
  Monitor,
  Plus,
  Save,
  Search,
  Send,
  Smartphone,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  borrarBoletinAction,
  enviarPruebaAction,
  escribirBorradorIAAction,
  guardarBoletinAction,
  programarEnvioAction,
  proponerNotasIAAction,
} from "@/app/admin/newsletter/acciones";
import {
  enTucuman,
  fechaLegible,
  horaDeTucuman,
} from "@/lib/newsletter/cola";
import {
  Aviso,
  ChipFiltro,
  Pildora,
  SeccionPanel,
  clasesDeBoton,
  clasesDeBotonIcono,
  clasesDeCampo,
} from "@/components/admin/piezas";
import { SITIO_URL } from "@/lib/compartir";
import { armarBoletin } from "@/lib/newsletter/plantilla";
import type { Boletin, NotaCandidata } from "@/lib/repos/boletines";
import { cn } from "@/lib/utils";

/**
 * El editor de un newsletter.
 *
 * A la izquierda se arma —asunto, introducción, notas, cierre— y a la derecha
 * se ve el correo, en el ancho de una computadora o de un celular. La vista
 * previa la dibuja `armarBoletin()`, **la misma función que arma el correo que
 * sale**, así que lo que se ve es lo que llega.
 *
 * «Enviar prueba» guarda primero y después manda lo guardado: la prueba nunca
 * puede ser distinta de lo que quedó en la base.
 */

const campo = clasesDeCampo("tarjeta");
const etiqueta = "block text-panel-sm font-medium text-panel-tinta-2";
const ayudaCampo = "mt-1.5 block text-panel-sm text-panel-tinta-3";

const TOPE_ASUNTO = 150;
const TOPE_PRE = 200;
const TOPE_NOTAS = 12;

const BAJA_DE_PRUEBA = `${SITIO_URL.origin}/newsletter/baja?prueba=1`;

/** La última dirección de prueba, en el navegador de cada uno: el que se manda
 *  pruebas se las manda siempre al mismo correo. */
const CLAVE_PRUEBA = "sm-newsletter-prueba";

interface Elegida {
  slug: string;
  /** Texto propio; vacío = la bajada de la nota. */
  resumen: string;
}

/** Sin tildes y en minúscula, para buscar «educacion» y encontrar
 *  «Educación». */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function EditorBoletin({
  boletin,
  candidatas,
  elegidasIniciales,
  faltan,
  destinatarios,
  envioReal,
  iaDisponible = false,
}: {
  boletin: Boletin;
  candidatas: NotaCandidata[];
  /** Las notas del borrador que todavía existen, ya resueltas. */
  elegidasIniciales: NotaCandidata[];
  /** Las que ya no existen: se avisan y se caen al guardar. */
  faltan: string[];
  /** Cuántas suscripciones confirmadas hay hoy. */
  destinatarios: number;
  /** Si el envío a la lista llega de verdad o es de práctica. */
  envioReal: boolean;
  /** Si se puede pedir un borrador con IA. Sin esto, el bloque no aparece. */
  iaDisponible?: boolean;
}) {
  const router = useRouter();

  // Todas las notas que este editor puede dibujar: las del buscador y las del
  // borrador, que pueden ser de una edición vieja que el buscador ya no trae.
  const fichas = useMemo(() => {
    const mapa = new Map<string, NotaCandidata>();
    for (const n of candidatas) mapa.set(n.slug, n);
    for (const n of elegidasIniciales) mapa.set(n.slug, n);
    return mapa;
  }, [candidatas, elegidasIniciales]);

  const inicial = useMemo(
    () => ({
      asunto: boletin.asunto,
      preencabezado: boletin.preencabezado,
      introduccion: boletin.introduccion,
      cierre: boletin.cierre,
      notas: boletin.notas.filter((n) => fichas.has(n.slug)),
    }),
    [boletin, fichas],
  );

  const [asunto, setAsunto] = useState(inicial.asunto);
  const [preencabezado, setPreencabezado] = useState(inicial.preencabezado);
  const [introduccion, setIntroduccion] = useState(inicial.introduccion);
  const [cierre, setCierre] = useState(inicial.cierre);
  const [elegidas, setElegidas] = useState<Elegida[]>(inicial.notas);
  const [guardado, setGuardado] = useState(() => JSON.stringify(inicial));

  const [busqueda, setBusqueda] = useState("");
  const [para, setPara] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<
    | { tipo: "guardado" }
    | { tipo: "prueba"; correoId?: string; enviado: boolean }
    | null
  >(null);
  const [borrando, setBorrando] = useState(false);
  const [enCurso, iniciar] = useTransition();

  // Mandar a la lista: ahora, o a una fecha y hora de Tucumán.
  const [modoEnvio, setModoEnvio] = useState<"ahora" | "programar">("ahora");
  const [fechaEnvio, setFechaEnvio] = useState("");
  const [horaEnvio, setHoraEnvio] = useState("10:00");
  const [confirmandoEnvio, setConfirmandoEnvio] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  // Mañana, de arranque. Después de hidratar: "mañana" depende del reloj de
  // quien mira, y el servidor no tiene por qué coincidir.
  useEffect(() => {
    const t = setTimeout(() => {
      setFechaEnvio(enTucuman(new Date(Date.now() + 86_400_000)).fecha);
    });
    return () => clearTimeout(t);
  }, []);

  const horaElegida =
    modoEnvio === "programar" ? horaDeTucuman(fechaEnvio, horaEnvio) : null;

  const datos = { asunto, preencabezado, introduccion, cierre, notas: elegidas };
  const sinGuardar = JSON.stringify(datos) !== guardado;

  // La dirección de la última prueba. En un setTimeout para no encadenar un
  // render sobre el de la hidratación, como en el resto del sitio.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const previa = localStorage.getItem(CLAVE_PRUEBA);
        if (previa) setPara(previa);
      } catch {
        /* sin almacenamiento: se escribe cada vez */
      }
    });
    return () => clearTimeout(t);
  }, []);

  // Irse con cambios sin guardar pregunta antes.
  useEffect(() => {
    if (!sinGuardar) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sinGuardar]);

  // La vista previa va un paso atrás del teclado: rearmar el correo en cada
  // letra trabaría la escritura.
  const diferido = useDeferredValue(datos);
  const html = useMemo(() => {
    const correo = armarBoletin(
      {
        asunto: diferido.asunto,
        preencabezado: diferido.preencabezado,
        introduccion: diferido.introduccion,
        cierre: diferido.cierre,
        notas: diferido.notas.flatMap((e) => {
          const f = fichas.get(e.slug);
          return f ? [{ ...f, resumen: e.resumen.trim() || f.bajada }] : [];
        }),
      },
      BAJA_DE_PRUEBA,
    );
    // Enlaces inertes en la vista (ver la página del correo de prueba).
    return correo.html.replace("<head>", '<head><base target="_blank">');
  }, [diferido, fichas]);

  /*
   * Las notas se eligen en dos pasos: primero la edición y después la nota.
   * Mezcladas, las de seis ediciones eran una lista larga donde lo único que
   * distinguía a una nota de otra era una línea gris al pie. Las ediciones van
   * en el orden en que llegan (la más nueva primero), que es el que les da
   * `notasCandidatas()`.
   */
  const ediciones = useMemo(() => {
    const elegido = new Set(elegidas.map((e) => e.slug));
    const lista: { nombre: string; disponibles: number }[] = [];
    for (const n of candidatas) {
      let e = lista.find((x) => x.nombre === n.edicion);
      if (!e) {
        e = { nombre: n.edicion, disponibles: 0 };
        lista.push(e);
      }
      if (!elegido.has(n.slug)) e.disponibles++;
    }
    return lista;
  }, [candidatas, elegidas]);

  /** null = todas las ediciones. Arranca en la más nueva. */
  const [edicionVista, setEdicionVista] = useState<string | null>(
    () => candidatas[0]?.edicion ?? null,
  );

  // El borrador con IA tiene su propia elección de edición: arranca en la más
  // nueva, igual que el buscador, pero no se pisan entre sí.
  const [edicionIA, setEdicionIA] = useState<string | null>(
    () => candidatas[0]?.edicion ?? null,
  );
  const [faseIA, setFaseIA] = useState<"eligiendo" | "escribiendo" | null>(null);
  const [errorIA, setErrorIA] = useState<string | null>(null);
  /** null = no hay aviso; [] = salió todo bien; con algo = lo descartado. */
  const [avisoIA, setAvisoIA] = useState<string[] | null>(null);
  const [confirmandoIA, setConfirmandoIA] = useState(false);

  const resultados = useMemo(() => {
    const elegido = new Set(elegidas.map((e) => e.slug));
    const q = normalizar(busqueda.trim());
    return candidatas
      .filter((n) => !elegido.has(n.slug))
      .filter((n) => edicionVista === null || n.edicion === edicionVista)
      .filter(
        (n) =>
          !q ||
          normalizar(`${n.titulo} ${n.seccion} ${n.bajada}`).includes(q),
      )
      .slice(0, 60);
  }, [candidatas, elegidas, busqueda, edicionVista]);

  function tocar() {
    setError(null);
    setAviso(null);
  }

  function mover(i: number, paso: -1 | 1) {
    tocar();
    setElegidas((lista) => {
      const j = i + paso;
      if (j < 0 || j >= lista.length) return lista;
      const nueva = [...lista];
      [nueva[i], nueva[j]] = [nueva[j], nueva[i]];
      return nueva;
    });
  }

  async function guardarAhora(): Promise<boolean> {
    const res = await guardarBoletinAction({ id: boletin.id, ...datos });
    if (!res.ok) {
      setError(res.error ?? "No se pudo guardar.");
      return false;
    }
    setGuardado(JSON.stringify(datos));
    return true;
  }

  function guardar() {
    tocar();
    iniciar(async () => {
      try {
        if (await guardarAhora()) setAviso({ tipo: "guardado" });
      } catch {
        setError("No se pudo hablar con el servidor.");
      }
    });
  }

  function probar(e: React.FormEvent) {
    e.preventDefault();
    tocar();
    iniciar(async () => {
      try {
        if (!(await guardarAhora())) return;
        const res = await enviarPruebaAction({ id: boletin.id, para });
        if (!res.ok) {
          setError(res.error ?? "No se pudo mandar la prueba.");
          return;
        }
        try {
          localStorage.setItem(CLAVE_PRUEBA, para.trim());
        } catch {
          /* sin almacenamiento */
        }
        setAviso({
          tipo: "prueba",
          correoId: res.correoId,
          enviado: Boolean(res.enviado),
        });
      } catch {
        setError("No se pudo hablar con el servidor.");
      }
    });
  }

  function borrar() {
    tocar();
    iniciar(async () => {
      try {
        const res = await borrarBoletinAction(boletin.id);
        if (!res.ok) {
          setError(res.error ?? "No se pudo borrar.");
          return;
        }
        // Ya no hay nada que perder: sin esto, el aviso de "cambios sin
        // guardar" frenaría la salida.
        setGuardado(JSON.stringify(datos));
        router.replace("/admin/newsletter");
        router.refresh();
      } catch {
        setError("No se pudo hablar con el servidor.");
      }
    });
  }

  /* ---------------------------------------------------- borrador con IA */

  function pedirIA() {
    setErrorIA(null);
    setAvisoIA(null);
    const hayAlgo =
      elegidas.length > 0 || introduccion.trim() !== "" || cierre.trim() !== "";
    if (hayAlgo) {
      setConfirmandoIA(true);
      return;
    }
    armarConIA();
  }

  function armarConIA() {
    setConfirmandoIA(false);
    tocar();
    if (!edicionIA) return;
    const ofrecidas = candidatas
      .filter((n) => n.edicion === edicionIA)
      .map((n) => n.slug);
    iniciar(async () => {
      try {
        setFaseIA("eligiendo");
        const propuesta = await proponerNotasIAAction({ slugs: ofrecidas });
        if (!propuesta.ok || !propuesta.slugs) {
          setErrorIA(propuesta.error ?? "No se pudo armar la propuesta.");
          return;
        }
        setFaseIA("escribiendo");
        const r = await escribirBorradorIAAction({
          id: boletin.id,
          slugs: propuesta.slugs,
          edicion: edicionIA,
        });
        if (!r.ok || !r.borrador) {
          setErrorIA(r.error ?? "No se pudo escribir el borrador.");
          return;
        }
        const b = r.borrador;
        setAsunto(b.asunto);
        setPreencabezado(b.preencabezado);
        setIntroduccion(b.introduccion);
        setCierre(b.cierre);
        setElegidas(
          b.notas
            .filter((n) => fichas.has(n.slug))
            .map((n) => ({ slug: n.slug, resumen: n.resumen })),
        );
        setAvisoIA(b.descartes);
      } catch {
        setErrorIA("No se pudo hablar con el servidor.");
      } finally {
        setFaseIA(null);
      }
    });
  }

  function pedirEnvio() {
    setErrorEnvio(null);
    if (modoEnvio === "programar" && !horaElegida) {
      setErrorEnvio("Elegí una fecha y una hora que existan.");
      return;
    }
    setConfirmandoEnvio(true);
  }

  function enviarALaLista() {
    tocar();
    setErrorEnvio(null);
    iniciar(async () => {
      try {
        // Lo que sale es lo guardado: se guarda primero, como en la prueba.
        if (!(await guardarAhora())) {
          setConfirmandoEnvio(false);
          return;
        }
        const res = await programarEnvioAction({
          id: boletin.id,
          cuando:
            modoEnvio === "ahora"
              ? "ahora"
              : { fecha: fechaEnvio, hora: horaEnvio },
        });
        if (!res.ok) {
          setErrorEnvio(res.error ?? "No se pudo programar el envío.");
          setConfirmandoEnvio(false);
          return;
        }
        // La página pasa a mostrar el seguimiento del envío.
        router.refresh();
      } catch {
        setErrorEnvio("No se pudo hablar con el servidor.");
        setConfirmandoEnvio(false);
      }
    });
  }

  const llenas = elegidas.length >= TOPE_NOTAS;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* ------------------------------------------------ Lo que se arma */}
      {/* El único carril de la columna va en `minmax(0,1fr)`: con el `auto`
          de siempre, un título largo de la lista de notas (aunque se corte con
          puntos suspensivos) estiraba todas las tarjetas por debajo de la
          vista previa. */}
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
        {faltan.length > 0 && (
          <Aviso icono={AlertTriangle} tono="var(--grafico-alerta)">
            {faltan.length === 1
              ? "Una nota de este newsletter ya no existe"
              : `${faltan.length} notas de este newsletter ya no existen`}{" "}
            (alguien la borró del diario). Se saca al guardar.
          </Aviso>
        )}

        {iaDisponible && (
          <SeccionPanel
            id="nl-ia"
            titulo="Armar con IA"
            bajada="Elegí una edición: la IA propone las notas y escribe los textos sólo con lo que dicen esas notas. No se guarda ni se manda solo: revisalo antes de guardar."
          >
            <div className="grid gap-4">
              <div role="group" aria-label="Edición para el borrador" className="flex flex-wrap gap-2">
                {ediciones.map((e) => {
                  const [numero, ...resto] = e.nombre.split(" · ");
                  return (
                    <ChipFiltro
                      key={e.nombre}
                      activo={edicionIA === e.nombre}
                      aria-pressed={edicionIA === e.nombre}
                      onClick={() => {
                        setEdicionIA(e.nombre);
                        setConfirmandoIA(false);
                      }}
                    >
                      {resto.length > 0 ? `${resto.join(" · ")} (${numero})` : e.nombre}
                    </ChipFiltro>
                  );
                })}
              </div>

              {errorIA && (
                <Aviso icono={AlertTriangle} tono="var(--grafico-alerta)" sobre="tarjeta" rol="alert">
                  {errorIA}
                </Aviso>
              )}
              {avisoIA && (
                <Aviso
                  icono={avisoIA.length > 0 ? AlertTriangle : Sparkles}
                  tono={avisoIA.length > 0 ? "var(--grafico-alerta)" : "var(--grafico-nota)"}
                  sobre="tarjeta"
                  rol="status"
                >
                  <strong className="font-semibold text-panel-tinta">
                    Listo el borrador.
                  </strong>{" "}
                  Leelo entero antes de guardar.
                  {avisoIA.length > 0 && (
                    <>
                      {" "}
                      Algunas partes quedaron vacías o con la bajada de la nota
                      porque la IA escribió datos que no están en las notas:
                      <ul className="mt-1 list-disc pl-5">
                        {avisoIA.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </Aviso>
              )}

              {confirmandoIA ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-panel-sm text-panel-tinta-2">
                    Reemplaza el asunto, los textos y las notas que hay ahora.
                    ¿Seguimos?
                  </span>
                  <button
                    type="button"
                    onClick={armarConIA}
                    disabled={enCurso}
                    className={clasesDeBoton({ tono: "primario", tamano: "chico" })}
                  >
                    Sí, reemplazar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmandoIA(false)}
                    className={clasesDeBoton({ tono: "fantasma", tamano: "chico" })}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={pedirIA}
                    disabled={enCurso || !edicionIA}
                    className={clasesDeBoton({ tono: "primario" })}
                  >
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    {faseIA === "eligiendo"
                      ? "Eligiendo las notas…"
                      : faseIA === "escribiendo"
                        ? "Escribiendo los textos…"
                        : "Proponer con IA"}
                  </button>
                  <span className={ayudaCampo} aria-live="polite">
                    {faseIA ? "Tarda unos segundos." : ""}
                  </span>
                </div>
              )}
            </div>
          </SeccionPanel>
        )}

        <SeccionPanel id="nl-encabezado" titulo="Asunto">
          <div className="grid gap-4">
            <div>
              <label htmlFor="nl-asunto" className={etiqueta}>
                Asunto del correo
              </label>
              <input
                id="nl-asunto"
                value={asunto}
                maxLength={TOPE_ASUNTO}
                onChange={(e) => {
                  tocar();
                  setAsunto(e.target.value);
                }}
                className={cn(campo, "mt-1.5")}
              />
              <span className={ayudaCampo}>
                Es lo primero que se lee en la bandeja. Corto y concreto:
                hasta 60 letras se ve entero en el celular ({asunto.length}).
              </span>
            </div>
            <div>
              <label htmlFor="nl-pre" className={etiqueta}>
                Línea de vista previa{" "}
                <span className="font-normal text-panel-tinta-3">(opcional)</span>
              </label>
              <input
                id="nl-pre"
                value={preencabezado}
                maxLength={TOPE_PRE}
                onChange={(e) => {
                  tocar();
                  setPreencabezado(e.target.value);
                }}
                className={cn(campo, "mt-1.5")}
                placeholder="Por ejemplo: Plazas nuevas, el calendario de vacunación y más"
              />
              <span className={ayudaCampo}>
                El texto gris que los programas de correo muestran al lado del
                asunto. No se ve dentro del correo.
              </span>
            </div>
          </div>
        </SeccionPanel>

        <SeccionPanel
          id="nl-intro"
          titulo="Introducción"
          bajada="Opcional. Va arriba de las notas."
        >
          <label htmlFor="nl-introduccion" className="sr-only">
            Introducción
          </label>
          <textarea
            id="nl-introduccion"
            rows={4}
            value={introduccion}
            onChange={(e) => {
              tocar();
              setIntroduccion(e.target.value);
            }}
            className={campo}
          />
          <span className={ayudaCampo}>
            Dejá una línea en blanco entre párrafos. **Así** va en negrita y
            *así* en cursiva.
          </span>
        </SeccionPanel>

        <SeccionPanel
          id="nl-notas"
          titulo="Notas"
          bajada={`En el orden en que salen en el correo. Hasta ${TOPE_NOTAS}.`}
        >
          {elegidas.length === 0 ? (
            <p className="rounded-panel-2 bg-panel-tarjeta-2 px-4 py-5 text-center text-panel-sm text-panel-tinta-3">
              Todavía no elegiste ninguna. Buscalas abajo.
            </p>
          ) : (
            <ol className="grid gap-3">
              {elegidas.map((e, i) => {
                const f = fichas.get(e.slug);
                if (!f) return null;
                return (
                  <li
                    key={e.slug}
                    className="rounded-panel-2 border border-panel-borde bg-panel-tarjeta-2 p-3"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-panel-3 bg-panel-wash text-panel-xs font-semibold tabular-nums text-accent">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-panel-xs font-semibold uppercase tracking-wide text-panel-tinta-3">
                          {f.seccion} · {f.edicion}
                        </p>
                        <p className="mt-0.5 font-semibold text-panel-tinta">
                          {f.titulo}
                        </p>
                        {!f.publicada && (
                          <p className="mt-1">
                            <Pildora tono="var(--grafico-diario)" sobre="hundida">
                              Su edición todavía no salió
                            </Pildora>
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => mover(i, -1)}
                          disabled={i === 0}
                          aria-label={`Subir «${f.titulo}»`}
                          className={clasesDeBotonIcono({ sobre: "hundida" })}
                        >
                          <ArrowUp className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => mover(i, 1)}
                          disabled={i === elegidas.length - 1}
                          aria-label={`Bajar «${f.titulo}»`}
                          className={clasesDeBotonIcono({ sobre: "hundida" })}
                        >
                          <ArrowDown className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            tocar();
                            setElegidas((l) => l.filter((x) => x.slug !== e.slug));
                          }}
                          aria-label={`Sacar «${f.titulo}»`}
                          className={clasesDeBotonIcono({
                            tono: "destructivo",
                            sobre: "hundida",
                          })}
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <label
                      htmlFor={`nl-resumen-${i}`}
                      className={cn(etiqueta, "mt-3")}
                    >
                      Texto en el correo{" "}
                      <span className="font-normal text-panel-tinta-3">
                        (vacío = la bajada de la nota)
                      </span>
                    </label>
                    <textarea
                      id={`nl-resumen-${i}`}
                      rows={2}
                      value={e.resumen}
                      placeholder={f.bajada}
                      onChange={(ev) => {
                        tocar();
                        const valor = ev.target.value;
                        setElegidas((l) =>
                          l.map((x) =>
                            x.slug === e.slug ? { ...x, resumen: valor } : x,
                          ),
                        );
                      }}
                      className={cn(clasesDeCampo("hundida"), "mt-1.5")}
                    />
                  </li>
                );
              })}
            </ol>
          )}

          <div className="mt-5 border-t border-panel-borde pt-4">
            <h3 className={etiqueta}>Agregar notas del diario</h3>

            <p id="nl-paso-edicion" className="mt-3 text-panel-sm text-panel-tinta-2">
              1. Elegí la edición
            </p>
            <div
              role="group"
              aria-labelledby="nl-paso-edicion"
              className="mt-2 flex flex-wrap gap-2"
            >
              {ediciones.map((e) => {
                const [numero, ...resto] = e.nombre.split(" · ");
                return (
                  <ChipFiltro
                    key={e.nombre}
                    activo={edicionVista === e.nombre}
                    aria-pressed={edicionVista === e.nombre}
                    onClick={() => setEdicionVista(e.nombre)}
                    cuenta={e.disponibles}
                    aria-label={`${e.nombre}: ${e.disponibles} ${e.disponibles === 1 ? "nota" : "notas"} para agregar`}
                  >
                    {resto.length > 0 ? `${resto.join(" · ")} (${numero})` : e.nombre}
                  </ChipFiltro>
                );
              })}
              {ediciones.length > 1 && (
                <ChipFiltro
                  activo={edicionVista === null}
                  aria-pressed={edicionVista === null}
                  onClick={() => setEdicionVista(null)}
                >
                  Todas
                </ChipFiltro>
              )}
            </div>

            <label
              htmlFor="nl-buscar"
              className="mt-4 block text-panel-sm text-panel-tinta-2"
            >
              2. Elegí las notas
            </label>
            <div className="relative mt-1.5">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-panel-tinta-3"
                aria-hidden="true"
              />
              <input
                id="nl-buscar"
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={
                  edicionVista === null
                    ? "Buscar en todas las ediciones"
                    : "Buscar en esta edición"
                }
                className={cn(campo, "pl-9")}
              />
            </div>
            {llenas && (
              <p className={ayudaCampo}>
                Ya hay {TOPE_NOTAS} notas: sacá una para agregar otra.
              </p>
            )}
            <ul
              aria-label="Notas para agregar"
              className="mt-3 max-h-96 divide-y divide-panel-borde overflow-y-auto rounded-panel-2 border border-panel-borde"
            >
              {resultados.length === 0 ? (
                <li className="px-3 py-4 text-center text-panel-sm text-panel-tinta-3">
                  {busqueda
                    ? "Nada con esa búsqueda."
                    : edicionVista === null
                      ? "No hay más notas para agregar."
                      : "Ya agregaste todas las notas de esta edición."}
                </li>
              ) : (
                resultados.map((n) => (
                  <li key={n.slug} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-panel-sm font-medium text-panel-tinta">
                        {n.titulo}
                      </p>
                      <p className="truncate text-panel-xs text-panel-tinta-3">
                        {n.seccion}
                        {edicionVista === null && ` · ${n.edicion}`}
                        {!n.publicada && " · todavía no salió"}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={llenas}
                      onClick={() => {
                        tocar();
                        setElegidas((l) => [...l, { slug: n.slug, resumen: "" }]);
                      }}
                      className={clasesDeBoton({ tamano: "chico" })}
                      aria-label={`Agregar «${n.titulo}»`}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      Agregar
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </SeccionPanel>

        <SeccionPanel id="nl-cierre" titulo="Cierre" bajada="Opcional. Va al final, antes del pie.">
          <label htmlFor="nl-cierre-texto" className="sr-only">
            Cierre
          </label>
          <textarea
            id="nl-cierre-texto"
            rows={3}
            value={cierre}
            onChange={(e) => {
              tocar();
              setCierre(e.target.value);
            }}
            className={campo}
          />
        </SeccionPanel>

        <SeccionPanel id="nl-acciones" titulo="Guardar y probar">
          <div className="grid gap-4">
            {error && (
              <Aviso icono={AlertTriangle} tono="var(--grafico-alerta)" sobre="tarjeta" rol="alert">
                {error}
              </Aviso>
            )}
            {aviso?.tipo === "guardado" && (
              <Aviso icono={Check} tono="var(--grafico-nota)" sobre="tarjeta" rol="status">
                Guardado.
              </Aviso>
            )}
            {aviso?.tipo === "prueba" && (
              <Aviso icono={FlaskConical} tono="var(--grafico-diario)" sobre="tarjeta" rol="status">
                {aviso.enviado
                  ? `Listo, la prueba salió a ${para.trim()}. Puede tardar un minuto en llegar; si no aparece, mirá en spam.`
                  : "Listo. La cuenta de correo todavía no está conectada, así que no salió: quedó en la bandeja."}{" "}
                {aviso.correoId && (
                  <Link
                    href={`/admin/newsletter/correos/${aviso.correoId}`}
                    className="font-semibold text-accent underline"
                  >
                    Ver cómo llega
                  </Link>
                )}
              </Aviso>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={guardar}
                disabled={enCurso}
                className={clasesDeBoton({ tono: "primario" })}
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                {enCurso ? "Guardando…" : "Guardar borrador"}
              </button>
              <span className="text-panel-sm text-panel-tinta-3" aria-live="polite">
                {sinGuardar ? "Hay cambios sin guardar." : "Todo guardado."}
              </span>
            </div>

            <form onSubmit={probar} className="border-t border-panel-borde pt-4">
              <label htmlFor="nl-para" className={etiqueta}>
                Mandarme una prueba a
              </label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <input
                  id="nl-para"
                  type="email"
                  required
                  value={para}
                  onChange={(e) => setPara(e.target.value)}
                  placeholder="vos@smt.gob.ar"
                  className={cn(campo, "min-w-0 flex-1 basis-56")}
                />
                <button
                  type="submit"
                  disabled={enCurso || elegidas.length === 0}
                  className={clasesDeBoton()}
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Enviar prueba
                </button>
              </div>
              <span className={ayudaCampo}>
                Guarda y manda lo guardado a esa dirección, con «[Prueba]» en
                el asunto. Sale desde sanmiguelino@smt.gob.ar. Su enlace de
                baja no da de baja a nadie.
              </span>
            </form>

            <div className="border-t border-panel-borde pt-4">
              {!borrando ? (
                <button
                  type="button"
                  onClick={() => setBorrando(true)}
                  className={clasesDeBoton({ tono: "fantasma", tamano: "chico" })}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Borrar este borrador
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-panel-sm text-panel-tinta-2">
                    ¿Borrar «{asunto || "sin asunto"}»? No se puede deshacer.
                  </span>
                  <button
                    type="button"
                    onClick={borrar}
                    disabled={enCurso}
                    className={clasesDeBoton({ tono: "destructivo", tamano: "chico" })}
                  >
                    Sí, borrar
                  </button>
                  <button
                    type="button"
                    onClick={() => setBorrando(false)}
                    className={clasesDeBoton({ tono: "fantasma", tamano: "chico" })}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        </SeccionPanel>

        <SeccionPanel
          id="nl-enviar"
          titulo="Enviar a la lista"
          bajada="A quienes confirmaron su suscripción. Sale lo que está guardado."
        >
          <div className="grid gap-4">
            {!envioReal && (
              <Aviso icono={FlaskConical} tono="var(--grafico-diario)" sobre="tarjeta">
                <strong className="font-semibold text-panel-tinta">
                  Por ahora el envío es de práctica:
                </strong>{" "}
                recorre la lista entera, pero no le llega a nadie. Sirve para
                ver cómo funciona antes de mandarlo de verdad.
              </Aviso>
            )}
            {errorEnvio && (
              <Aviso icono={AlertTriangle} tono="var(--grafico-alerta)" sobre="tarjeta" rol="alert">
                {errorEnvio}
              </Aviso>
            )}

            <p className="flex items-center gap-2 text-panel-sm text-panel-tinta-2">
              <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
              {destinatarios === 0
                ? "Todavía nadie confirmó su suscripción: no hay a quién mandárselo."
                : destinatarios === 1
                  ? "Lo recibiría 1 persona."
                  : `Lo recibirían ${destinatarios.toLocaleString("es-AR")} personas.`}
            </p>

            {destinatarios > 0 && !confirmandoEnvio && (
              <>
                <fieldset className="grid gap-2">
                  <legend className={etiqueta}>Cuándo</legend>
                  <label className="flex items-center gap-2 text-panel-sm text-panel-tinta">
                    <input
                      type="radio"
                      name="nl-cuando"
                      checked={modoEnvio === "ahora"}
                      onChange={() => {
                        setErrorEnvio(null);
                        setModoEnvio("ahora");
                      }}
                    />
                    Ahora
                  </label>
                  <label className="flex items-center gap-2 text-panel-sm text-panel-tinta">
                    <input
                      type="radio"
                      name="nl-cuando"
                      checked={modoEnvio === "programar"}
                      onChange={() => {
                        setErrorEnvio(null);
                        setModoEnvio("programar");
                      }}
                    />
                    En una fecha y hora
                  </label>
                </fieldset>

                {modoEnvio === "programar" && (
                  <div className="flex flex-wrap gap-3">
                    <div>
                      <label htmlFor="nl-fecha" className={etiqueta}>
                        Fecha
                      </label>
                      <input
                        id="nl-fecha"
                        type="date"
                        value={fechaEnvio}
                        onChange={(e) => setFechaEnvio(e.target.value)}
                        className={cn(campo, "mt-1.5")}
                      />
                    </div>
                    <div>
                      <label htmlFor="nl-hora" className={etiqueta}>
                        Hora
                      </label>
                      <input
                        id="nl-hora"
                        type="time"
                        step={300}
                        value={horaEnvio}
                        onChange={(e) => setHoraEnvio(e.target.value)}
                        className={cn(campo, "mt-1.5")}
                      />
                    </div>
                    <span className={cn(ayudaCampo, "basis-full")}>
                      Hora de Tucumán.
                      {horaElegida && ` Sale el ${fechaLegible(horaElegida)}.`}
                    </span>
                  </div>
                )}

                <div>
                  <button
                    type="button"
                    onClick={pedirEnvio}
                    disabled={enCurso || elegidas.length === 0}
                    className={clasesDeBoton({ tono: "primario" })}
                  >
                    {modoEnvio === "ahora" ? (
                      <Send className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <CalendarClock className="h-4 w-4" aria-hidden="true" />
                    )}
                    {modoEnvio === "ahora" ? "Enviar ahora" : "Programar envío"}
                  </button>
                </div>
              </>
            )}

            {confirmandoEnvio && (
              <div
                role="group"
                aria-labelledby="nl-confirmar-envio"
                className="grid gap-3 rounded-panel border border-panel-borde p-4"
              >
                <p id="nl-confirmar-envio" className="text-panel-sm text-panel-tinta">
                  {modoEnvio === "ahora"
                    ? "¿Mandar ahora"
                    : `¿Programar para el ${horaElegida ? fechaLegible(horaElegida) : ""}`}{" "}
                  «{asunto || "sin asunto"}» a{" "}
                  {destinatarios === 1 ? "1 persona" : `${destinatarios.toLocaleString("es-AR")} personas`}?{" "}
                  {envioReal
                    ? "Les llega de verdad."
                    : "Es de práctica: no le llega a nadie."}{" "}
                  {modoEnvio === "ahora"
                    ? "Empieza a salir en el próximo minuto."
                    : "Hasta esa hora se puede cancelar y volver a editar."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={enviarALaLista}
                    disabled={enCurso}
                    className={clasesDeBoton({ tono: "primario", tamano: "chico" })}
                  >
                    {enCurso
                      ? "Un momento…"
                      : modoEnvio === "ahora"
                        ? "Sí, enviar"
                        : "Sí, programar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmandoEnvio(false)}
                    disabled={enCurso}
                    className={clasesDeBoton({ tono: "fantasma", tamano: "chico" })}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </SeccionPanel>
      </div>

      {/* ------------------------------------------------ Cómo se ve */}
      <div className="min-w-0 xl:sticky xl:top-6">
        <VistaPrevia
          html={html}
          asunto={diferido.asunto}
          preencabezado={diferido.preencabezado}
          vacio={diferido.notas.length === 0}
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   La vista previa
--------------------------------------------------------------------------- */

/** El ancho al que se dibuja el correo "en la compu": los 600 px del correo y
 *  el margen que le dejan los programas de correo. */
const ANCHO_COMPU = 680;
const ANCHO_CELULAR = 375;
/** El alto de la pantalla del celular de la vista. */
const ALTO_CELULAR = 667;

type Vista = "compu" | "celular";

/**
 * El correo dibujado en un `iframe`, del alto de su contenido.
 *
 * `sandbox="allow-same-origin"` y nada más: el correo no puede correr ningún
 * script (no tiene `allow-scripts`), ni abrir ventanas, ni mandar formularios,
 * pero el panel sí puede medir su alto para no dejar media pantalla vacía. Los
 * enlaces quedan inertes por el `<base target="_blank">` que agrega el editor.
 */
function CorreoEnMarco({
  html,
  ancho,
  escala = 1,
  titulo,
}: {
  html: string;
  ancho: number;
  escala?: number;
  titulo: string;
}) {
  const [alto, setAlto] = useState(400);
  const marco = useRef<HTMLIFrameElement>(null);

  // Se mide el `<body>` y no el documento: el documento nunca es más bajo que
  // el iframe, así que al sacar una nota el marco no se achicaba.
  const medir = () => {
    try {
      const cuerpo = marco.current?.contentDocument?.body;
      if (cuerpo) setAlto(Math.ceil(cuerpo.getBoundingClientRect().height));
    } catch {
      /* sin acceso: queda el alto anterior */
    }
  };

  // El primer `load` puede llegar antes de que React hidrate y conecte el
  // `onLoad`, y entonces nadie lo escucha. Si ya cargó, se mide igual.
  useEffect(() => {
    const t = setTimeout(() => {
      if (marco.current?.contentDocument?.readyState === "complete") medir();
    });
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ width: ancho * escala, height: alto * escala }}>
      <iframe
        ref={marco}
        title={titulo}
        sandbox="allow-same-origin"
        srcDoc={html}
        onLoad={medir}
        style={{
          width: ancho,
          height: alto,
          transform: escala === 1 ? undefined : `scale(${escala})`,
          transformOrigin: "top left",
        }}
        className="block border-0 bg-white"
      />
    </div>
  );
}

/** La fila de la bandeja de entrada: quién, el asunto y la línea gris. Es lo
 *  primero que ve la persona, antes de abrir nada. */
function FilaDeBandeja({
  asunto,
  preencabezado,
}: {
  asunto: string;
  preencabezado: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-panel-2 border border-panel-borde bg-panel-tarjeta px-3 py-2.5">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#17140e] font-serif text-[1rem] font-bold text-[#fcfaf4]"
      >
        S
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-panel-sm font-semibold text-panel-tinta">
          El Sanmiguelino{" "}
          <span className="font-normal text-panel-tinta-3">
            &lt;sanmiguelino@smt.gob.ar&gt;
          </span>
        </p>
        <p className="truncate text-panel-sm text-panel-tinta-2">
          <span className="font-semibold text-panel-tinta">
            {asunto || "(sin asunto)"}
          </span>
          {preencabezado && (
            <span className="text-panel-tinta-3"> — {preencabezado}</span>
          )}
        </p>
      </div>
    </div>
  );
}

function SelectorDeVista({
  vista,
  onCambio,
}: {
  vista: Vista;
  onCambio: (v: Vista) => void;
}) {
  return (
    <div role="group" aria-label="Dónde se mira" className="flex gap-2">
      <ChipFiltro activo={vista === "compu"} onClick={() => onCambio("compu")}>
        <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
        Compu
      </ChipFiltro>
      <ChipFiltro
        activo={vista === "celular"}
        onClick={() => onCambio("celular")}
      >
        <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
        Celular
      </ChipFiltro>
    </div>
  );
}

/** El celular: un marco oscuro con la pantalla de 375×667, que se desplaza
 *  adentro como uno de verdad. */
function MarcoCelular({ html }: { html: string }) {
  return (
    <div className="mx-auto w-fit rounded-[2.4rem] bg-[#1d1d1f] p-3 shadow-panel">
      <div
        aria-hidden="true"
        className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-white/20"
      />
      <div
        className="overflow-x-hidden overflow-y-auto rounded-[1.6rem] bg-white"
        style={{ width: ANCHO_CELULAR, height: ALTO_CELULAR }}
      >
        <CorreoEnMarco
          html={html}
          ancho={ANCHO_CELULAR}
          titulo="El correo en un celular"
        />
      </div>
    </div>
  );
}

/**
 * La vista previa de la columna derecha, y la grande.
 *
 * En la compu el correo se dibuja a su ancho real y se achica para entrar en la
 * columna: así se ve como queda, y no un correo apretado a 500 px que no existe
 * en ningún programa. «Ver en grande» lo abre a tamaño real, con su botón para
 * cerrar.
 */
export function VistaPrevia({
  html,
  asunto,
  preencabezado,
  vacio,
}: {
  html: string;
  asunto: string;
  preencabezado: string;
  vacio: boolean;
}) {
  const [vista, setVista] = useState<Vista>("compu");
  const [grande, setGrande] = useState(false);
  const [anchoColumna, setAnchoColumna] = useState(ANCHO_COMPU);
  const medida = useRef<HTMLDivElement>(null);

  // El ancho disponible, para achicar el correo de la compu. Se mide también
  // de entrada y no sólo cuando cambia: una pestaña de fondo puede no avisar
  // del primer tamaño.
  useEffect(() => {
    const caja = medida.current;
    if (!caja) return;
    const medir = () => setAnchoColumna(caja.clientWidth);
    const t = setTimeout(medir);
    const observador = new ResizeObserver(medir);
    observador.observe(caja);
    return () => {
      clearTimeout(t);
      observador.disconnect();
    };
  }, []);

  const escala = Math.min(1, anchoColumna / ANCHO_COMPU);

  return (
    <SeccionPanel
      id="nl-vista"
      titulo="Vista previa"
      acciones={<SelectorDeVista vista={vista} onCambio={setVista} />}
    >
      <div className="grid gap-3">
        <FilaDeBandeja asunto={asunto} preencabezado={preencabezado} />

        <div
          ref={medida}
          className="max-h-[calc(100dvh-17rem)] min-h-64 overflow-x-hidden overflow-y-auto rounded-panel-2 bg-panel-tarjeta-2"
        >
          {vista === "compu" ? (
            <CorreoEnMarco
              key="compu"
              html={html}
              ancho={ANCHO_COMPU}
              escala={escala}
              titulo="Vista previa del newsletter"
            />
          ) : (
            <div className="py-4">
              <MarcoCelular key="celular" html={html} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-panel-sm text-panel-tinta-3">
            {vacio
              ? "Agregá notas y van apareciendo acá."
              : "Los enlaces no se abren desde la vista previa."}
          </p>
          <button
            type="button"
            onClick={() => setGrande(true)}
            className={clasesDeBoton({ tamano: "chico" })}
          >
            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
            Ver en grande
          </button>
        </div>
      </div>

      <Dialog.Root open={grande} onOpenChange={setGrande}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed inset-3 z-50 flex flex-col overflow-hidden rounded-panel border border-panel-borde bg-panel-fondo font-sans text-panel-tinta shadow-panel sm:inset-6">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-panel-borde bg-panel-tarjeta px-4 py-3">
              <Dialog.Title className="text-panel-base font-semibold">
                Vista previa del correo
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                El newsletter a tamaño real, en la compu o en el celular.
              </Dialog.Description>
              <div className="flex items-center gap-3">
                <SelectorDeVista vista={vista} onCambio={setVista} />
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label="Cerrar la vista previa"
                    className={clasesDeBotonIcono()}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </Dialog.Close>
              </div>
            </header>
            <div className="flex-1 overflow-auto p-4 sm:p-6">
              <div className="mx-auto grid w-fit max-w-full gap-4">
                <FilaDeBandeja asunto={asunto} preencabezado={preencabezado} />
                {vista === "compu" ? (
                  <div className="overflow-hidden rounded-panel-2 border border-panel-borde">
                    <CorreoEnMarco
                      key="compu-grande"
                      html={html}
                      ancho={ANCHO_COMPU}
                      titulo="El newsletter a tamaño real"
                    />
                  </div>
                ) : (
                  <MarcoCelular key="celular-grande" html={html} />
                )}
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </SeccionPanel>
  );
}
