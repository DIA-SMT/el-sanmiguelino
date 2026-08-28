import Link from "next/link";
import { LogoDireccionIA, LogoHoja } from "@/components/brand/logos";
import { SuscripcionPapel } from "@/components/suscripcion-papel";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t-[3px] border-double border-ink bg-paper-2">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[auto_1fr_auto] md:items-center md:gap-12">
        <div className="flex items-center gap-3.5">
          <LogoHoja className="h-11 w-11 shrink-0" />
          <p className="bandera text-[1.1rem] text-ink">El Sanmiguelino</p>
        </div>

        <div className="border-line md:border-x md:px-12 md:text-center">
          <p className="font-serif text-[0.9rem] leading-relaxed text-ink-2">
            Municipalidad de San Miguel de Tucumán · 9 de Julio 570, San Miguel
            de Tucumán (4000), Tucumán.
          </p>
          <p className="meta mt-2">Publicación gratuita, prohibida su venta</p>

          {/* Anotarse para recibirlo impreso. Va en el pie y no en la bandera
              porque no es navegación: es algo que se hace una vez, y el pie es
              donde uno mira cuando ya leyó. */}
          <div className="mt-4 flex justify-center">
            <SuscripcionPapel />
          </div>
          {/* El archivo se llega desde el pie, que está en todas las páginas.
              En la bandera competiría con las secciones de la edición en curso,
              que es lo que la mayoría viene a leer. */}
          <p className="mt-2.5">
            <Link
              href="/archivo"
              className="enlace font-sans text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink-2"
            >
              Números anteriores
            </Link>
          </p>
        </div>

        <div className="flex items-center gap-3 md:justify-end">
          <span className="meta">Desarrollado por</span>
          <LogoDireccionIA />
        </div>
      </div>
    </footer>
  );
}
