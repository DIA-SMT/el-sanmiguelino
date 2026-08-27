"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, X } from "lucide-react";
import { enfocarEdicionAction } from "@/app/admin/acciones";

/**
 * Aviso de que lo que se está viendo no es lo publicado.
 *
 * Va fija arriba de todo y con el color de acento, no discreta abajo. El riesgo
 * de una vista previa que se ve idéntica al diario real es justamente ese:
 * mirar una edición de septiembre, verla bien y creer que agosto ya cambió —o
 * al revés, revisar agosto pensando que es septiembre y dar por buena una tapa
 * que no es—. Si el aviso se puede pasar por alto, no sirve.
 */
/**
 * Le saca el punto final a la frase de la fecha.
 *
 * En español "a. m." y "p. m." terminan en punto, así que pegarle el punto de
 * la oración daba "a las 10:29 a. m.. El lector...". El punto lo pone la
 * oración; la fecha entra sin él.
 */
function sinPuntoFinal(frase: string): string {
  return frase.replace(/.$/, "");
}

export function BarraVistaPrevia({ mes, sale }: { mes: string; sale: string }) {
  const router = useRouter();
  const [saliendo, iniciar] = useTransition();

  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-accent-strong bg-accent px-4 py-2 text-accent-contrast"
    >
      <span className="inline-flex items-center gap-2 font-sans text-[0.75rem] font-semibold uppercase tracking-[0.12em]">
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
        Vista previa
      </span>
      <span className="font-sans text-[0.8rem]">
        Estás viendo <strong>{mes}</strong>, que {sinPuntoFinal(sale)}. El lector
        todavía no ve esto.
      </span>
      <button
        type="button"
        onClick={() =>
          iniciar(async () => {
            await enfocarEdicionAction(null);
            router.refresh();
          })
        }
        disabled={saliendo}
        className="pressable inline-flex items-center gap-1.5 border border-accent-contrast/40 px-2.5 py-1 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.12em] hover:border-accent-contrast disabled:opacity-50"
      >
        <X className="h-3 w-3" aria-hidden="true" />
        Volver a la publicada
      </button>
    </div>
  );
}
