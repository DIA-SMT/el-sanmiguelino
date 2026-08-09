import Link from "next/link";
import { LogoHoja } from "@/components/brand/logos";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserChip } from "@/components/user-chip";
import { SeccionesNav } from "@/components/secciones-nav";
import { seccionesDeEdicion } from "@/lib/data/secciones";
import type { Edicion, Usuario } from "@/lib/types";

/** Cabecera estilo bandera clásica: franja institucional, masthead centrado
 *  con el logo en recuadro, barra de secciones y franja con doble filete. */
export function Masthead({
  edicion,
  usuario,
  seccionActiva,
}: {
  edicion: Edicion;
  usuario: Usuario;
  seccionActiva?: string;
}) {
  return (
    <header className="border-b border-line bg-paper">
      {/* Franja institucional */}
      <div className="border-b border-ink">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-1.5 sm:px-6">
          <p className="font-serif text-[0.7rem] italic text-ink-2">
            Municipalidad de San Miguel de Tucumán
          </p>
          <p className="hidden font-serif text-[0.7rem] italic text-ink-2 sm:block">
            Publicación gratuita, prohibida su venta
          </p>
        </div>
      </div>

      {/* Bandera: logo en recuadro + masthead centrado + usuario */}
      <div className="mx-auto grid w-full max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-4 sm:gap-5 sm:px-6">
        <div className="flex h-12 w-12 items-center justify-center border-2 border-ink sm:h-16 sm:w-16">
          <LogoHoja className="h-8 w-8 sm:h-11 sm:w-11" />
        </div>
        <div className="min-w-0 text-center">
          <Link href="/diario" className="inline-block">
            <h1 className="font-display text-3xl font-black uppercase leading-none tracking-tight text-ink sm:text-5xl">
              El Sanmiguelino
            </h1>
          </Link>
          <p className="mt-1.5 font-sans text-[0.6rem] uppercase tracking-[0.22em] text-ink-2 sm:text-[0.7rem]">
            San Miguel de Tucumán · {edicion.mes} · N.º {edicion.numero}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 font-sans">
          <ThemeToggle />
          <UserChip usuario={usuario} />
        </div>
      </div>

      {/* Barra de secciones */}
      <SeccionesNav
        secciones={seccionesDeEdicion(edicion)}
        seccionActiva={seccionActiva}
      />

      {/* Franja con doble filete */}
      <div className="border-b-[3px] border-double border-ink">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-1.5 sm:px-6">
          <p className="font-serif text-[0.7rem] italic text-ink-2">
            Todas las noticias de la ciudad
          </p>
          <p className="font-serif text-[0.7rem] italic text-ink-2">
            {edicion.etiqueta ?? "Edición mensual"} en exclusiva
          </p>
        </div>
      </div>
    </header>
  );
}
