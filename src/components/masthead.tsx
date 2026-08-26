import Link from "next/link";
import { LogoHoja } from "@/components/brand/logos";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserChip } from "@/components/user-chip";
import { SeccionesNav } from "@/components/secciones-nav";
import type { SeccionInfo } from "@/lib/data/secciones";
import type { EdicionResumen, Usuario } from "@/lib/types";

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
  secciones,
  usuario,
  seccionActiva,
}: {
  edicion: EdicionResumen;
  secciones: SeccionInfo[];
  usuario: Usuario;
  seccionActiva?: string;
}) {
  return (
    <>
      <header>
        {/* Franja institucional. Se queda con los controles —tema y usuario—
            para que la bandera quede limpia: en el papel ahí no hay nada más
            que el nombre del diario. */}
        <div className="border-b border-hairline">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
            <p className="font-sans text-[0.7rem] text-ink-3">
              Municipalidad de San Miguel de Tucumán
            </p>
            <div className="flex items-center gap-2.5">
              <ThemeToggle />
              <UserChip usuario={usuario} />
            </div>
          </div>
        </div>

        {/* La bandera, con la forma del impreso: filete grueso, el logotipo en
            versales con la hoja A LA DERECHA —no encuadrada a la izquierda,
            que era invento nuestro—, otro filete, y debajo una sola línea
            centrada con lugar, mes y número. */}
        <div className="mx-auto w-full max-w-6xl px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
          <div className="border-y-[3px] border-ink py-3 sm:py-4">
            <Link
              href="/diario"
              className="group flex items-center justify-center gap-[0.35em]"
              aria-label="Ir a la portada"
            >
              <span className="bandera text-[clamp(1.5rem,8.2vw,4.6rem)] text-ink transition-colors group-hover:text-accent-strong">
                El Sanmiguelino
              </span>
              {/* La hoja acompaña al logotipo y escala con él: en el papel es
                  parte del logotipo, no un sello aparte. */}
              <LogoHoja className="h-[0.78em] w-[0.78em] shrink-0 text-[clamp(1.5rem,8.2vw,4.6rem)]" />
            </Link>
          </div>
          {/* Caja normal y diminuta, como en el papel. No usa .meta porque
              .meta va en versales muy espaciadas —bien para un folio, mal para
              una línea que incluye el nombre de la ciudad. */}
          <p className="mt-1.5 text-center font-sans text-[0.7rem] text-ink-3">
            San Miguel de Tucumán, {edicion.mes} · N.º {edicion.numero}
            {edicion.etiqueta ? ` · ${edicion.etiqueta}` : ""}
          </p>
        </div>
      </header>

      {/* Barra de secciones */}
      <SeccionesNav secciones={secciones} seccionActiva={seccionActiva} />
    </>
  );
}
