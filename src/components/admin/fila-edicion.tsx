"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Eye, Pencil, X } from "lucide-react";
import {
  enfocarEdicionAction,
  guardarEdicionAction,
} from "@/app/admin/acciones";
import {
  Aviso,
  Pildora,
  TarjetaPanel,
  clasesDeBoton,
  clasesDeCampo,
} from "@/components/admin/piezas";
import { cn } from "@/lib/utils";

export interface EdicionFila {
  slug: string;
  mes: string;
  numero: number;
  anio: number;
  etiqueta: string | null;
  /** Valor para el input, en hora de Tucumán. "" si no tiene fecha. */
  publicaEnLocal: string;
  /** Texto legible de la fecha, o null. */
  publicaEnTexto: string | null;
  /** De qué se trata el número. null en las ediciones viejas. */
  tema: string | null;
  notas: number;
  estado: "publicada" | "programada" | "sin_fecha";
}

/* El vocabulario de botones de la ficha, ahora el del panel entero.
   Los cuatro eran definiciones locales de este archivo y los cuatro se
   repetían, con matices, en otras cinco pantallas.

   Todos `chico` (32px): se repiten en cada ficha de una lista de ediciones, y
   ahí un botón de 36px empuja la fila.

   `sobre="tarjeta"` en el secundario porque estos botones apoyan sobre la
   `TarjetaPanel` blanca de la ficha, así que el relleno del control es el
   contrario y se hunde. Antes traía `bg-panel-tarjeta` clavado sobre una
   tarjeta que es `panel-tarjeta`: el botón era del mismo color que su fondo y
   su único límite era `border-panel-borde` —1,23:1—, que es no tener límite
   (WCAG 1.4.11). La pieza usa `--panel-borde-campo`, ≥3:1 en los dos temas.

   El "Ir al diario" era un quinto tono local, `BOTON_ACENTO`
   (`bg-panel-wash text-accent`), que no entra en los cuatro del contrato.
   Pasa a secundario: lo que lo hacía distinto era el matiz, no la jerarquía
   —al lado de "Dejar de verla" los dos son acciones del mismo peso— y un tono
   más se pide, no se escribe a mano acá. */
const BOTON_PRIMARIO = clasesDeBoton({ tono: "primario", tamano: "chico" });
const BOTON_SECUNDARIO = clasesDeBoton({ tamano: "chico", sobre: "tarjeta" });
const BOTON_QUIETO = clasesDeBoton({ tono: "fantasma", tamano: "chico" });

/**
 * Los estados, con su palabra y su color.
 *
 * `publicada` dice **"En el archivo"** y no "En la calle". No es un capricho de
 * redacción: hay muchas ediciones con la fecha ya cumplida y una sola que el
 * lector encuentra al abrir el diario —la más reciente—. Antes las dos decían
 * lo mismo y se diferenciaban sólo por el relleno de la pastilla, así que la
 * pregunta más importante de esta pantalla ("¿cuál está saliendo?") se
 * contestaba mirando un matiz. Ahora se contesta leyendo.
 *
 * El color va SIEMPRE con su texto: acá arriba, en el filete de la tarjeta y en
 * las tarjetas de dato de la pantalla. Nunca solo.
 */
const ESTADOS: Record<
  EdicionFila["estado"],
  { texto: string; tono: string; fuerte: boolean }
> = {
  publicada: {
    texto: "En el archivo",
    tono: "var(--panel-borde)",
    fuerte: false,
  },
  programada: {
    texto: "Programada",
    tono: "var(--grafico-indice)",
    fuerte: false,
  },
  sin_fecha: {
    texto: "Sin fecha",
    tono: "var(--grafico-diario)",
    fuerte: false,
  },
};

const EN_LA_CALLE = {
  texto: "En la calle",
  tono: "var(--grafico-nota)",
  fuerte: true,
};

