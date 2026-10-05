"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ExternalLink, Maximize2, WifiOff, X } from "lucide-react";
import { type AltoInteractivo, direccionIncrustada } from "@/lib/interactivos";
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
 * ve lo decide el CSS —`md:hidden`, `hidden md:flex`— y esto decide sólo si se
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

/* Si el navegador deja poner un elemento en pantalla completa. No cambia
   mientras la página está abierta, así que no hay a qué suscribirse. En el
   servidor, que no: el botón aparece al hidratar, junto con el <iframe>. */
const sinCambios = () => () => {};
const sePuedePantallaCompleta = () => document.fullscreenEnabled;
const pantallaCompletaEnElServidor = () => false;

/* El tema del diario, que vive en `data-theme` de <html> (lo observa igual
   `ThemeToggle`). Se le pasa al interactivo para que no quede claro en un
   diario oscuro. */
type Tema = "light" | "dark";
function suscribirTema(avisar: () => void) {
  const observador = new MutationObserver(avisar);
  observador.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observador.disconnect();
}
const leerTema = (): Tema =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";
const temaEnElServidor = (): Tema => "light";

/** Le pasa el tema al interactivo, que lo escucha con el guion que agrega el
 *  diario. "*" porque el interactivo está en un origen anónimo y no hay otro
 *  modo de nombrarlo; el mensaje no lleva nada que no sepa cualquiera. */
function avisarTema(marco: HTMLIFrameElement | null, tema: Tema) {
  marco?.contentWindow?.postMessage({ tipo: "sanmiguelino:tema", tema }, "*");
}

/**
 * El <iframe>, aparte para que lo suyo se decida cuando ÉL se monta.
 *
 * El tema con el que se pide la página es el del momento en que aparece el
 * <iframe>, no el de cuando se armó la nota: puede aparecer mucho después (al
 * ensanchar la ventana, al volver la señal), y para entonces el lector pudo
 * haber cambiado de tema. Después queda fijo —si fuera el de cada momento,
 * cambiar de tema cambiaría la dirección y lo recargaría, y se perdería el año
 * en el que estaba—, y los cambios van por mensaje.
 *
 * Normalmente carga la versión del diario (`/interactivo`). Si esa versión
 * avisa que no puede andar —pide al Portal algo que no le deja leer desde su
 * origen anónimo, ver `src/lib/interactivos-servidor.ts`—, se cambia por la
 * página original del Portal: con su encabezado, como antes, pero andando. Ahí
 * sí va `allow-same-origin`, que es seguro porque ese origen es el del Portal
 * y no el nuestro; sin él, sus propios scripts no arrancan.
 */
function MarcoInteractivo({
  url,
  titulo,
  tema,
  alCargar,
}: {
  url: string;
  titulo: string;
  tema: Tema;
  alCargar: () => void;
}) {
  const [temaAlMontar] = useState<Tema>(() =>
    typeof document === "undefined" ? "light" : leerTema(),
  );
  const [directo, setDirecto] = useState(false);
  const marco = useRef<HTMLIFrameElement>(null);

  useEffect(() => avisarTema(marco.current, tema), [tema]);

  /* El aviso sólo se acepta de ESTE <iframe>: en la nota puede haber otro
     interactivo, y cualquier marco puede mandar un mensaje con esa forma. */
  useEffect(() => {
    const alMensaje = (ev: MessageEvent) => {
      if (ev.source !== marco.current?.contentWindow) return;
      if (ev.data?.tipo === "sanmiguelino:directo") setDirecto(true);
    };
    window.addEventListener("message", alMensaje);
    return () => window.removeEventListener("message", alMensaje);
  }, []);

  return (
    <iframe
      key={directo ? "directo" : "copia"}
      ref={marco}
      src={directo ? url : direccionIncrustada(url, temaAlMontar)}
      title={titulo}
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      sandbox={
        directo
          ? "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          : "allow-scripts allow-popups allow-popups-to-escape-sandbox"
      }
      allow="fullscreen"
      // Se repite el tema al cargar: pudo cambiar mientras cargaba.
      onLoad={(e) => {
        alCargar();
        avisarTema(e.currentTarget, tema);
      }}
      className="absolute inset-0 block h-full w-full"
    />
  );
}

