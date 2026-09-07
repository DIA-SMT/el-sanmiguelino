"use client";

import { Suspense, useCallback, useId, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  CalendarClock,
  FileText,
  Mailbox,
  MessageSquare,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
} from "lucide-react";
import { LogoHoja } from "@/components/brand/logos";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserChip } from "@/components/user-chip";
import type { Usuario } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * La barra lateral del panel.
 *
 * Vive acá y no en `admin/layout.tsx` por una sola razón: marcar la sección
 * activa necesita la ruta, y la ruta **no se puede leer desde un Server
 * Component**. Es a propósito de Next: el layout no se vuelve a ejecutar en
 * cada navegación del cliente, así que si pudiera leer la ruta la marca
 * quedaría clavada en la primera. `usePathname()` sí se re-renderiza. El
 * layout, entonces, queda server —que es lo que necesita para llamar a
 * `requerirAdmin()`— y sólo esta pieza baja al cliente.
 */

const SECCIONES = [
  { href: "/admin", icono: FileText, texto: "Notas" },
  { href: "/admin/ediciones", icono: CalendarClock, texto: "Ediciones" },
  { href: "/admin/comentarios", icono: MessageSquare, texto: "Comentarios" },
  // Un robot y no las chispas de "magia con inteligencia artificial": Migue es
  // el buscador del diario que además contesta, y el brillito lo vendía como
  // otra cosa.
  { href: "/admin/migue", icono: Bot, texto: "Migue" },
  { href: "/admin/suscripciones", icono: Mailbox, texto: "Suscripciones" },
  { href: "/admin/usuarios", icono: Users, texto: "Usuarios" },
] as const;

/**
 * Qué sección está activa.
 *
 * No alcanza con comparar por igual: el editor vive en `/admin/nota/[slug]` y
 * mientras editás una nota seguís estando en Notas. Se busca la sección más
 * específica que sea prefijo de la ruta, y `/admin` queda de respaldo porque es
 * prefijo de todas las demás y si no ganaría siempre.
 */
function seccionActiva(ruta: string | null): string | null {
  if (!ruta) return null;
  const especifica = SECCIONES.find(
    ({ href }) =>
      href !== "/admin" && (ruta === href || ruta.startsWith(`${href}/`)),
  );
  if (especifica) return especifica.href;
  return ruta === "/admin" || ruta.startsWith("/admin/") ? "/admin" : null;
}

/* ---------------------------------------------------------------------------
   Si la barra está plegada
--------------------------------------------------------------------------- */

/**
 * Plegada o desplegada, guardado en el navegador de cada uno.
 *
 * Es una preferencia de quien trabaja, no un estado de la aplicación: quien
 * pliega la barra la quiere plegada mañana también, y quien no la toca nunca no
 * se entera de que esto existe.
 *
 * Se lee con `useSyncExternalStore` y no con `useState` + efecto, por lo mismo
 * que `ThemeToggle`: en el servidor no hay `localStorage`, así que el HTML se
 * dibuja desplegado y el cliente lo corrige en la hidratación **sin** que React
 * denuncie una diferencia. Con `useState` habría que elegir entre un aviso de
 * hidratación o un parpadeo de 288 a 80 píxeles.
 */
const CLAVE = "sm-panel-barra";

function suscribirse(alCambiar: () => void) {
  // `storage` avisa de los cambios hechos en OTRA pestaña: con el panel abierto
  // dos veces, plegar en una deja de mentirle a la otra.
  window.addEventListener("storage", alCambiar);
  window.addEventListener(CLAVE, alCambiar);
  return () => {
    window.removeEventListener("storage", alCambiar);
    window.removeEventListener(CLAVE, alCambiar);
  };
}

function leer(): boolean {
  try {
    return localStorage.getItem(CLAVE) === "plegada";
  } catch {
    // Modo incógnito o cookies bloqueadas: desplegada, que es el default.
    return false;
  }
}

function guardar(plegada: boolean) {
  try {
    localStorage.setItem(CLAVE, plegada ? "plegada" : "desplegada");
  } catch {
    /* modo incógnito: la preferencia dura lo que dure la pestaña */
  }
  // El evento propio es lo que despierta a este mismo componente: `storage` no
  // se dispara en la pestaña que escribió.
  window.dispatchEvent(new Event(CLAVE));
}

