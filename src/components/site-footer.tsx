import Link from "next/link";
import { LogoSanmiguelino, LogoSubsecretaria } from "@/components/brand/logos";
import { SuscripcionPapel } from "@/components/suscripcion-papel";
import { usuarioActual } from "@/lib/auth/dal";

/**
 * El pie pregunta quién está leyendo, y es sólo para el formulario de
 * suscripción: si hay sesión, el nombre ya lo sabemos y no se lo pedimos de
 * nuevo. Sin sesión —leer es libre—, el formulario explica que anotarse pide
 * ingresar. `usuarioActual` y no `getUsuario` suelto: está memoizado, y la
 * página y el layout ya lo pidieron en el mismo render.
 *
 * Desde el rediseño de octubre de 2026 el pie es el cierre de un diario —el
 * pie de imprenta—: columnas separadas por filetes finos, rótulos en
 * versalitas y, abajo de todo, la línea de créditos. Todo lo que dice es real:
 * la dirección de la Municipalidad, las dos puertas del diario que existen
 * (la edición y el archivo), el papel, quién lo hace y de quién es la foto.
 */
export async function SiteFooter() {
  const usuario = await usuarioActual();
  return (
    <footer className="mt-auto border-t-[3px] border-double border-ink bg-paper-2">
      <div className="mx-auto w-full max-w-6xl px-4 pt-10 pb-6 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr] lg:gap-0">
          <div className="lg:pr-8">
            <LogoSanmiguelino className="w-full max-w-[13rem] text-ink" />
            <p className="mt-3 max-w-xs font-serif text-[0.9rem] leading-relaxed text-ink-2">
              El periódico mensual de la Municipalidad de San Miguel de
              Tucumán, en su versión digital.
            </p>
          </div>

          <div className="border-line lg:border-l lg:px-8">
            <h2 className="meta text-ink">La Municipalidad</h2>
            <p className="mt-3 font-serif text-[0.9rem] leading-relaxed text-ink-2">
              9 de Julio 570
              <br />
              San Miguel de Tucumán (4000)
              <br />
              Tucumán
            </p>
          </div>

          {/* El archivo se llega desde el pie, que está en todas las páginas.
              En la bandera competiría con las secciones de la edición en curso,
              que es lo que la mayoría viene a leer. */}
          <nav aria-label="El diario" className="border-line lg:border-l lg:px-8">
            <h2 className="meta text-ink">El diario</h2>
            <ul className="mt-3 grid gap-2 font-sans text-[0.8rem]">
              <li>
                <Link href="/diario" className="enlace text-ink-2">
                  La edición del mes
                </Link>
              </li>
              <li>
                <Link href="/archivo" className="enlace text-ink-2">
                  Números anteriores
                </Link>
              </li>
            </ul>
          </nav>

          {/* Anotarse para recibirlo impreso. Va en el pie y no en la bandera
              porque no es navegación: es algo que se hace una vez, y el pie es
              donde uno mira cuando ya leyó.

              Acá iba "Publicación gratuita, prohibida su venta". Se sacó: esa
              leyenda es del EJEMPLAR IMPRESO —lo que no se puede vender es el
              papel— y en la web no dice nada. */}
          <div className="border-line lg:border-l lg:pl-8">
            <h2 className="meta text-ink">En papel</h2>
            <p className="mt-3 mb-3 font-serif text-[0.9rem] leading-relaxed text-ink-2">
              El mismo diario, impreso, en tu casa.
            </p>
            <SuscripcionPapel
              nombre={usuario?.nombre ?? ""}
              conSesion={usuario !== null}
            />
          </div>
        </div>

        {/* Los créditos. El de la foto lo pide su licencia (CC BY-SA 4.0, ver
            `public/portada/README.md`) y hasta acá no estaba en ningún lado.
            El día que la panorámica se cambie por una foto propia del
            municipio, esta línea se cambia junto con el archivo. */}
        <div className="mt-10 flex flex-col gap-4 border-t border-ink pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl font-sans text-[0.68rem] leading-relaxed text-ink-3">
            Foto de la ciudad: aeropuertotucuman.blogspot.com.ar, vía{" "}
            <a
              href="https://commons.wikimedia.org/wiki/File:Panor%C3%A1mica_del_centro_tucumano.jpg"
              className="enlace"
              rel="noopener"
              target="_blank"
            >
              Wikimedia Commons
            </a>{" "}
            (
            <a
              href="https://creativecommons.org/licenses/by-sa/4.0/deed.es"
              className="enlace"
              rel="license noopener"
              target="_blank"
            >
              CC BY-SA 4.0
            </a>
            ).
          </p>
          <div className="flex items-center gap-3">
            <span className="meta">Desarrollado por</span>
            <LogoSubsecretaria />
          </div>
        </div>
      </div>
    </footer>
  );
}
