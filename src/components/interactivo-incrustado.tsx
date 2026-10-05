"use client";

import { useState, useSyncExternalStore } from "react";
import { ExternalLink, WifiOff } from "lucide-react";
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

/*
 * Si la pantalla es de tablet para arriba. Es la MISMA consulta que el `md:` de
 * Tailwind, escrita como sale compilada en el CSS, y tiene que serlo: lo que se
 * ve lo decide el CSS —`md:hidden`, `hidden md:block`— y esto decide sólo si se
 * monta el <iframe>. Con dos cortes distintos, en el medio habría un recuadro
 * sin interactivo o un interactivo cargando escondido.
 *
 * Es sólo por ancho, como el resto del sitio: un teléfono acostado que pasa los
 * 48rem ya tiene la nota a dos columnas, y también lleva el recuadro.
 *
 * En el servidor no se sabe el ancho, y se contesta que no: así el <iframe> no
 * viaja en el HTML y por debajo del corte no se baja nunca, ni siquiera en el
 * rato que tarda en hidratar. En la compu se monta apenas hidrata; mientras, el
 * recuadro ya está en su lugar, con el título, y nada se corre.
 */
const ANCHO = "(min-width: 48rem)";
function suscribirAncho(avisar: () => void) {
  const consulta = window.matchMedia(ANCHO);
  consulta.addEventListener("change", avisar);
  return () => consulta.removeEventListener("change", avisar);
}
const esAncho = () => window.matchMedia(ANCHO).matches;
const anchoEnElServidor = () => false;

/**
 * El interactivo del Portal de Datos, en su recuadro.
 *
 * **En el teléfono no se incrusta: va una tarjeta que lo abre.** Un elemento
 * del Portal es una página entera, pensada para la ventana del navegador, y en
 * 360px de ancho no entra. Medido con la línea de tiempo: la página mide 1.531px
 * de alto para un recuadro de 590, y el menú y el título del Portal se comen 466.
 * Ni con un modo incrustado alcanza: el texto quedaba en una franja de 100px.
 * Y un recuadro con scroll propio en el medio de la nota atrapa el dedo. Abierto
 * en su pestaña, en cambio, es una página que se baja como cualquier otra.
 *
 * **Sin señal no se intenta cargar.** El diario abre sin conexión las notas ya
 * leídas, pero un sitio ajeno no se puede guardar, y el recuadro mostraba
 * adentro la página de error del navegador —en Chrome, el dinosaurio en
 * miniatura; en Safari, un rectángulo en blanco—. En su lugar va un aviso.
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
  const ancho = useSyncExternalStore(suscribirAncho, esAncho, anchoEnElServidor);
  /* Si ya cargó con señal, se queda aunque la señal se corte. El interactivo
     sigue andando sin red con lo que ya bajó, y cambiarlo por el aviso lo
     desarmaba: al volver la señal arrancaba de cero y se perdía el año, la
     ficha abierta y el scroll. El aviso queda para lo que nunca llegó a
     cargar. Por lo mismo, si la ventana se angosta, el <iframe> se esconde
     pero no se desmonta. */
  const [cargado, setCargado] = useState(false);

  /* El alto se queda corto a propósito: un recuadro de pantalla completa atrapa
     el dedo, que mueve el interactivo y no la nota, y no hay de dónde agarrarse
     para seguir bajando. Con papel arriba y abajo siempre queda por dónde. */
  const altura =
    alto === "alto" ? "h-[min(85svh,720px)]" : "h-[min(70svh,560px)]";

  return (
    <>
      {/* Rótulo y botón cortos a propósito: "Interactivo · Portal de Datos" y
          "Abrir en el Portal de Datos" se partían en dos renglones en un
          teléfono de 320px. El destino va en la línea de abajo; al lector de
          pantalla le llega entero en el nombre del enlace. */}
      <div className="border border-line bg-paper-2 px-5 py-6 text-center md:hidden">
        <p className="meta">Interactivo</p>
        <p className="mt-2 text-balance font-serif text-[1.15rem] font-semibold leading-snug text-ink">
          {titulo}
        </p>
        {conexion ? (
          <>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="pressable mt-4 inline-flex items-center gap-2 border border-ink bg-ink px-4 py-2.5 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-paper transition-colors hover:bg-accent hover:text-accent-contrast"
            >
              Explorar
              <span className="sr-only">
                {" "}
                «{titulo}» en el Portal de Datos (se abre en otra pestaña)
              </span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </a>
            <p
              aria-hidden="true"
              className="mt-2 font-sans text-[0.72rem] text-ink-3"
            >
              Se abre en el Portal de Datos.
            </p>
          </>
        ) : (
          <p className="mt-3 inline-flex items-center gap-2 font-serif text-[0.95rem] italic text-ink-2">
            <WifiOff className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />
            Se abre con conexión.
          </p>
        )}
      </div>

      {!conexion && !cargado ? (
        <div
          className={cn(
            "hidden flex-col items-center justify-center gap-2 border border-line bg-paper-2 px-6 text-center md:flex",
            altura,
          )}
        >
          <WifiOff className="h-5 w-5 text-ink-3" aria-hidden="true" />
          <p className="max-w-sm font-serif text-[0.95rem] italic text-ink-2">
            «{titulo}» se ve con conexión. Cuando vuelva la señal, se carga acá
            mismo.
          </p>
        </div>
      ) : (
        /* El recuadro tiene su propio fondo y el título DETRÁS del
           interactivo. Mientras el interactivo está en vivo lo tapa; pero el
           giro de página fotografía la hoja (`src/lib/papel/captura.ts`) y lo
           de un sitio ajeno no se puede fotografiar: salía una caja vacía
           durante el giro. La captura saltea el <iframe>, así que en la foto
           queda esto, del mismo tamaño. Es también lo que se ve en la compu
           hasta que hidrata y se monta el <iframe>. */
        <div
          className={cn(
            "relative hidden border border-line bg-paper-2 md:block",
            altura,
          )}
        >
          <p
            aria-hidden="true"
            className="absolute inset-0 grid place-items-center px-6 text-center font-serif text-[0.95rem] italic text-ink-2"
          >
            «{titulo}»
          </p>
          {(ancho || cargado) && (
            <iframe
              src={url}
              title={titulo}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              allow="fullscreen"
              // Sólo se da por cargado si había señal: si la red se cortó a
              // mitad de camino, lo que cargó es la página de error y no hay
              // que conservarla.
              onLoad={() => {
                if (navigator.onLine) setCargado(true);
              }}
              className="absolute inset-0 block h-full w-full"
            />
          )}
        </div>
      )}
    </>
  );
}
