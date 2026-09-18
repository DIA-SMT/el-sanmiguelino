import Link from "next/link";
import { LogoSanmiguelino, LogoSubsecretaria } from "@/components/brand/logos";
import { SuscripcionPapel } from "@/components/suscripcion-papel";
import { getUsuario } from "@/lib/auth/session";

/**
 * El pie pregunta quién está leyendo, y es sólo para el formulario de
 * suscripción: si hay sesión, el nombre ya lo sabemos y no se lo pedimos de
 * nuevo. En la landing —que es pública— no hay sesión y el formulario queda
 * como estaba, con todos los campos vacíos.
 */
export async function SiteFooter() {
  const usuario = await getUsuario();
  return (
    <footer className="mt-auto border-t-[3px] border-double border-ink bg-paper-2">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[auto_1fr_auto] md:items-center md:gap-12">
        <div className="flex items-center">
          <LogoSanmiguelino className="w-full max-w-[13rem] text-ink" />
        </div>

        <div className="border-line md:border-x md:px-12 md:text-center">
          <p className="font-serif text-[0.9rem] leading-relaxed text-ink-2">
            Municipalidad de San Miguel de Tucumán · 9 de Julio 570, San Miguel
            de Tucumán (4000), Tucumán.
          </p>
          {/* Acá iba "Publicación gratuita, prohibida su venta". Se sacó: esa
              leyenda es del EJEMPLAR IMPRESO —lo que no se puede vender es el
              papel— y en la web no dice nada. El sitio no se vende ni se podría.

              Si alguna vez hay que mostrarla, el lugar es donde se ofrece el
              papel, no el pie del sitio. */}

          {/* Anotarse para recibirlo impreso. Va en el pie y no en la bandera
              porque no es navegación: es algo que se hace una vez, y el pie es
              donde uno mira cuando ya leyó. */}
          <div className="mt-4 flex justify-center">
            <SuscripcionPapel nombre={usuario?.nombre ?? ""} />
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
          <LogoSubsecretaria />
        </div>
      </div>
    </footer>
  );
}