export function FilaEdicion({
  edicion,
  enFoco,
  esLaPublicada,
}: {
  edicion: EdicionFila;
  /** Está siendo mirada por el panel y el diario. */
  enFoco: boolean;
  /** Es la que el lector ve ahora mismo. */
  esLaPublicada: boolean;
}) {
  const router = useRouter();
  const [enCurso, iniciar] = useTransition();
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fecha, setFecha] = useState(edicion.publicaEnLocal);
  const [tema, setTema] = useState(edicion.tema ?? "");

  const estado = esLaPublicada ? EN_LA_CALLE : ESTADOS[edicion.estado];

  function guardarFecha() {
    setError(null);
    iniciar(async () => {
      try {
        const res = await guardarEdicionAction({
          slug: edicion.slug,
          mes: edicion.mes,
          numero: edicion.numero,
          anio: edicion.anio,
          etiqueta: edicion.etiqueta ?? "",
          publicaEn: fecha,
          tema,
        });
        if (!res.ok) {
          setError(res.error ?? "No se pudo guardar.");
          return;
        }
        setEditando(false);
        router.refresh();
      } catch {
        setError("No se pudo hablar con el servidor.");
      }
    });
  }

  /**
   * Pone (o saca) la edición en vista previa.
   *
   * Con `irAlDiario`, además **lleva al diario**. Sin eso, "Verla en el
   * diario" sólo marcaba el foco y volvía a dibujar la misma fila: desde donde
   * está parado el editor no pasa nada visible, y encima el botón se convierte
   * en "Dejar de verla", así que tampoco queda a mano cómo ir a mirarla. La
   * lectura obvia es que la previsualización no anda.
   */
  function enfocar(slug: string | null, irAlDiario = false) {
    iniciar(async () => {
      await enfocarEdicionAction(slug);
      if (irAlDiario) router.push("/diario");
      else router.refresh();
    });
  }

  return (
    <li>
      {/* El filete va como barra absoluta y no como `border-l`: la tarjeta ya
          tiene su borde de 1px y engordarle un lado le corre el radio de las
          dos esquinas izquierdas. Con `overflow-hidden` la barra se recorta
          contra el mismo radio y el borde queda parejo. */}
      <TarjetaPanel
        className={cn(
          "relative overflow-hidden py-4 pr-5 pl-6",
          enFoco && "ring-2 ring-accent",
        )}
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-1"
          style={{ background: estado.tono }}
        />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h3 className="text-panel-lg font-semibold tracking-[-0.01em] text-panel-tinta">
            {edicion.mes}
          </h3>
          {/* La píldora del sistema. Tenía una copia local (`Pastilla`) con su
              propia altura y su propio 0.72rem; el eje que de verdad la
              distinguía —"éste es EL estado que hay que encontrar"— es ahora
              `enfasis`. Apoya sobre la tarjeta blanca, así que se hunde. */}
          <Pildora tono={estado.tono} sobre="tarjeta" enfasis={estado.fuerte}>
            {estado.texto}
          </Pildora>
          {enFoco && (
            /* La única pastilla de acento sólido de la pantalla, y no es un
               estado de la edición sino de quien está mirando: el diario le
               está mostrando ésta a este usuario. Por eso no es `Pildora`: la
               píldora dice estados con un punto de color y ésta es cromo, el
               acento sólido de la casa. Darle a la píldora un modo "acento
               relleno" sería inventarle un eje para un solo uso. */
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-panel-xs font-semibold text-accent-contrast">
              <Eye className="h-3 w-3" aria-hidden="true" />
              La estás viendo
            </span>
          )}
          <span className="text-panel-xs text-panel-tinta-3">
            N.º {edicion.numero} · {edicion.notas}{" "}
            {edicion.notas === 1 ? "nota" : "notas"} ·{" "}
            <code className="font-mono">{edicion.slug}</code>
          </span>
        </div>

        {editando ? (
          /* El formulario se hunde sobre la tarjeta en vez de flotar sobre
             ella: es la misma ficha en modo edición, no una segunda cosa. */
          <div className="mt-3 grid gap-3 rounded-panel-2 bg-panel-tarjeta-2 p-3.5">
            {/* De qué se trata el número. El Sanmiguelino no se divide en
                secciones: cada edición es un tema, y esto es lo que el diario
                muestra en la barra en lugar de las secciones. */}
            <label className="grid gap-1.5">
              <span className="text-panel-sm font-medium text-panel-tinta-2">
                Tema
              </span>
              {/* `hundida` porque el bloque de edición ya es la superficie
                  hundida: acá adentro el campo tiene que flotar. Es el mismo
                  fondo que tenía escrito a mano, ahora dicho como regla. */}
              <input
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                className={clasesDeCampo("hundida")}
                placeholder="Historia de San Miguel de Tucumán"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-panel-sm font-medium text-panel-tinta-2">
                Sale el (hora de Tucumán)
              </span>
              <input
                type="datetime-local"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={cn(
                  clasesDeCampo("hundida"),
                  "w-auto justify-self-start",
                )}
              />
            </label>
            <div className="flex flex-wrap items-center gap-panel-controles">
              <button
                type="button"
                onClick={guardarFecha}
                disabled={enCurso}
                className={BOTON_PRIMARIO}
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                {enCurso ? "Guardando…" : "Guardar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditando(false);
                  setFecha(edicion.publicaEnLocal);
                  setTema(edicion.tema ?? "");
                  setError(null);
                }}
                className={BOTON_QUIETO}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* El tema, a la vista sin tener que abrir el editor: es lo que
                el lector va a ver en la barra del diario. */}
            <p className="mt-2 text-panel-base text-panel-tinta-2">
              {edicion.tema ?? (
                <span className="text-panel-tinta-3">
                  Sin tema: el diario muestra las secciones de las notas.
                </span>
              )}
            </p>
            <p className="mt-1 text-panel-sm text-panel-tinta-2">
              {edicion.publicaEnTexto ? (
                <>Sale el {edicion.publicaEnTexto}</>
              ) : (
                <span className="text-panel-tinta-3">
                  Sin fecha: no sale sola hasta que se le ponga una.
                </span>
              )}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-panel-controles">
              <button
                type="button"
                onClick={() => setEditando(true)}
                className={BOTON_SECUNDARIO}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Tema y fecha
              </button>

              {enFoco ? (
                <>
                  {/* Ya está en foco: lo que falta es poder ir a verla. */}
                  <Link href="/diario" className={BOTON_SECUNDARIO}>
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    Ir al diario
                  </Link>
                  <button
                    type="button"
                    onClick={() => enfocar(null)}
                    disabled={enCurso}
                    className={BOTON_QUIETO}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    Dejar de verla
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => enfocar(edicion.slug, true)}
                  disabled={enCurso}
                  className={BOTON_SECUNDARIO}
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  Verla en el diario
                </button>
              )}
            </div>
          </>
        )}

        {error && (
          /* El tercer esqueleto de cartel de aviso que había en el panel,
             ahora la pieza. Mantiene el criterio que ya tenía escrito acá —el
             rojo tiñe el filete y el icono, la palabra va en tinta del panel,
             que pasa AA en los dos temas— sólo que la fórmula de mezcla vive
             una vez en `piezas.tsx` en lugar de copiada en tres archivos.
             `sobre="tarjeta"` porque el aviso apoya dentro de la tarjeta de la
             edición: ahí se hunde. */
          <div className="mt-3">
            <Aviso
              icono={AlertTriangle}
              tono="var(--grafico-alerta)"
              sobre="tarjeta"
              rol="alert"
            >
              {error}
            </Aviso>
          </div>
        )}
      </TarjetaPanel>
    </li>
  );
}
