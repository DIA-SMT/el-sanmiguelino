"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";
import { borrarNotaAction } from "@/app/admin/acciones";
import {
  Aviso,
  SeccionPanel,
  clasesDeBoton,
  clasesDeCampo,
} from "@/components/admin/piezas";
import { rotuloDeFolios } from "@/lib/data/paginas";
import type { EstadoParaBorrarNota } from "@/lib/repos/nota-borrar";
import { cn } from "@/lib/utils";

const BOTON_DESTRUCTIVO = clasesDeBoton({
  tono: "destructivo",
  tamano: "chico",
  sobre: "tarjeta",
});
const BOTON_QUIETO = clasesDeBoton({ tono: "fantasma", tamano: "chico" });

/**
 * Borrar la nota, al pie del editor.
 *
 * Va al final y en su propia tarjeta, lejos de "Guardar": es lo único de la
 * pantalla que no se deshace. No se esconde detrás de un menú —el caso que lo
 * pidió es de rutina: la digitalización partió una nota en dos páginas y hay
 * que sacar la segunda después de unirla— pero pide un segundo click que dice
 * exactamente qué va a pasar.
 *
 * Lo que se dibuja acá es una cortesía: las comprobaciones que mandan están en
 * `borrarNota()`, del lado del servidor.
 */
export function BorrarNota({ estado }: { estado: EstadoParaBorrarNota }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [tipeado, setTipeado] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  const { pagina, comentarios } = estado;
  // Sólo una nota escrita pierde comentarios: los de una página del impreso se
  // mudan a la nota que la va a mostrar.
  const pideSlug = pagina === null && comentarios > 0;
  // Las páginas del impreso que cambian de nota: ésta y las que ya cubría.
  const pasan = pagina
    ? { desde: pagina.numero, hasta: pagina.pasaA.hasta }
    : null;
  const deVecinos =
    comentarios === 1
      ? "1 comentario de un vecino"
      : `${comentarios} comentarios de vecinos`;

  function borrar() {
    setError(null);
    iniciar(async () => {
      try {
        const res = await borrarNotaAction({
          slug: estado.slug,
          confirmacion: tipeado,
        });
        if (!res.ok) {
          setError(res.error ?? "No se pudo borrar.");
          // Lo que dibuja esta tarjeta se calculó al abrir el editor. Si en el
          // medio alguien comentó, el servidor ahora pide el slug y el campo
          // para escribirlo no está: refrescar trae el estado nuevo.
          router.refresh();
          return;
        }
        // La nota ya no existe: este editor apunta a nada. Se va a la que
        // ahora muestra la página, para revisar que haya quedado entera, o a
        // la lista.
        router.replace(res.despues ?? "/admin");
        router.refresh();
      } catch {
        setError("No se pudo hablar con el servidor.");
      }
    });
  }

  return (
    <SeccionPanel
      id="borrar-la-nota"
      titulo={pagina ? "Borrar esta página" : "Borrar la nota"}
      bajada={
        estado.impedimento
          ? undefined
          : pagina
            ? `Para cuando la digitalización partió en dos una nota del impreso: pasá a la página ${pagina.pasaA.pagina} lo que haga falta y después borrá ésta.`
            : "Sale de la edición, del buscador y de lo que sabe Migue."
      }
    >
      {estado.impedimento ? (
        <p className="text-panel-sm text-panel-tinta-2">{estado.impedimento}</p>
      ) : !abierto ? (
        <button
          type="button"
          onClick={() => {
            setAbierto(true);
            setTipeado("");
            setError(null);
          }}
          className={BOTON_DESTRUCTIVO}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          {pagina ? "Borrar esta página" : "Borrar la nota"}
        </button>
      ) : (
        <div className="grid gap-2.5 rounded-panel-2 bg-panel-tarjeta-2 p-3.5">
          <Aviso
            icono={AlertTriangle}
            tono="var(--grafico-alerta)"
            sobre="tarjeta"
            rol="alert"
          >
            {/* Se dice QUÉ pasa, con nombre y número. Un "¿estás seguro?" no
                informa nada: quien apretó ya cree que sí. */}
            {pagina ? (
              <>
                Se borra «{estado.titulo}».{" "}
                {pasan && pasan.hasta > pasan.desde
                  ? `Las ${rotuloDeFolios(pasan).toLowerCase()} del impreso no se van del número: pasan`
                  : `La página ${pagina.numero} del impreso no se va del número: pasa`}{" "}
                a mostrarse junto con la {pagina.pasaA.pagina}, en{" "}
                <strong className="font-semibold text-panel-tinta">
                  «{pagina.pasaA.titulo}»
                </strong>
                , que en «Verla como salió impresa» va a mostrar las{" "}
                {pagina.pasaA.hasta - pagina.pasaA.pagina + 1} hojas.{" "}
                <strong className="font-semibold text-panel-tinta">
                  El texto de esta nota no se pasa solo
                </strong>
                : si falta algo en la {pagina.pasaA.pagina}, copialo antes.
                {comentarios > 0 &&
                  (comentarios === 1
                    ? " Su comentario pasa a esa nota."
                    : ` Sus ${comentarios} comentarios pasan a esa nota.`)}
              </>
            ) : (
              <>
                Se borra «{estado.titulo}»
                {comentarios > 0 ? (
                  <>
                    {" y "}
                    <strong className="font-semibold text-panel-tinta">
                      {deVecinos}
                    </strong>
                  </>
                ) : null}
                . No hay papelera: no se puede deshacer.
              </>
            )}
            {estado.publicada && (
              <>
                {" "}
                {estado.mes} ya está en la calle: quien tenga el enlace{" "}
                {pagina?.redirige
                  ? "llega a la nota de la página de al lado."
                  : "se va a encontrar con que la nota no existe."}
              </>
            )}
          </Aviso>

          {pideSlug && (
            <label className="grid gap-1.5">
              <span className="text-panel-sm font-medium text-panel-tinta-2">
                Escribí <code className="font-mono">{estado.slug}</code> para
                confirmar
              </span>
              <input
                value={tipeado}
                onChange={(e) => setTipeado(e.target.value)}
                // Está adentro del formulario del editor: un Enter acá no
                // puede guardar la nota.
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                autoComplete="off"
                spellCheck={false}
                className={cn(
                  clasesDeCampo("hundida"),
                  "w-auto justify-self-start font-mono",
                )}
                placeholder={estado.slug}
              />
            </label>
          )}

          <div className="flex flex-wrap items-center gap-panel-controles">
            <button
              type="button"
              onClick={borrar}
              disabled={enCurso || (pideSlug && tipeado.trim() !== estado.slug)}
              className={BOTON_DESTRUCTIVO}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              {enCurso
                ? "Borrando…"
                : pagina && pasan
                  ? `Borrar y pasar ${
                      pasan.hasta > pasan.desde
                        ? `las ${rotuloDeFolios(pasan).toLowerCase()}`
                        : `la página ${pagina.numero}`
                    } a la ${pagina.pasaA.pagina}`
                  : "Borrar definitivamente"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                setTipeado("");
                setError(null);
              }}
              disabled={enCurso}
              className={BOTON_QUIETO}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
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
    </SeccionPanel>
  );
}
