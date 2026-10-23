import Link from "next/link";
import { ArrowRight, MessageCircle, Newspaper, ThumbsUp } from "lucide-react";
import { LogoHoja, LogoSanmiguelino } from "@/components/brand/logos";
import { FichaEdicion } from "@/components/landing/ficha-edicion";
import { TapaEdicion } from "@/components/landing/tapa-edicion";
import { VistaPrevia } from "@/components/landing/vista-previa";
import { VitrinaSecciones } from "@/components/landing/vitrina-secciones";
import { ThemeToggle } from "@/components/theme-toggle";
import { SiteFooter } from "@/components/site-footer";
import { getIndice, getResumenEdicion } from "@/lib/repos/edicion";

const QUE_TRAE = [
  {
    icono: Newspaper,
    titulo: "Una edición por mes",
    texto:
      "La misma experiencia del impreso que se reparte en la ciudad, ahora en tu pantalla: portada, secciones, columnas y epígrafes, en modo claro u oscuro.",
  },
  {
    icono: MessageCircle,
    titulo: "Migue te acompaña",
    texto:
      "El asistente virtual del municipio también lee el diario: preguntale qué trae la edición o pedile el dato puntual de una nota, a cualquier hora.",
  },
  {
    icono: ThumbsUp,
    titulo: "La palabra del lector",
    texto:
      "Cada nota tiene su columna del lector: ingresá con tu cuenta de Ciudadano Digital, dejá tu opinión y acompañá con un “me gusta” las voces con las que coincidís.",
  },
];

/** La presentación de El Sanmiguelino, para quien llega por la dirección
 *  principal sin haber ingresado (con sesión, el proxy manda directo a la
 *  tapa). Antes anunciaba "Próximamente", cuando el diario era sólo para
 *  quien ingresaba; desde que leer es libre, cada "Próximamente" es un
 *  "Leer la edición" que lleva a la tapa del mes. */
