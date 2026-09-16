"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, Sparkles } from "lucide-react";
import type { SeccionInfo } from "@/lib/data/secciones";
import { cn } from "@/lib/utils";

/** Un número del diario, para el selector de ediciones. */
export interface EdicionEnBarra {
  slug: string;
  /** ej.: "Agosto de 2026" */
  mes: string;
  numero: number;
}

/** Bandera de secciones bajo el masthead: sobre papel, entre filetes, en
 *  versalitas espaciadas y repartidas a lo ancho, con filete de acento en la
 *  sección abierta. Queda pegada arriba al bajar, así el índice del diario
 *  está siempre a mano —y por eso lleva fondo opaco, para que el texto de la
 *  nota no se transparente por debajo. */
export function SeccionesNav({
  secciones,
  seccionActiva,
  tema,
  esLaDeLaCalle,
  edicion,
  ediciones,
}: {
  secciones: SeccionInfo[];
  /** slug de la sección activa cuando se está leyendo una nota */
  seccionActiva?: string;
  /**
   * De qué se trata el número.
   *
   * Si está, **reemplaza a las secciones**: El Sanmiguelino no se divide en
   * Cultura / Ciudad / Obras, cada edición es un tema y todas sus notas hablan
   * de eso. Listar las secciones de las notas era listar la misma palabra ocho
   * veces.
   *
   * Si no está —agosto y lo anterior, que salieron con secciones— la barra
   * queda como estaba. Un número publicado tiene que seguir viéndose como
   * salió.
   */
  tema?: string;
  /** Si el número de esta barra es el que el diario está sirviendo. */
  esLaDeLaCalle: boolean;
  /** El número que se está leyendo. De acá salen "Notas" y el rótulo del
   *  selector. */
  edicion: EdicionEnBarra;
  /** Todos los números publicados, del más nuevo al más viejo. */
  ediciones: EdicionEnBarra[];
}) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  /** Dónde y con qué ancho pararse: el borde de abajo de la barra. Se mide al
   *  abrir, porque el panel se dibuja en el <body> y no tiene de dónde
   *  colgarse solo. */
  const [caja, setCaja] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const barra = useRef<HTMLElement>(null);
  const disparador = useRef<HTMLButtonElement>(null);
  const selector = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const idPanel = useId();

  const hrefSumario = `/edicion/${edicion.slug}`;

  /*
   * Las secciones se listan SÓLO si hay más de una.
   *
   * Con una sola, la pestaña de sección y la de "Notas" llevan a la misma
   * lista con dos nombres distintos —y el de la sección lo escribe a mano un
   * redactor en el campo Sección de cada nota, así que ni siquiera es estable:
   * el mismo número de septiembre mostró "EDICIÓN IMPRESA" y al rato "EDICIÓN
   * SEPTIEMBRE" porque alguien editó ese campo. Eso fue exactamente lo que
   * dejó a un lector sin encontrar las notas: la única puerta que había se
   * llamaba como el papel del que salió el texto.
   *
   * Con varias secciones sí organizan algo y se muestran, que es como salieron
   * los números que las tienen.
   */
  const items: { etiqueta: string; href: string; activa: boolean }[] = [
    /*
     * "Portada" sólo existe en el número que está en la calle.
     *
     * `/diario` es siempre la tapa de ESE número, así que en un número del
     * archivo esta pestaña decía "Portada" arriba de una barra que dice AGOSTO
     * y te dejaba en la tapa de septiembre. En el archivo no hay portada: la
     * tapa se lee en su propia nota —"Notas" lleva al sumario y de ahí a la
     * página 1— y para volver al diario del mes está el logotipo de la
     * cabecera, que es lo que en cualquier diario lleva a la casa.
     */
    ...(esLaDeLaCalle
      ? [
          {
            etiqueta: "Portada",
            href: "/diario",
            activa: pathname === "/diario",
          },
        ]
      : []),
    /*
     * "Notas" va FUERA del ternario del tema, y ahí está media corrección.
     * Antes, un número con tema se quedaba sin ninguna entrada de sección y su
     * índice no tenía puerta: le pasa hoy a agosto, cuyas ocho páginas están
     * publicadas y no se llega a ellas desde la barra.
     *
     * Y apunta a `/edicion/<slug>`, que cuelga del NÚMERO. `/seccion/<slug>`
     * se arma siempre con la edición en la calle, así que el enlace que un
     * vecino guarda en septiembre le va a listar las notas de octubre.
     */
    {
      etiqueta: "Notas",
      href: hrefSumario,
      activa: pathname === hrefSumario,
    },
    ...(tema || secciones.length < 2
      ? []
      : secciones.map((s) => ({
          etiqueta: s.nombre,
          href: `/seccion/${s.slug}`,
          activa: pathname === `/seccion/${s.slug}` || seccionActiva === s.slug,
        }))),
  ];

  /* Cerrar el selector con Escape y al tocar afuera. Un panel que se queda
     abierto tapando la bandera es peor que no tenerlo.

     Y también al scrollear o al cambiar el tamaño de la ventana: la posición
     se midió una vez, así que seguir mostrándolo sería mostrarlo corrido.
     Cerrarlo es más honesto —y más barato— que recalcular en cada cuadro. */
  useEffect(() => {
    if (!abierto) return;
    function alTocar(e: PointerEvent) {
      // Se preguntan los DOS, y no es por prolijidad: el panel no es
      // descendiente del disparador —vive fuera del scroller— así que mirando
      // sólo el disparador, apoyar el dedo sobre un número lo cerraba en
      // `pointerdown` y el enlace se desmontaba antes de que llegara el
      // `click`. El selector no navegaba a ningún lado.
      const dentro =
        selector.current?.contains(e.target as Node) ||
        panel.current?.contains(e.target as Node);
      if (!dentro) setAbierto(false);
    }
    function alEnfocar(e: FocusEvent) {
      // Misma pregunta que `alTocar`, para el que se mueve con Tab: si el foco
      // se fue del selector, el panel ya no es lo que la persona está usando.
      const dentro =
        selector.current?.contains(e.target as Node) ||
        panel.current?.contains(e.target as Node);
      if (!dentro) setAbierto(false);
    }
    function alTeclear(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAbierto(false);
        // El foco vuelve de donde salió. Sin esto se queda en el panel que se
        // acaba de desmontar, o sea en el <body>, y el siguiente Tab arranca
        // desde el principio de la página.
        disparador.current?.focus();
        return;
      }
      /*
       * Con el panel abierto, las flechas NO pasan de página.
       *
       * El mando de paso de página escucha en `window` (mando-paginas.tsx) y no
       * sabe que hay un menú abierto: sin esto, elegir un número con el teclado
       * hacía girar la hoja por debajo del panel. Se corta acá porque este
       * escucha en `document`, que viene antes que `window` en el camino del
       * evento.
       */
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.stopPropagation();
      }
    }
    /*
     * Al scrollear o cambiar el tamaño, el panel SIGUE a la barra en vez de
     * cerrarse. La barra es `sticky`, así que mientras la hoja no llegó arriba
     * se mueve con la página; un panel medido una sola vez se le despegaba.
     * Se remide en el cuadro siguiente para no hacerlo una vez por evento.
     */
    let pedido = 0;
    const remedir = () => {
      if (pedido) return;
      pedido = requestAnimationFrame(() => {
        pedido = 0;
        const r = barra.current?.getBoundingClientRect();
        if (r) setCaja({ top: r.bottom, left: r.left, width: r.width });
      });
    };

    document.addEventListener("pointerdown", alTocar);
    document.addEventListener("focusin", alEnfocar);
    document.addEventListener("keydown", alTeclear);
    window.addEventListener("scroll", remedir, { passive: true });
    window.addEventListener("resize", remedir);
    return () => {
      if (pedido) cancelAnimationFrame(pedido);
      document.removeEventListener("pointerdown", alTocar);
      document.removeEventListener("focusin", alEnfocar);
      document.removeEventListener("keydown", alTeclear);
      window.removeEventListener("scroll", remedir);
      window.removeEventListener("resize", remedir);
    };
  }, [abierto]);

  /*
   * Al abrir, el foco entra al panel.
   *
   * Sin esto el teclado no llega nunca: el panel se dibuja al final del <body>
   * —es un portal— así que en orden de tabulación queda DESPUÉS de toda la
   * página, y para alcanzarlo habría que recorrer el diario entero. Entrando
   * acá, el Tab siguiente camina los números y el de después se va del panel,
   * que es cuando `focusin` lo cierra.
   */
  useEffect(() => {
    if (!abierto) return;
    panel.current?.querySelector("a")?.focus();
  }, [abierto]);

  /** Abre midiendo, o cierra. La medida se toma en el mismo gesto que abre:
   *  después ya no cambia, porque cualquier cosa que la movería lo cierra. */
  function alternarSelector() {
    if (abierto) {
      setAbierto(false);
      return;
    }
    const r = barra.current?.getBoundingClientRect();
    if (!r) return;
    setCaja({ top: r.bottom, left: r.left, width: r.width });
    setAbierto(true);
  }

  function abrirMigue() {
    window.dispatchEvent(new Event("migue:abrir"));
  }

  return (
    <nav
      ref={barra}
      /* "Índice del diario" y no "Secciones": es lo que esta barra ES —el
         comentario de arriba ya la llamaba así— y ahora también lo que dice,
         porque las secciones dejaron de ser lo que la organiza. */
      aria-label="Índice del diario"
      className="sticky top-0 z-30 border-y border-ink bg-paper/95 backdrop-blur-sm"
    >
      <div className="mx-auto flex w-full max-w-6xl items-stretch px-2 sm:px-4">
        {/* Las entradas ruedan si no entran; el botón de Migue no se va nunca
            de la vista, así que vive fuera del scroller. */}
        <div className="relative flex min-w-0 flex-1 items-stretch">
        <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.activa ? "page" : undefined}
              className={cn(
                /* `px-2.5` y no `px-3.5` en el teléfono: con tres entradas cada
                   ocho píxeles de aire son ocho que el selector deja de
                   mostrar. De 640 para arriba manda `sm:px-2` y nada cambia. */
                "group relative shrink-0 px-2.5 py-3 text-center font-sans text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-ink-2 transition-colors duration-200 hover:text-ink sm:flex-1 sm:px-2",
                item.activa && "text-ink",
              )}
            >
              {item.etiqueta}
              {/* Filete de acento: pleno en la activa, insinuado al pasar */}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-2.5 bottom-0 h-[2px] origin-left bg-accent transition-transform duration-300 ease-out sm:inset-x-1.5",
                  item.activa
                    ? "scale-x-100"
                    : "scale-x-0 group-hover:scale-x-100",
                )}
              />
            </Link>
          ))}

          {/*
            El selector de ediciones.

            El disparador va acá adentro, al lado de las pestañas, porque es
            una entrada más del índice. El PANEL, en cambio, se dibuja fuera de
            este contenedor: este rueda en horizontal (`overflow-x-auto`) y
            todo lo que cuelgue de acá adentro queda recortado en el borde. Ni
            siquiera sirve `position: fixed` para escaparse: el `backdrop-blur`
            de la barra convierte al <nav> en bloque contenedor de los fijos.
          */}
          <div
            ref={selector}
            className="flex shrink-0 items-stretch sm:flex-1"
          >
            <button
              ref={disparador}
              type="button"
              onClick={alternarSelector}
              aria-expanded={abierto}
              aria-controls={idPanel}
              className={cn(
                "group relative flex w-full items-center justify-center gap-1.5 px-2.5 py-3 text-center font-sans text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-ink-2 transition-colors duration-200 hover:text-ink sm:px-2",
                abierto && "text-ink",
              )}
            >
              {/* El mes solo no dice que esto se pueda tocar ni para qué. El
                  rótulo va en el DOM y fuera de la vista: así el nombre
                  accesible es "Elegir edición. Septiembre 2026" —contiene el
                  texto visible, que es lo que pide el criterio— sin meterle
                  una palabra más a una barra que ya está apretada. */}
              <span className="sr-only">Elegir edición. </span>
              {/* En el teléfono va sólo el mes: "Septiembre 2026" son 165px de
                  una barra que tiene 198 para tres pestañas. El año no se
                  pierde —está en la línea de arriba del masthead, "San Miguel
                  de Tucumán, Septiembre 2026 · N.º 3"— y el lector de pantalla
                  lee las dos formas igual porque el corto es el visible. */}
              <span className="truncate sm:hidden">{edicion.mes.split(" ")[0]}</span>
              <span className="hidden truncate sm:inline">{edicion.mes}</span>
              <ChevronDown
                className={cn(
                  "h-3 w-3 shrink-0 transition-transform duration-300",
                  abierto && "rotate-180",
                )}
                aria-hidden="true"
              />
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-2.5 bottom-0 h-[2px] origin-left bg-accent transition-transform duration-300 ease-out sm:inset-x-1.5",
                  abierto
                    ? "scale-x-100"
                    : "scale-x-0 group-hover:scale-x-100",
                )}
              />
            </button>
          </div>

          {/* El tema del número. No es un enlace: no hay a dónde ir, todas las
              notas son de esto. Es el subtítulo del diario, como el "Edición
              mensual" del masthead pero diciendo de qué va este número. */}
          {tema && (
            <p className="min-w-0 shrink px-3.5 py-3 font-serif text-[0.82rem] italic leading-tight text-ink-2 sm:px-2">
              <span className="truncate">{tema}</span>
            </p>
          )}
        </div>

          {/*
            Que se vea que hay más al costado.

            La barra de scroll está escondida a propósito (arriba), así que en
            el teléfono las entradas que no entran no dejaban ninguna señal: el
            lector veía "PORTADA NOTAS SE…" cortado contra el filete y podía
            leerlo como un defecto, no como algo que se corre. Con tres
            entradas SIEMPRE sobra ancho por debajo de 640px, así que la pista
            va sólo ahí; de 640 para arriba las entradas se estiran y entran.
          */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-paper via-paper/80 to-transparent sm:hidden"
          />
        </div>

        <span className="flex shrink-0 items-center gap-2 border-l border-hairline pl-2.5 sm:pl-3">
          {/* En celular la lupa lleva a la pantalla de búsqueda, que tiene el
              campo grande; en escritorio el campo entra acá mismo. Anda sin
              JavaScript: es un GET a /buscar. */}
          <Link
            href="/buscar"
            aria-label="Buscar en la edición"
            className="pressable inline-flex h-8 w-8 items-center justify-center text-ink-2 hover:text-accent lg:hidden"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </Link>

          <form action="/buscar" className="hidden lg:block">
            <label htmlFor="q-nav" className="sr-only">
              Buscar en la edición
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3"
                aria-hidden="true"
              />
              <input
                id="q-nav"
                name="q"
                type="search"
                placeholder="Buscar"
                className="h-8 w-36 border border-line bg-chrome pl-8 pr-2 font-sans text-[0.7rem] text-ink transition-[width,border-color] duration-300 placeholder:text-ink-3 focus:w-48 focus:border-accent"
              />
            </div>
          </form>

          <button
            type="button"
            onClick={abrirMigue}
            className="pressable inline-flex items-center gap-1.5 border border-accent/40 px-3 py-1.5 font-sans text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-accent hover:border-accent hover:bg-accent hover:text-accent-contrast"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Migue
          </button>
        </span>
      </div>

      {/*
        Los números, colgados de la barra — pero dibujados FUERA de la hoja.

        Acá hay dos cercos, y ninguno se arregla con z-index. El contenedor de
        las pestañas rueda en horizontal (`overflow-x-auto`), así que lo que
        cuelgue de adentro queda recortado en el borde. Y la hoja del diario
        lleva `isolation: isolate` —abre su propio contexto de apilado—, así
        que nada de adentro puede ponerse por encima de las flechas de paso de
        página, que son fijas y viven en el layout: la flecha derecha quedaba
        dibujada arriba de la lista, tapando el número del ejemplar. Subirle la
        capa al <nav> no alcanza, porque esa capa se compara DENTRO de la hoja
        y la hoja no compite.

        Un portal al <body> sale de los dos cercos de una vez. A cambio hay que
        decirle dónde pararse, y eso se mide de la propia barra: queda clavado
        a su borde de abajo y con su mismo ancho.
      */}
      {abierto &&
        caja &&
        createPortal(
          <div
            ref={panel}
            id={idPanel}
            /* El dedo que cae acá no es del papel: sin esto, deslizar sobre la
               lista de números pasaba de página por debajo del panel. Ver
               `esZonaAjena()` en `deslizar-paginas.ts`. */
            data-capa-flotante=""
            style={{ top: caja.top, left: caja.left, width: caja.width }}
            className="fixed z-50 border-b border-ink bg-paper shadow-flotante"
          >
          <ul
            aria-label="Ediciones publicadas"
            className="mx-auto w-full max-w-6xl divide-y divide-hairline px-2 sm:px-4"
          >
            {ediciones.map((e) => {
              const esta = e.slug === edicion.slug;
              return (
                <li key={e.slug}>
                  <Link
                    href={`/edicion/${e.slug}`}
                    aria-current={esta ? "true" : undefined}
                    /* El panel se cierra acá y no en un efecto atado al
                       pathname: elegir un número ES el evento que lo cierra, y
                       la barra sobrevive a la navegación. */
                    onClick={() => setAbierto(false)}
                    className="group flex items-baseline gap-3 py-3.5 transition-colors hover:text-accent"
                  >
                    {/* El tilde marca el número que se está leyendo. Ocupa
                        lugar siempre —aunque esté vacío— para que los meses
                        queden en la misma columna y la lista se lea como una
                        lista y no como un escalón. */}
                    <span className="flex w-4 shrink-0 justify-center pt-0.5 text-accent">
                      {esta && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                    </span>
                    <span className="titular min-w-0 flex-1 text-[1.05rem] leading-snug text-ink group-hover:text-accent">
                      {e.mes}
                    </span>
                    <span className="meta shrink-0 tabular-nums">
                      N.º {e.numero}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          </div>,
          document.body,
        )}
    </nav>
  );
}
