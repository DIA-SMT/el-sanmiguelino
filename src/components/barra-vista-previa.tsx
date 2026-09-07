"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, X } from "lucide-react";
import { enfocarEdicionAction } from "@/app/admin/acciones";

/**
 * Aviso de que lo que se está viendo no es lo publicado.
 *
 * Va fija arriba de todo y con el color de acento, no discreta abajo. El riesgo
 * de una vista previa que se ve idéntica al diario real es justamente ese:
 * mirar una edición de septiembre, verla bien y creer que agosto ya cambió —o
 * al revés, revisar agosto pensando que es septiembre y dar por buena una tapa
 * que no es—. Si el aviso se puede pasar por alto, no sirve.
 *
 * **Y es el camino de vuelta.** Antes la barra sólo ofrecía dejar de mirar la
 * edición, que es una de las dos cosas que uno quiere hacer al terminar de
 * revisar; la otra —volver al panel, que es de donde vino— no estaba en ningún
 * lado, así que había que escribir la dirección a mano o buscar el historial.
 * Peor: como la vista previa dura hasta que se la apaga, el panel seguía
 * diciendo "la estás viendo" sobre una edición que ya nadie estaba mirando.
 *
 * Por eso los dos botones apagan la vista previa y se diferencian en a dónde
 * llevan: "Volver al panel" es el de terminar de revisar, y "Seguir en el
 * diario" es para quien quiere quedarse leyendo lo que ve el lector.
 */

/**
 * Le saca el punto final a la frase de la fecha.
 *
 * En español "a. m." y "p. m." terminan en punto, así que pegarle el punto de
 * la oración daba "a las 10:29 a. m.. El lector...". El punto lo pone la
 * oración; la fecha entra sin él.
 */
function sinPuntoFinal(frase: string): string {
  return frase.replace(/\.$/, "");
}

/** Los dos botones son el mismo control con distinto destino, así que las
 *  clases se escriben una vez. Son de contorno sobre el azul del acento: el
 *  filete al 40% del texto los separa del fondo sin competir con la palabra. */
const BOTON =
  "pressable inline-flex items-center gap-1.5 border border-accent-contrast/40 px-2.5 py-1 font-sans text-[0.68rem] font-semibold tracking-[0.12em] uppercase hover:border-accent-contrast disabled:opacity-50";

export function BarraVistaPrevia({ mes, sale }: { mes: string; sale: string }) {
  const router = useRouter();
  const [saliendo, iniciar] = useTransition();

  /** Apaga la vista previa y, si se lo pide, vuelve al panel. El `push` va
   *  DESPUÉS de la acción para que la pantalla de ediciones se dibuje ya sin la
   *  marca de "la estás viendo": al revés, el panel llegaría con el dato
   *  viejo. */
  function salir(alPanel: boolean) {
    iniciar(async () => {
      await enfocarEdicionAction(null);
      if (alPanel) router.push("/admin/ediciones");
      else router.refresh();
    });
  }

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-accent-strong bg-accent px-4 py-2 text-accent-contrast"
    >
      <span className="inline-flex items-center gap-2 font-sans text-[0.75rem] font-semibold tracking-[0.12em] uppercase">
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
        Vista previa
      </span>
      <span className="font-sans text-[0.8rem]">
        Estás viendo <strong>{mes}</strong>, que {sinPuntoFinal(sale)}. El lector
        todavía no ve esto.
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => salir(true)}
          disabled={saliendo}
          className={BOTON}
        >
          <ArrowLeft className="h-3 w-3" aria-hidden="true" />
          Volver al panel
        </button>
        <button
          type="button"
          onClick={() => salir(false)}
          disabled={saliendo}
          className={BOTON}
        >
          <X className="h-3 w-3" aria-hidden="true" />
          Seguir en el diario
        </button>
      </span>
    </div>
  );
}