/* ---------------------------------------------------------------------------
   La piel del pie
--------------------------------------------------------------------------- */

/**
 * `ThemeToggle` y `UserChip` viven en `src/components/` porque **los comparte el
 * diario**, y están escritos con el vocabulario del diario: `border-line`
 * (#ddd6c5, beige), `bg-chrome` (crema), `bg-ink text-paper` en el avatar. Sobre
 * la barra del panel eso no se ve: medido, el relleno crema queda a 1,01:1 de la
 * barra blanca y el filete beige a 1,45:1, y en oscuro el relleno es MÁS OSCURO
 * que la barra, así que los dos controles aparecían como manchas.
 *
 * No se los edita: son del diario, y ahí adentro esos colores están bien. Se les
 * cambia el piso. Como `@theme inline` compila `border-line` a
 * `border-color: var(--line)`, redeclarar `--line` en este contenedor repinta
 * todo el subárbol sin que los dos componentes se enteren.
 *
 * Qué se elige y por qué:
 * - `--line` va a `--panel-borde-campo` y no a `--panel-borde`: los dos son
 *   botones sin relleno propio, así que ese filete es su único límite y le toca
 *   el 3:1 de WCAG 1.4.11, igual que a un campo o a un chip inactivo.
 * - `--chrome` va a la superficie hundida: la barra es `--panel-tarjeta`, y un
 *   control del mismo color que su alrededor no se ve.
 * - `--paper` es sólo el color de las iniciales sobre el cuadrado de `--ink`;
 *   pasa a la tarjeta para que el par siga siendo tinta sobre superficie en los
 *   dos temas.
 *
 * **Cuándo se borra esto:** el día que `ThemeToggle` y `UserChip` dejen de ser
 * compartidos —o que el diario y el panel hablen un solo vocabulario—, este
 * objeto queda en un remapeo de cada token a sí mismo: inútil e inofensivo, y se
 * saca de una línea.
 */
const PIEL_DEL_PIE: React.CSSProperties & Record<`--${string}`, string> = {
  "--line": "var(--panel-borde-campo)",
  "--chrome": "var(--panel-tarjeta-2)",
  "--ink": "var(--panel-tinta)",
  "--ink-2": "var(--panel-tinta-2)",
  "--paper": "var(--panel-tarjeta)",
};

/* ---------------------------------------------------------------------------
   Las secciones
--------------------------------------------------------------------------- */

/** La lista de secciones. Recibe el activo en vez de leer la ruta ella misma
 *  para que sirva igual como contenido y como respaldo del `Suspense` de abajo:
 *  una sola copia del marcado, imposible que las dos versiones se separen. */
