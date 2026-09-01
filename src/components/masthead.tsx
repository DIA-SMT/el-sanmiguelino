import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { LogoHoja } from "@/components/brand/logos";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserChip } from "@/components/user-chip";
import { SeccionesNav } from "@/components/secciones-nav";
import { esAdmin } from "@/lib/auth/dal";
import type { SeccionInfo } from "@/lib/data/secciones";
import type { EdicionResumen, Usuario } from "@/lib/types";

/**
 * La cabecera del diario, en sus dos tamaños.
 *
 * En el impreso la tapa lleva la bandera grande y las páginas interiores una
 * cabecera chica: dos filetes finos con el logotipo centrado en el medio, y
 * debajo el folio y la fecha en los extremos. Eso es lo que hace `pagina`:
 * si viene un número, se dibuja la cabecera interior de esa página.
 *
 * Todo lo demás —la franja institucional, el tema, el usuario y la barra de
 * secciones— se queda igual en las dos. Es cromo de la web, no del papel: el
 * impreso no lo tiene porque no lo necesita, pero acá es la única forma de
 * moverse por la edición.
 *
 * La barra de secciones queda *fuera* del <header> a propósito: al ser
 * hermana de la cabecera, su bloque contenedor es la hoja entera y el
 * `position: sticky` funciona en todo el largo de la página. Dentro del
 * header solo podría pegarse hasta donde termina el header, o sea nada.
 *
 * **Por qué pregunta el permiso acá y no lo recibe como prop.** La cabecera la
 * renderizan las cuatro páginas del diario, no el layout, así que cada una
 * tendría que acordarse de pasar el dato — y una que se olvide no muestra un
 * error, muestra un diario sin la puerta al panel. Preguntando acá no hay nada
 * que olvidarse. `esAdmin()` está memoizado con `cache()`, así que si el layout
 * ya lo resolvió en este mismo render, esto no cuesta nada.
 *
 * Que el botón no se dibuje no es lo que protege el panel: `/admin` responde 404
 * por su cuenta a quien no corresponde. Esto es para no anunciar una puerta que
 * la mayoría no puede abrir.
 */
export async function Masthead({
  edicion,
  secciones,
  usuario,
  seccionActiva,
  pagina,
}: {
  edicion: EdicionResumen;
  secciones: SeccionInfo[];
  usuario: Usuario;
  seccionActiva?: string;
  /** Folio de la página. Presente = cabecera interior chica; ausente = tapa. */
  pagina?: number;
}) {
  const esInterior = typeof pagina === "number";
  const puedeAdministrar = await esAdmin();
  // El folio va al borde EXTERIOR de la hoja, como en cualquier impreso: en
  // una página par —que en un pliego cae a la izquierda— el exterior es la
  // izquierda; en una impar, la derecha.
  const folioALaIzquierda = esInterior && pagina % 2 === 0;
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
              {puedeAdministrar && (
                <Link
                  href="/admin"
                  /* El texto está siempre en el DOM: en pantalla chica se
                     esconde con `sr-only`, que lo saca de la vista sin sacarlo
                     del lector de pantalla. Con `hidden` el botón se quedaría
                     sin nombre accesible justo en el teléfono. */
                  className="pressable inline-flex items-center gap-1.5 border border-line bg-chrome px-2 py-[0.42rem] font-sans text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-ink-2 hover:border-ink hover:text-ink sm:px-2.5"
                >
                  <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only sm:not-sr-only">Administración</span>
                </Link>
              )}
              <ThemeToggle />
              <UserChip usuario={usuario} />
            </div>
          </div>
        </div>

        {esInterior ? (
          /* Cabecera de página interior: dos filetes finos con el logotipo
             chico en el medio, y debajo el folio y la fecha en los extremos.
             En el papel la tapa es lo único que lleva la bandera grande. */
          <div className="mx-auto w-full max-w-6xl px-4 pb-3 pt-4 sm:px-6">
            <div className="border-y border-ink py-1.5">
              <Link
                href="/diario"
                className="group flex items-center justify-center gap-[0.3em]"
                aria-label="Ir a la portada"
              >
                <span className="bandera text-[clamp(0.85rem,2.4vw,1.15rem)] text-ink transition-colors group-hover:text-accent-strong">
                  El Sanmiguelino
                </span>
                <LogoHoja className="h-[0.85em] w-[0.85em] shrink-0 text-[clamp(0.85rem,2.4vw,1.15rem)]" />
              </Link>
            </div>
            <div
              className={`mt-1 flex items-baseline gap-3 font-sans text-[0.62rem] text-ink-3 ${
                folioALaIzquierda ? "flex-row" : "flex-row-reverse"
              }`}
            >
              <p className="tabular-nums">Pág. {pagina}</p>
              <p className="ml-auto truncate">
                San Miguel de Tucumán, {edicion.mes}.
              </p>
            </div>
          </div>
        ) : (
          /* La bandera de tapa: filete grueso, el logotipo en versales con la
             hoja A LA DERECHA —no encuadrada a la izquierda, que era invento
             nuestro—, otro filete, y debajo una sola línea centrada. */
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
                .meta va en versales muy espaciadas —bien para un folio, mal
                para una línea que incluye el nombre de la ciudad. */}
            <p className="mt-1.5 text-center font-sans text-[0.7rem] text-ink-3">
              San Miguel de Tucumán, {edicion.mes} · N.º {edicion.numero}
              {edicion.etiqueta ? ` · ${edicion.etiqueta}` : ""}
            </p>
          </div>
        )}
      </header>

      {/* Barra de secciones */}
      <SeccionesNav
        secciones={secciones}
        seccionActiva={seccionActiva}
        tema={edicion.tema}
      />
    </>
  );
}
