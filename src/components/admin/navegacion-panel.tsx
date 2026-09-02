"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  FileText,
  Mailbox,
  MessageSquare,
  Newspaper,
  Sparkles,
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
  { href: "/admin/migue", icono: Sparkles, texto: "Migue" },
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

/**
 * La piel del pie de la barra.
 *
 * `ThemeToggle` y `UserChip` viven en `src/components/` porque **los comparte el
 * diario**, y están escritos con el vocabulario del diario: `border-line`
 * (#ddd6c5, beige), `bg-chrome` (crema), `bg-ink text-paper` en el avatar. Sobre
 * la barra del panel eso no se ve: medido, el relleno crema queda a 1,01:1 de la
 * barra blanca y el filete beige a 1,45:1, y en oscuro el relleno es MÁS OSCURO
 * que la barra, así que los dos controles aparecían como manchas. Al lado tienen
 * "Ver el diario", que sí habla en tokens del panel: eran el último lugar donde
 * el estilo viejo seguía en pantalla.
 *
 * No se los edita: son del diario, y ahí adentro esos colores están bien. Se les
 * cambia el piso. Como `@theme inline` compila `border-line` a
 * `border-color: var(--line)`, redeclarar `--line` en este contenedor repinta
 * todo el subárbol sin que los dos componentes se enteren. Es el mismo recurso
 * que ya usa `admin/migue/page.tsx` con los gráficos.
 *
 * Qué se elige y por qué:
 * - `--line` va a `--panel-borde-campo` y no a `--panel-borde`: los dos son
 *   botones sin relleno propio, así que ese filete es su único límite y le toca
 *   el 3:1 de WCAG 1.4.11, igual que a un campo o a un chip inactivo.
 * - `--chrome` va a la superficie hundida: la barra es `--panel-tarjeta`, y un
 *   control del mismo color que su alrededor no se ve. Misma regla que el
 *   `sobre` de `clasesDeCampo`.
 * - `--paper` es sólo el color de las iniciales sobre el cuadrado de `--ink`;
 *   pasa a la tarjeta para que el par siga siendo tinta sobre superficie en los
 *   dos temas.
 *
 * Lo que este remapeo NO puede arreglar son las esquinas rectas de los dos
 * controles: no salen de un token sino de la ausencia de una clase, y llegar a
 * ellas desde acá pediría un selector contra el marcado ajeno. Quedan rectas a
 * propósito hasta que alguien pueda tocar esos archivos.
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

/** La lista de secciones. Recibe el activo en vez de leer la ruta ella misma
 *  para que sirva igual como contenido y como respaldo del `Suspense` de abajo:
 *  una sola copia del marcado, imposible que las dos versiones se separen. */