/**
 * El interactivo del Portal de Datos, en su recuadro, con el pie que lo
 * acompaña.
 *
 * **En el teléfono no se incrusta: va una tarjeta que lo abre.** Un elemento
 * del Portal es una página entera, pensada para la ventana del navegador, y en
 * 360px de ancho no entra. Medido con la línea de tiempo: la página mide 1.531px
 * de alto para un recuadro de 590, y el menú y el título del Portal se comen 466.
 * Ni con la versión del diario (`/interactivo`) alcanza: en ese ancho el texto
 * quedaba en una franja de 100px.
 * Y un recuadro con scroll propio en el medio de la nota atrapa el dedo. Abierto
 * en su pestaña, en cambio, es una página que se baja como cualquier otra.
 *
 * **De tablet para arriba va el recuadro, y se puede llevar a pantalla
 * completa.** El <iframe> no pide la página del Portal sino la versión del
 * diario (`/interactivo`, ver `src/lib/interactivos-servidor.ts`): la misma,
 * sin el menú ni el título del Portal y a la medida del recuadro. En pantalla
 * completa ese recuadro es la pantalla entera.
 *
 * **Sin señal no se intenta cargar.** El diario abre sin conexión las notas ya
 * leídas, pero un sitio ajeno no se puede guardar, y el recuadro mostraba
 * adentro la página de error del navegador —en Chrome, el dinosaurio en
 * miniatura; en Safari, un rectángulo en blanco—. En su lugar va un aviso.
 *
 * El enlace del pie es para verlo en su pestaña y para quien no puede usar un
 * mapa o una línea de tiempo con el dedo; en un sitio del Estado aplica la Ley
 * 26.653. En el teléfono se esconde porque la tarjeta ya trae ese enlace:
 * serían dos botones seguidos para lo mismo. Sin señal la tarjeta dice "Se abre
 * con conexión." —el enlace sólo abriría la página de error— y el botón vuelve
 * solo con la señal.
 *
 * Lo que se le permite al interactivo, y lo que no:
 * - `allow-scripts`: sin eso no arranca.
 * - SIN `allow-same-origin`, y esto es lo importante: la versión del diario se
 *   sirve desde NUESTRO dominio, y un documento de nuestro origen con
 *   `allow-scripts` y `allow-same-origin` puede sacarse el sandbox solo y
 *   actuar como el diario. Sin esa bandera queda en un origen anónimo, sin
 *   acceso a la sesión ni a la página. La respuesta de `/interactivo` trae el
 *   mismo sandbox en su cabecera; las dos cosas juntas. (La excepción es la
 *   vuelta a la página original del Portal, ver `MarcoInteractivo`.)
 * - `allow-popups…`: para que sus propios enlaces se abran en otra pestaña.
 * - SIN `allow-top-navigation`: el interactivo no puede llevarse la pestaña del
 *   diario a otro lado.
 * - `allow="fullscreen"`: la pantalla completa que trae el propio Portal (la
 *   tecla F).
 */
