"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import type { AltoInteractivo } from "@/lib/interactivos";
import { cn } from "@/lib/utils";

/*
 * Si hay señal, leída del navegador y sin efectos: `useSyncExternalStore` es la
 * forma que tiene React de suscribirse a algo que vive afuera —acá, los eventos
 * online/offline— sin el parpadeo de un estado que se corrige después.
 *
 * En el servidor se da por hecho que hay conexión: la página se arma con señal,
 * y el caso sin señal es justamente el de la copia guardada por la PWA.
 */
function suscribir(avisar: () => void) {
  window.addEventListener("online", avisar);
  window.addEventListener("offline", avisar);
  return () => {
    window.removeEventListener("online", avisar);
    window.removeEventListener("offline", avisar);
  };
}
const hayConexion = () => navigator.onLine;
const enElServidor = () => true;

/**
 * El interactivo del Portal de Datos, en su recuadro.
 *
 * **Sin señal no se intenta cargar.** El diario abre sin conexión las notas ya
 * leídas, pero un sitio ajeno no se puede guardar, y el recuadro mostraba
 * adentro la página de error del navegador —en Chrome, el dinosaurio en
 * miniatura; en Safari, un rectángulo en blanco—. En su lugar va un aviso, y el
 * enlace de abajo queda para cuando vuelva la señal.
 *
 * Lo que se le permite al sitio incrustado, y lo que no:
 * - `allow-scripts` y `allow-same-origin`: sin eso una línea de tiempo hecha en
 *   React no arranca. Juntos son seguros porque el sitio es de OTRO origen: lo
 *   que conserva es su propio origen, no acceso al nuestro.
 * - `allow-popups…`: para que sus propios enlaces se abran en otra pestaña.
 * - SIN `allow-top-navigation`: el interactivo no puede llevarse la pestaña del
 *   diario a otro lado.
 * - `allow="fullscreen"`: el botón "Pantalla completa" que trae el Portal.
 */
export function InteractivoIncrustado({
  url,
  titulo,
  alto = "normal",
}: {
  url: string;
  titulo: string;
  alto?: AltoInteractivo;
}) {
  const conexion = useSyncExternalStore(suscribir, hayConexion, enElServidor);

  /* El alto se queda corto a propósito, sobre todo en el teléfono: un recuadro
     de pantalla completa atrapa el dedo, que mueve el interactivo y no la nota,
     y no hay de dónde agarrarse para seguir bajando. Con papel arriba y abajo
     siempre queda por dónde. */
  const altura =
    alto === "alto" ? "h-[min(85svh,720px)]" : "h-[min(70svh,560px)]";

  if (!conexion) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 border border-line bg-paper-2 px-6 text-center",
          altura,
        )}
      >
        <WifiOff className="h-5 w-5 text-ink-3" aria-hidden="true" />
        <p className="max-w-sm font-serif text-[0.95rem] italic text-ink-2">
          «{titulo}» se ve con conexión. Cuando vuelva la señal, se carga acá
          mismo.
        </p>
      </div>
    );
  }

  return (
    <iframe
      src={url}
      title={titulo}
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      allow="fullscreen"
      className={cn("block w-full border border-line bg-paper-2", altura)}
    />
  );
}