function ListaSecciones({ activo }: { activo: string | null }) {
  return (
    /* En angosto es una fila que se desplaza sola; en ancho, una columna.
       El `py-1.5` de la fila no es relleno decorativo: sin él, el outline de
       foco (2px con 3px de separación) queda recortado por el `overflow-x`.

       La separación es `gap-panel-controles` en los dos ejes, y por la misma
       cuenta: el anillo de foco sangra 5px, así que con los 4px de antes en la
       fila y los 2px en la columna el anillo del ítem enfocado se dibujaba
       encima del vecino y dejaba de leerse a cuál de los dos pertenecía —justo
       en la pieza que más se recorre con el teclado—.

       El tamaño de letra va acá y no en cada ítem, y no es cosmética: los cinco
       ítems son un solo cuerpo de texto, y en el ítem el tamaño no sobrevive.
       `cn()` es `twMerge`, y `twMerge` no conoce los tokens de la casa: ve
       `text-panel-sm` y `text-panel-tinta-2` y los toma a los dos por color,
       así que se queda con el último y el tamaño desaparece. Heredado desde el
       `<ul>` no pasa por ese merge. (Antes no se notaba porque `text-[0.82rem]`
       era un valor arbitrario con unidad y `twMerge` sí lo reconocía como
       tamaño; el problema nació con los tokens.) */
    <ul className="flex gap-panel-controles overflow-x-auto px-3 py-1.5 text-panel-sm lg:flex-col lg:overflow-x-visible lg:px-3 lg:py-0">
      {SECCIONES.map(({ href, icono: Icono, texto }) => {
        const esActiva = href === activo;
        return (
          <li key={href} className="shrink-0 lg:shrink">
            <Link
              href={href}
              /* La marca del activo no es sólo el color: además del fondo
                 suave y la negrita, `aria-current` lo dice en voz alta. */
              aria-current={esActiva ? "page" : undefined}
              className={cn(
                "inline-flex min-h-9 w-full items-center gap-2.5 rounded-panel-2 px-3 py-2 whitespace-nowrap transition-colors",
                esActiva
                  ? "bg-panel-wash font-semibold text-accent"
                  : "font-medium text-panel-tinta-2 hover:bg-panel-tarjeta-2 hover:text-panel-tinta",
              )}
            >
              <Icono className="h-4 w-4 shrink-0" aria-hidden="true" />
              {texto}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** El único pedazo que depende de la ruta. Aislado para que el `Suspense` de
 *  arriba no tenga que envolver toda la barra. */
function SeccionesConRuta() {
  return <ListaSecciones activo={seccionActiva(usePathname())} />;
}

/**
 * La barra: marca arriba, secciones al medio, y abajo de todo el enlace al
 * diario, el cambio de tema y el usuario —que antes vivían en la cabecera y no
 * se pueden perder.
 *
 * **En pantalla angosta no hay cajón ni menú desplegable.** La barra se dobla
 * en dos filas arriba de todo: marca y controles en una, las secciones en una
 * tira que se desplaza en la otra. Un cajón esconde seis ítems detrás de un
 * botón, se lleva puesto el foco del teclado y necesita estado; esto no
 * necesita nada, no tapa el contenido y deja cada sección a un toque. Los tres
 * bloques están una sola vez en el DOM y se reordenan con `order`: duplicarlos
 * para "la versión móvil" habría puesto dos `UserChip` vivos a la vez.
 */
export function BarraLateralPanel({ usuario }: { usuario: Usuario }) {
  return (
    <aside className="flex flex-wrap items-center border-b border-panel-borde bg-panel-tarjeta font-sans lg:sticky lg:top-0 lg:h-dvh lg:w-72 lg:shrink-0 lg:flex-col lg:flex-nowrap lg:items-stretch lg:overflow-y-auto lg:border-r lg:border-b-0">
      <div className="flex min-w-0 flex-1 items-center gap-2.5 px-4 py-3 lg:order-1 lg:flex-none lg:px-5 lg:py-5">
        {/* No va como decorativo: el texto de al lado dice "Administración" y
            "El Sanmiguelino", pero no nombra a la Municipalidad. */}
        <LogoHoja className="h-8 w-8 shrink-0" />
        <span className="min-w-0">
          <span className="block text-panel-base font-semibold text-panel-tinta">
            Administración
          </span>
          <span className="block truncate text-panel-sm text-panel-tinta-3">
            El Sanmiguelino
          </span>
        </span>
      </div>

      <nav
        aria-label="Secciones del panel"
        className="order-3 w-full pb-2 lg:order-2 lg:pb-0"
      >
        {/* El respaldo del Suspense es la misma lista sin nada marcado.
            `usePathname()` puede suspender cuando la ruta de abajo tiene un
            parámetro dinámico que no se conoce al prerenderizar —y `/admin` lo
            tiene: `nota/[slug]`—. Sin este límite, prender `cacheComponents`
            algún día rompería la compilación entera desde acá. */}
        <Suspense fallback={<ListaSecciones activo={null} />}>
          <SeccionesConRuta />
        </Suspense>
      </nav>

      {/* El estilo del pie sale de PIEL_DEL_PIE, arriba: ahí está por qué se
          redeclaran los tokens del diario acá adentro y cuándo se borra. */}
      <div
        style={PIEL_DEL_PIE}
        className="flex shrink-0 flex-wrap items-center gap-panel-controles px-4 py-3 lg:order-4 lg:mt-auto lg:border-t lg:border-panel-borde lg:px-4 lg:py-4"
      >
        <Link
          href="/diario"
          className="pressable hidden min-h-8 items-center gap-2 rounded-panel-2 px-2.5 py-1.5 text-panel-sm font-medium text-panel-tinta-2 hover:bg-panel-tarjeta-2 hover:text-panel-tinta sm:inline-flex lg:w-full"
        >
          <Newspaper className="h-4 w-4 shrink-0" aria-hidden="true" />
          Ver el diario
        </Link>
        <ThemeToggle />
        <UserChip usuario={usuario} />
      </div>
    </aside>
  );
}
