import Link from "next/link";
import { LogoHoja } from "@/components/brand/logos";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserChip } from "@/components/user-chip";
import { SeccionesNav } from "@/components/secciones-nav";
import { seccionesDeEdicion } from "@/lib/data/secciones";
import type { Edicion, Usuario } from "@/lib/types";

/** Cabecera estilo bandera clásica: franja institucional, bandera centrada
 *  con el logo en recuadro, línea de fecha entre filetes y barra de
 *  secciones.
 *
 *  La barra de secciones queda *fuera* del <header> a propósito: al ser
 *  hermana de la cabecera, su bloque contenedor es la hoja entera y el
 *  `position: sticky` funciona en todo el largo de la página. Dentro del
 *  header solo podría pegarse hasta donde termina el header, o sea nada. */
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
    <>
      <header>
        {/* Franja institucional */}
        <div className="border-b border-hairline">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
            <p className="font-serif text-[0.7rem] italic text-ink-3">
              Municipalidad de San Miguel de Tucumán
            </p>
            <p className="hidden font-serif text-[0.7rem] italic text-ink-3 sm:block">
              Publicación gratuita, prohibida su venta
            </p>
          </div>
        </div>

        {/* Bandera */}
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[auto_1fr] items-center gap-4 px-4 pb-3 pt-5 sm:grid-cols-[auto_1fr_auto] sm:gap-6 sm:px-6 sm:pt-7">
          {/* El logo, encuadrado como el sello del impreso */}
          <div className="flex h-14 w-14 items-center justify-center border border-ink p-[3px] sm:h-[4.5rem] sm:w-[4.5rem]">
            <span className="flex h-full w-full items-center justify-center border border-ink/25">
              <LogoHoja className="h-8 w-8 sm:h-11 sm:w-11" />
            </span>
          </div>

          <div className="col-start-2 row-start-1 min-w-0 text-center">
            {/* El nombre del diario es la bandera, no el encabezado del
                contenido: el h1 de cada página es su propio titular. */}
            <Link
              href="/diario"
              className="group inline-block max-w-full"
              aria-label="Ir a la portada"
            >
              <p className="bandera text-[clamp(1.6rem,7.5vw,4.4rem)] text-ink transition-colors group-hover:text-accent-strong">
                El Sanmiguelino
              </p>
            </Link>
            <p className="meta mt-2 hidden sm:block">
              Diario digital · Una edición por mes
            </p>
          </div>

          <div className="col-span-2 row-start-2 flex items-center justify-between gap-2 font-sans sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:flex-col sm:items-end sm:gap-2.5">
            <ThemeToggle />
            <UserChip usuario={usuario} />
          </div>
        </div>

        {/* Línea de fecha entre filetes, como el impreso */}
        <div className="mx-auto w-full max-w-6xl px-4 pb-4 sm:px-6">
          <div className="rule-double mb-[7px] flex flex-wrap items-center justify-center gap-x-4 gap-y-1 py-2 sm:justify-between">
            <p className="meta">San Miguel de Tucumán</p>
            <p className="meta text-ink">
              {edicion.mes} · N.º {edicion.numero}
            </p>
            <p className="meta hidden sm:block">
              {edicion.etiqueta ?? "Edición mensual"}
            </p>
          </div>
        </div>
      </header>

      {/* Barra de secciones */}
      <SeccionesNav
        secciones={seccionesDeEdicion(edicion)}
        seccionActiva={seccionActiva}
      />
    </>
  );
}