function ListaSecciones({
  activo,
  plegada,
}: {
  activo: string | null;
  plegada: boolean;
}) {
  return (
    /* En angosto es una fila que se desplaza sola; en ancho, una columna.
       El `py-1.5` de la fila no es relleno decorativo: sin él, el outline de
       foco (2px con 3px de separación) queda recortado por el `overflow-x`.

       La separación es `gap-panel-controles` en los dos ejes, y por la misma
       cuenta: el anillo de foco sangra 5px, así que con menos aire el anillo
       del ítem enfocado se dibuja encima del vecino y deja de leerse a cuál de
       los dos pertenece.

       El tamaño de letra va acá y no en cada ítem, y no es cosmética: los seis
       ítems son un solo cuerpo de texto, y en el ítem el tamaño no sobrevive.
       `cn()` es `twMerge`, y aunque ahora conoce la escala del panel, heredarlo
       desde el `<ul>` es lo que garantiza que los seis midan igual. */
    <ul
      className={cn(
        "flex gap-panel-controles overflow-x-auto px-3 py-1.5 text-panel-sm lg:flex-col lg:overflow-x-visible lg:py-0",
        plegada ? "lg:items-center lg:px-2" : "lg:px-3",
      )}
    >
      {SECCIONES.map(({ href, icono: Icono, texto }) => {
        const esActiva = href === activo;
        return (
          <li key={href} className="shrink-0 lg:shrink">
            <Link
              href={href}
              /* La marca del activo no es sólo el color: además del fondo
                 suave y la negrita, `aria-current` lo dice en voz alta. */
              aria-current={esActiva ? "page" : undefined}
              /* Plegada, el nombre sigue estando para el lector de pantalla
                 —el enlace no puede quedarse sin nombre— y aparece como
                 globito para el mouse. */
              title={plegada ? texto : undefined}
              className={cn(
                "inline-flex min-h-9 w-full items-center gap-2.5 rounded-panel-2 px-3 py-2 whitespace-nowrap transition-colors",
                plegada && "lg:w-auto lg:justify-center lg:px-2.5",
                esActiva
                  ? "bg-panel-wash font-semibold text-accent"
                  : "font-medium text-panel-tinta-2 hover:bg-panel-tarjeta-2 hover:text-panel-tinta",
              )}
            >
              <Icono className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className={plegada ? "lg:sr-only" : undefined}>{texto}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** El único pedazo que depende de la ruta. Aislado para que el `Suspense` de
 *  arriba no tenga que envolver toda la barra. */
function SeccionesConRuta({ plegada }: { plegada: boolean }) {
  return <ListaSecciones activo={seccionActiva(usePathname())} plegada={plegada} />;
}

/* ---------------------------------------------------------------------------
   La barra
--------------------------------------------------------------------------- */

/**
 * Marca arriba, secciones al medio, y abajo de todo el enlace al diario, el
 * cambio de tema y el usuario —que antes vivían en la cabecera y no se pueden
 * perder.
 *
 * **La marca es el camino de vuelta al diario.** Apretar el logotipo de un
 * panel para volver al sitio es lo que hace todo el mundo, y acá no hacía nada:
 * la única puerta era "Ver el diario", abajo de todo y escondida en teléfono.
 * Ahora son dos, y la de arriba es la que se busca sin pensar.
 *
 * **En pantalla ancha se puede plegar a sólo iconos.** El panel es una
 * herramienta de trabajo y las pantallas que más se usan —el editor de notas,
 * la tabla de consultas— son anchas; 288 píxeles de barra siempre presente es
 * una columna de texto menos. Plegada mide 80 y no esconde nada: las seis
 * secciones siguen a un clic, con su nombre en el globito y en el lector de
 * pantalla.
 *
 * **En pantalla angosta no hay ni cajón ni plegado.** La barra se dobla en dos
 * filas arriba de todo: marca y controles en una, las secciones en una tira que
 * se desplaza en la otra. Un cajón esconde seis ítems detrás de un botón, se
 * lleva puesto el foco del teclado y necesita estado; esto no necesita nada, no
 * tapa el contenido y deja cada sección a un toque. Los tres bloques están una
 * sola vez en el DOM y se reordenan con `order`: duplicarlos para "la versión
 * móvil" habría puesto dos `UserChip` vivos a la vez.
 */
export function BarraLateralPanel({ usuario }: { usuario: Usuario }) {
  const idNav = useId();
  const plegada = useSyncExternalStore(suscribirse, leer, () => false);
  const alternar = useCallback(() => guardar(!leer()), []);

  return (
    <aside
      className={cn(
        "flex flex-wrap items-center border-b border-panel-borde bg-panel-tarjeta font-sans lg:sticky lg:top-0 lg:h-dvh lg:shrink-0 lg:flex-col lg:flex-nowrap lg:items-stretch lg:overflow-y-auto lg:border-r lg:border-b-0",
        // La transición es sólo del ancho: es un cambio de layout, y animarle
        // también el color o la sombra a una barra que ocupa toda la altura se
        // nota como un parpadeo.
        "lg:transition-[width] lg:duration-200",
        plegada ? "lg:w-20" : "lg:w-72",
      )}
    >
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2.5 px-4 py-3 lg:order-1 lg:flex-none lg:py-5",
          plegada ? "lg:flex-col lg:gap-2 lg:px-2" : "lg:px-5",
        )}
      >
        {/* La marca lleva al diario.
            El logo NO va como decorativo aunque ahora esté adentro de un
            enlace: el texto de al lado dice "Administración" y "El
            Sanmiguelino", pero no nombra a la Municipalidad, y plegada la
            marca es sólo el logo. Su etiqueta se suma al nombre del enlace, y
            el `sr-only` del final es el que dice a dónde lleva — sin eso, el
            enlace se anunciaría como el nombre del municipio y no como una
            puerta. */}
        <Link
          href="/diario"
          title="Ir al diario"
          className="pressable flex min-w-0 items-center gap-2.5 rounded-panel-2 text-left hover:text-accent focus-visible:outline-offset-4"
        >
          <LogoHoja className="h-8 w-8 shrink-0" />
          <span className={cn("min-w-0", plegada && "lg:hidden")}>
            <span className="block text-panel-base font-semibold text-panel-tinta">
              Administración
            </span>
            <span className="block truncate text-panel-sm text-panel-tinta-3">
              El Sanmiguelino
            </span>
          </span>
          <span className="sr-only">Ir al diario</span>
        </Link>

        {/* Plegar y desplegar. Sólo en pantalla ancha, que es donde la barra es
            una columna: en angosto ya es una tira y no hay nada que plegar.
            `aria-expanded` + `aria-controls` es lo que le dice a un lector de
            pantalla qué hace este botón, porque su nombre cambia y su efecto
            está tres bloques más abajo. */}
        <button
          type="button"
          onClick={alternar}
          aria-expanded={!plegada}
          aria-controls={idNav}
          aria-label={plegada ? "Desplegar el menú" : "Plegar el menú"}
          title={plegada ? "Desplegar el menú" : "Plegar el menú"}
          className={cn(
            "pressable hidden h-8 w-8 shrink-0 items-center justify-center rounded-panel-3 text-panel-tinta-3 hover:bg-panel-tarjeta-2 hover:text-panel-tinta lg:inline-flex",
            !plegada && "lg:ml-auto",
          )}
        >
          {plegada ? (
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      <nav
        id={idNav}
        aria-label="Secciones del panel"
        className="order-3 w-full pb-2 lg:order-2 lg:pb-0"
      >
        {/* El respaldo del Suspense es la misma lista sin nada marcado.
            `usePathname()` puede suspender cuando la ruta de abajo tiene un
            parámetro dinámico que no se conoce al prerenderizar —y `/admin` lo
            tiene: `nota/[slug]`—. Sin este límite, prender `cacheComponents`
            algún día rompería la compilación entera desde acá. */}
        <Suspense fallback={<ListaSecciones activo={null} plegada={plegada} />}>
          <SeccionesConRuta plegada={plegada} />
        </Suspense>
      </nav>

      {/* El estilo del pie sale de PIEL_DEL_PIE, arriba: ahí está por qué se
          redeclaran los tokens del diario acá adentro y cuándo se borra. */}
      <div
        style={PIEL_DEL_PIE}
        className={cn(
          "flex shrink-0 flex-wrap items-center gap-panel-controles px-4 py-3 lg:order-4 lg:mt-auto lg:border-t lg:border-panel-borde lg:py-4",
          plegada ? "lg:flex-col lg:px-2" : "lg:px-4",
        )}
      >
        <Link
          href="/diario"
          title="Ver el diario"
          className={cn(
            "pressable hidden min-h-8 items-center gap-2 rounded-panel-2 px-2.5 py-1.5 text-panel-sm font-medium text-panel-tinta-2 hover:bg-panel-tarjeta-2 hover:text-panel-tinta sm:inline-flex",
            plegada ? "lg:w-auto lg:justify-center" : "lg:w-full",
          )}
        >
          <Newspaper className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className={plegada ? "lg:sr-only" : undefined}>
            Ver el diario
          </span>
        </Link>
        <ThemeToggle />
        {/* Plegada, el chip se queda con el monograma: el nombre completo no
            entra en 80px y `sm:not-sr-only` no lo puede saber, porque mira el
            ancho de la ventana y no el del hueco. */}
        <UserChip usuario={usuario} soloMonograma={plegada} />
      </div>
    </aside>
  );
}
