"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import type { SeccionInfo } from "@/lib/data/secciones";
import { cn } from "@/lib/utils";

/** Bandera de secciones bajo el masthead, estilo diario clásico. */
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
    <nav aria-label="Secciones del diario" className="bg-accent">
      <div className="mx-auto flex w-full max-w-6xl items-stretch overflow-x-auto px-2 sm:px-4">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.activa ? "page" : undefined}
            className={cn(
              "shrink-0 px-4 py-2 font-sans text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-strong",
              item.activa && "bg-accent-strong font-semibold",
            )}
          >
            {item.etiqueta}
          </Link>
        ))}
        <button
          type="button"
          onClick={abrirMigue}
          className="ml-auto inline-flex shrink-0 items-center gap-1.5 px-4 py-2 font-sans text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-strong"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          Migue
        </button>
      </div>
    </nav>
  );
}
