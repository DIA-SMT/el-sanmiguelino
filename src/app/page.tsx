import Link from "next/link";
import { ArrowRight, LogIn, MessageCircle, Newspaper, ThumbsUp } from "lucide-react";
import { LogoHoja } from "@/components/brand/logos";
import { DiarioEnPerspectiva } from "@/components/landing/diario-en-perspectiva";
import { VistaPrevia } from "@/components/landing/vista-previa";
import { VitrinaSecciones } from "@/components/landing/vitrina-secciones";
import { ThemeToggle } from "@/components/theme-toggle";
import { SiteFooter } from "@/components/site-footer";
import { edicionActual } from "@/lib/data/edicion-actual";

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
      "Cada nota tiene su columna del lector: dejá tu opinión firmada con tu usuario y acompañá con un “me gusta” las voces con las que coincidís.",
  },
];

/** Landing pública: presenta El Sanmiguelino e invita a ingresar con Cidituc.
 *  El diario completo vive detrás del gate, en /diario. */
export default function Landing() {
  const secciones = [...new Set(edicionActual.notas.map((n) => n.seccion))];

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <span className="flex items-center gap-3">
            <LogoHoja className="h-9 w-9" />
            <span className="font-sans text-[0.62rem] font-semibold uppercase leading-tight tracking-[0.16em] text-ink-2">
              Municipalidad de
              <br className="sm:hidden" /> San Miguel de Tucumán
            </span>
          </span>
          <span className="flex items-center gap-2.5">
            <ThemeToggle />
            <Link
              href="/login"
              className="pressable inline-flex items-center gap-2 bg-ink px-4 py-2.5 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-paper hover:bg-accent hover:text-accent-contrast"
            >
              <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
              Ingresar
            </Link>
          </span>
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
                Diario digital · Una edición por mes
              </p>
              <h1 className="bandera mt-4 text-[clamp(2.6rem,8vw,5rem)] text-ink">
                El Sanmiguelino
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
                  href="/login"
                  className="pressable group inline-flex items-center gap-2.5 bg-accent px-7 py-3.5 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-accent-contrast shadow-control hover:bg-accent-strong"
                >
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  Ingresar con Cidituc
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
                <p className="font-serif text-sm italic text-ink-2">
                  Lectura exclusiva para usuarios de Cidituc.
                </p>
              </div>

              {/* Las secciones de la edición en curso. En celular no van: la
                  tira de secciones de más abajo dice exactamente lo mismo, y
                  acá cuesta media pantalla. */}
              <div className="mt-11 hidden border-t border-line pt-5 lg:block">
                <p className="meta text-ink">
                  En la edición de {edicionActual.mes}
                </p>
                <ul className="mt-3 flex flex-wrap gap-x-2.5 gap-y-2">
                  {secciones.map((s) => (
                    <li
                      key={s}
                      className="border border-line bg-paper px-3 py-1.5 font-sans text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-ink-2"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* El diario impreso, en ángulo y con la pila de hojas */}
            <DiarioEnPerspectiva />
          </div>
        </section>

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
                  <h3 className="titular mt-4 text-[1.4rem] font-bold leading-tight text-ink">
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
            <blockquote className="titular text-pretty text-[clamp(1.4rem,3.4vw,2.1rem)] font-medium italic leading-[1.3] text-ink">
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
            <h2 className="titular text-pretty text-[clamp(1.6rem,4vw,2.4rem)] font-black leading-tight text-ink">
              La edición de {edicionActual.mes} ya está en la calle
            </h2>
            <p className="max-w-xl font-serif text-[1.05rem] leading-relaxed text-ink-2">
              Ingresá con tu cuenta de Cidituc y leela como se lee un diario:
              pasando páginas.
            </p>
            <Link
              href="/login"
              className="pressable group inline-flex items-center gap-2.5 bg-ink px-7 py-3.5 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-paper hover:bg-accent hover:text-accent-contrast"
            >
              Ingresar con Cidituc
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