export function InteractivoIncrustado({
  url,
  titulo,
  descripcion,
  alto = "normal",
}: {
  /** Ya validada con `urlIncrustable`. */
  url: string;
  titulo: string;
  descripcion?: string;
  alto?: AltoInteractivo;
}) {
  const conexion = useSyncExternalStore(suscribir, hayConexion, enElServidor);
  const ancho = useSyncExternalStore(suscribirAncho, esAncho, anchoEnElServidor);
  const conPantallaCompleta = useSyncExternalStore(
    sinCambios,
    sePuedePantallaCompleta,
    pantallaCompletaEnElServidor,
  );
  /* Si ya cargó con señal, se queda aunque la señal se corte. El interactivo
     sigue andando sin red con lo que ya bajó, y cambiarlo por el aviso lo
     desarmaba: al volver la señal arrancaba de cero y se perdía el año, la
     ficha abierta y el scroll. El aviso queda para lo que nunca llegó a
     cargar. Por lo mismo, si la ventana se angosta, el <iframe> se esconde
     pero no se desmonta. */
  const [cargado, setCargado] = useState(false);

  const recuadro = useRef<HTMLDivElement>(null);
  const botonEntrar = useRef<HTMLButtonElement>(null);
  const botonSalir = useRef<HTMLButtonElement>(null);
  const enlaceTarjeta = useRef<HTMLAnchorElement>(null);
  const [enPantallaCompleta, setEnPantallaCompleta] = useState(false);

  /* Sin señal y sin haber cargado, en el recuadro va el aviso en lugar del
     interactivo. El <iframe> se monta de tablet para arriba —o si ya cargó, o
     si está en pantalla completa: girar la tablet a vertical no lo puede
     desarmar—. */
  const conAviso = !conexion && !cargado;
  const montado = !conAviso && (ancho || cargado || enPantallaCompleta);

  /* Se escucha `fullscreenchange` y no se confía en el botón: de la pantalla
     completa también se sale con Esc o con el gesto del sistema, y en todos
     esos casos la barra de arriba tiene que irse. Se compara contra ESTE
     recuadro porque en la nota puede haber otro interactivo.

     El Portal tiene su propia pantalla completa (la tecla F), y adentro de la
     nuestra pasa a estarlo el <iframe>, que está adentro del recuadro. Eso
     sigue siendo "estar en pantalla completa": si se tomara como salida, el
     foco saltaría a "Pantalla completa" y, al volver, a "Salir", y las teclas
     del Portal dejarían de llegarle. */
  useEffect(() => {
    const alCambiar = () => {
      const elemento = document.fullscreenElement;
      const propio = recuadro.current;
      setEnPantallaCompleta(
        (antes) =>
          propio !== null &&
          elemento !== null &&
          (elemento === propio || (antes && propio.contains(elemento))),
      );
    };
    document.addEventListener("fullscreenchange", alCambiar);
    return () => document.removeEventListener("fullscreenchange", alCambiar);
  }, []);

  /* El foco va a "Salir" al entrar y vuelve a "Pantalla completa" al salir:
     si no, quien usa teclado queda parado en un botón que ya no se ve, o en
     ninguna parte. Va en un efecto y no en el evento porque la barra con
     "Salir" recién existe después de dibujar. Si al salir la pantalla quedó
     angosta (se giró la tablet), el botón está escondido y el foco va a la
     tarjeta, que es lo que se ve en su lugar. */
  const estuvoEnPantallaCompleta = useRef(false);
  useEffect(() => {
    if (enPantallaCompleta) {
      estuvoEnPantallaCompleta.current = true;
      botonSalir.current?.focus();
    } else if (estuvoEnPantallaCompleta.current) {
      estuvoEnPantallaCompleta.current = false;
      const visible = botonEntrar.current?.offsetParent
        ? botonEntrar.current
        : enlaceTarjeta.current;
      visible?.focus();
    }
  }, [enPantallaCompleta]);

  const tema = useSyncExternalStore(suscribirTema, leerTema, temaEnElServidor);
  const enlace = url;

  /* El alto se queda corto a propósito: un recuadro de pantalla completa atrapa
     el dedo, que mueve el interactivo y no la nota, y no hay de dónde agarrarse
     para seguir bajando. Con papel arriba y abajo siempre queda por dónde. Para
     verlo grande está el botón de pantalla completa. */
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
              ref={enlaceTarjeta}
              href={enlace}
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

      {/* En pantalla completa el navegador le fuerza a este recuadro el ancho
          y el alto de la pantalla —por encima de `altura`—, y arriba aparece
          una barra propia con el título y "Salir": en una tablet no hay Esc, y
          no se puede contar con el gesto del sistema.

          `[&:fullscreen]:flex`: el navegador fuerza tamaño y posición pero no
          `display`, y si se gira la tablet a vertical en pantalla completa el
          ancho baja del corte y `hidden` lo apagaba: quedaba la pantalla en
          negro, sin interactivo y sin "Salir".

          El recuadro es SIEMPRE el mismo elemento; lo que cambia es lo de
          adentro. Si se cortaba la señal en pantalla completa antes de que
          cargara, cambiar el recuadro entero por el aviso se llevaba la barra
          y dejaba la pantalla completa sin salida. */}
      <div
        ref={recuadro}
        className={cn(
          "hidden flex-col border border-line bg-paper-2 md:flex [&:fullscreen]:flex",
          altura,
        )}
      >
        {enPantallaCompleta && (
          <div className="flex items-center justify-between gap-4 border-b border-line bg-paper px-4 py-2">
            <span className="min-w-0 truncate font-serif text-[0.95rem] font-semibold text-ink">
              {titulo}
            </span>
            <button
              ref={botonSalir}
              type="button"
              onClick={() => {
                void document.exitFullscreen().catch(() => {});
              }}
              className="pressable inline-flex shrink-0 items-center gap-2 border border-ink px-3 py-1.5 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink transition-colors hover:bg-ink hover:text-paper"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Salir de pantalla completa
            </button>
          </div>
        )}
        {conAviso ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <WifiOff className="h-5 w-5 text-ink-3" aria-hidden="true" />
            <p className="max-w-sm font-serif text-[0.95rem] italic text-ink-2">
              «{titulo}» se ve con conexión. Cuando vuelva la señal, se carga
              acá mismo.
            </p>
          </div>
        ) : (
          /* El título DETRÁS del interactivo. Mientras el interactivo está en
             vivo lo tapa; pero el giro de página fotografía la hoja
             (`src/lib/papel/captura.ts`) y lo de un sitio ajeno no se puede
             fotografiar: salía una caja vacía durante el giro. La captura
             saltea el <iframe>, así que en la foto queda esto, del mismo
             tamaño. Es también lo que se ve en la compu hasta que hidrata y se
             monta el <iframe>. */
          <div className="relative min-h-0 flex-1">
            <p
              aria-hidden="true"
              className="absolute inset-0 grid place-items-center px-6 text-center font-serif text-[0.95rem] italic text-ink-2"
            >
              «{titulo}»
            </p>
            {montado && (
              <MarcoInteractivo
                url={url}
                titulo={titulo}
                tema={tema}
                // Sólo se da por cargado si había señal: si la red se cortó a
                // mitad de camino, lo que cargó es la página de error y no hay
                // que conservarla.
                alCargar={() => {
                  if (navigator.onLine) setCargado(true);
                }}
              />
            )}
          </div>
        )}
      </div>

      <figcaption className="mt-2.5 font-sans text-[0.74rem] leading-snug text-ink-3">
        {descripcion && (
          <span className="block text-pretty text-ink-2">{descripcion}</span>
        )}
        <span className="mt-1.5 hidden flex-wrap items-center gap-x-5 gap-y-1.5 md:flex">
          <a
            href={enlace}
            target="_blank"
            rel="noopener noreferrer"
            className="enlace inline-flex items-center gap-1.5 font-medium"
          >
            Abrir «{titulo}» en el Portal de Datos
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="sr-only">(se abre en otra pestaña)</span>
          </a>
          {conPantallaCompleta && montado && (
            <button
              ref={botonEntrar}
              type="button"
              onClick={() => {
                void recuadro.current?.requestFullscreen().catch(() => {});
              }}
              className="enlace inline-flex items-center gap-1.5 font-medium"
            >
              <Maximize2 className="h-3 w-3 shrink-0" aria-hidden="true" />
              Pantalla completa
              {/* Con dos interactivos en la nota habría dos botones iguales.
                  Lo visible queda al principio del nombre (WCAG 2.5.3): quien
                  dicta "Pantalla completa" lo sigue encontrando. */}
              <span className="sr-only">: «{titulo}»</span>
            </button>
          )}
        </span>
      </figcaption>
    </>
  );
}
