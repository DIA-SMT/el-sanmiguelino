"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Sparkles } from "lucide-react";
import type { SeccionInfo } from "@/lib/data/secciones";
import { cn } from "@/lib/utils";

/** Bandera de secciones bajo el masthead: sobre papel, entre filetes, en
 *  versalitas espaciadas y repartidas a lo ancho, con filete de acento en la
 *  sección abierta. Queda pegada arriba al bajar, así el índice del diario
 *  está siempre a mano —y por eso lleva fondo opaco, para que el texto de la
 *  nota no se transparente por debajo. */
export function SeccionesNav({
  secciones,
  seccionActiva,
}: {
  secciones: SeccionInfo[];
  /** slug de la sección activa cuando se está leyendo una nota */
  seccionActiva?: string;
}) {
  const pathname = usePathname();

  const items: { etiqueta: string; href: string; activa: boolean }[] = [
    { etiqueta: "Portada", href: "/diario", activa: pathname === "/diario" },
    ...secciones.map((s) => ({
      etiqueta: s.nombre,
      href: `/seccion/${s.slug}`,
      activa: pathname === `/seccion/${s.slug}` || seccionActiva === s.slug,
    })),
  ];

  function abrirMigue() {
    window.dispatchEvent(new Event("migue:abrir"));
  }

  return (
    <nav
      aria-label="Secciones del diario"
      className="sticky top-0 z-30 border-y border-ink bg-paper/95 backdrop-blur-sm"
    >
      <div className="mx-auto flex w-full max-w-6xl items-stretch px-2 sm:px-4">
        {/* Las secciones ruedan si no entran; el botón de Migue no se va nunca
            de la vista, así que vive fuera del scroller. */}
        <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.activa ? "page" : undefined}
              className={cn(
                "group relative shrink-0 px-3.5 py-3 text-center font-sans text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-ink-2 transition-colors duration-200 hover:text-ink sm:flex-1 sm:px-2",
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
    </nav>
  );
}