export default async function Landing() {
  const [edicion, indice] = await Promise.all([
    getResumenEdicion(),
    getIndice(),
  ]);
  return (
    <>
      {/* La cabecera institucional. Sólida y no translúcida con desenfoque:
          el vidrio esmerilado es vocabulario de aplicación, y un diario tiene
          una cabecera de papel con su filete.

          Firma el municipio a la izquierda —su hoja tricolor y su nombre— y el
          diario a la derecha de un filete vertical, con su logotipo. Son dos
          marcas y van separadas, no fundidas (ver `brand/logos.tsx`). La
          navegación son las tres puertas reales del sitio, nada más: la
          edición, sus secciones (que están en esta misma página) y el
          archivo. */}
      <header className="sticky top-0 z-30 border-b border-line bg-paper shadow-[0_1px_0_var(--hairline)]">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <span className="flex min-w-0 items-center gap-3">
            <LogoHoja className="h-9 w-9 shrink-0" />
            <span className="font-sans text-[0.62rem] font-semibold uppercase leading-tight tracking-[0.16em] text-ink-2">
              Municipalidad de
              <br className="sm:hidden" /> San Miguel de Tucumán
            </span>
            <span
              aria-hidden="true"
              className="hidden h-7 w-px bg-line md:block"
            />
            <LogoSanmiguelino className="hidden w-[8.5rem] shrink-0 text-ink md:block" />
          </span>
          <nav
            aria-label="El diario"
            className="flex items-center gap-x-5 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.14em]"
          >
            <Link
              href="#secciones-edicion"
              className="hidden text-ink-2 transition-colors hover:text-accent-strong lg:inline"
            >
              Secciones
            </Link>
            <Link
              href="/archivo"
              className="hidden text-ink-2 transition-colors hover:text-accent-strong lg:inline"
            >
              Números anteriores
            </Link>
            <ThemeToggle />
            <Link
              href="/diario"
              className="pressable inline-flex min-h-9 items-center whitespace-nowrap bg-accent px-3.5 text-accent-contrast hover:bg-accent-strong"
            >
              {/* En el teléfono dice sólo "Leer": completo se partía en dos
                  renglones y apretaba el nombre del municipio a tres. El resto
                  queda para el lector de pantalla, así el nombre del enlace es
                  el mismo a cualquier ancho. */}
              Leer<span className="sr-only sm:not-sr-only">&nbsp;la edición</span>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero: el único lugar del sitio con texto apoyado directamente sobre
            la panorámica, así que suma su propio velo. Va más cargado del lado
            del texto y se abre hacia la derecha, donde está el diario y la
            ciudad puede verse limpia. */}
        <section className="escritorio grano relative overflow-hidden border-b border-line">
          <div
            aria-hidden="true"
            className="absolute inset-0 z-[-1] bg-gradient-to-r from-paper/84 via-paper/58 to-paper/15"
          />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-10 sm:gap-14 sm:px-6 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
            <div className="fade-up">
              <p className="volanta text-accent-strong">
                Diario digital · Municipalidad de San Miguel de Tucumán
              </p>
              <h1 className="mt-5">
                <LogoSanmiguelino className="w-full max-w-[32rem] text-ink" />
              </h1>
              <div className="rule-double mt-6 mb-[7px] max-w-xl py-2">
                <p className="meta text-ink">
                  Las novedades de la ciudad, con estética de diario de papel
                </p>
              </div>
              <p className="mt-5 max-w-xl text-pretty font-serif text-[1.02rem] leading-[1.65] text-ink-2 sm:mt-7 sm:text-[1.15rem] sm:leading-[1.7]">
                El Sanmiguelino es la versión digital del periódico mensual de
                la Municipalidad de San Miguel de Tucumán. Cada mes, una nueva
                edición con las obras, la cultura y las historias de la ciudad,
                para leer como un diario de verdad: titulares, columnas y la voz
                de los vecinos.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
                <Link
                  href="/diario"
                  className="pressable group inline-flex items-center gap-2.5 bg-accent px-7 py-3.5 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-accent-contrast shadow-control hover:bg-accent-strong"
                >
                  Leer la edición de {edicion.mes}
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
                <Link
                  href="/archivo"
                  className="enlace font-sans text-[0.8rem] font-semibold"
                >
                  Números anteriores
                </Link>
              </div>
              <p className="mt-6 max-w-sm font-serif text-sm italic text-ink-2">
                Se lee libre. Para opinar y preguntarle a Migue,{" "}
                <Link href="/login" className="enlace not-italic">
                  ingresá con Ciudadano Digital
                </Link>
                .
              </p>
              {/* Acá iban las secciones de la edición como chips. Ahora las
                  dice la ficha de abajo, con el resto del dato duro del
                  número: dos veces lo mismo a cuatro centímetros era ruido. */}
            </div>

            {/* La tapa del número: la página 1 del PDF si salió impreso, la
                miniatura armada con sus notas si no. */}
            <TapaEdicion edicion={edicion} />
          </div>
        </section>

        <FichaEdicion edicion={edicion} indice={indice} />

        {/* Las secciones de la edición */}
        <VitrinaSecciones />

        {/* Vista previa: una portada chica de verdad */}
        <VistaPrevia />

        {/* Qué trae */}
        <section aria-labelledby="que-trae" className="grano bg-paper">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
            <div className="filete-seccion pb-2">
              <h2 id="que-trae" className="volanta text-ink">
                Qué trae El Sanmiguelino
              </h2>
            </div>
            <div className="mt-9 grid gap-x-10 gap-y-9 md:grid-cols-3">
              {QUE_TRAE.map(({ icono: Icono, titulo, texto }) => (
                <div key={titulo} className="revela border-t border-ink pt-5">
                  <Icono className="h-5 w-5 text-accent" aria-hidden="true" />
                  <h3 className="titular mt-4 text-[1.4rem] leading-tight text-ink">
                    {titulo}
                  </h3>
                  <p className="mt-2.5 text-pretty font-serif text-[0.95rem] leading-[1.7] text-ink-2">
                    {texto}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cita editorial */}
        <section
          aria-label="Palabras de la intendenta"
          className="escritorio grano border-y border-line"
        >
          {/* La cita va sobre papel y no flotando en el escritorio: es
              contenido, y además apoyada directamente sobre la panorámica su
              epígrafe caía a 2.3:1. Mismo recuadro que las citas dentro de las
              notas. */}
          <figure className="revela mx-auto my-16 max-w-3xl border-y border-ink bg-paper px-6 py-14 text-center sm:px-10">
            <span
              aria-hidden="true"
              className="mx-auto mb-7 block h-[2px] w-12 bg-accent"
            />
            <blockquote className="titular text-pretty text-[clamp(1.4rem,3.4vw,2.1rem)] italic leading-[1.3] text-ink">
              “Estamos rescatando nuestra historia, nuestra cultura y el arte en
              este paseo, que es de todos los ciudadanos.”
            </blockquote>
            <figcaption className="meta mt-7">
              Rossana Chahla, intendenta · de la edición de agosto
            </figcaption>
          </figure>
        </section>

        {/* Cierre */}
        <section className="grano bg-paper">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6">
            <h2 className="titular text-pretty text-[clamp(1.6rem,4vw,2.4rem)] leading-tight text-ink">
              La edición de {edicion.mes} ya está en la calle
            </h2>
            <p className="max-w-xl font-serif text-[1.05rem] leading-relaxed text-ink-2">
              Leela como se lee un diario: pasando páginas.
            </p>
            <Link
              href="/diario"
              className="pressable group inline-flex items-center gap-2.5 bg-ink px-7 py-3.5 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-paper hover:bg-accent hover:text-accent-contrast"
            >
              Leer la edición
              <ArrowRight
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
