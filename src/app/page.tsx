import Link from "next/link";
import { LogIn, MessageCircle, Newspaper, ThumbsUp } from "lucide-react";
import { LogoHoja } from "@/components/brand/logos";
import { ThemeToggle } from "@/components/theme-toggle";
import { SiteFooter } from "@/components/site-footer";

/** Landing pública: presenta El Sanmiguelino e invita a ingresar con Cidituc.
 *  El diario completo vive detrás del gate, en /diario. */
export default function Landing() {
  return (
    <>
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <span className="flex items-center gap-2.5">
            <LogoHoja className="h-8 w-8" />
            <span className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-ink-2">
              Municipalidad de
              <br className="sm:hidden" /> San Miguel de Tucumán
            </span>
          </span>
          <span className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/login"
              className="pressable inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 font-sans text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-strong"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Ingresar
            </Link>
          </span>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
          <div className="fade-up">
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Diario digital · Una edición por mes
            </p>
            <h1 className="mt-3 flex items-end gap-3 font-display text-5xl font-black uppercase leading-none tracking-tight text-ink sm:text-6xl">
              El Sanmiguelino
              <LogoHoja decorativo className="mb-1 h-10 w-10 sm:h-12 sm:w-12" />
            </h1>
            <div className="rule-double mt-5 mb-[7px] max-w-xl py-1.5">
              <p className="font-sans text-[0.7rem] uppercase tracking-[0.2em] text-ink-2">
                Las novedades de la ciudad, con estética de diario de papel
              </p>
            </div>
            <p className="mt-6 max-w-xl font-serif text-lg leading-relaxed text-ink-2">
              El Sanmiguelino es la versión digital del periódico mensual de la
              Municipalidad de San Miguel de Tucumán. Cada mes, una nueva
              edición con las obras, la cultura y las historias de la ciudad,
              para leer como un diario de verdad: titulares, columnas y la voz
              de los vecinos.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/login"
                className="pressable inline-flex items-center gap-2 rounded-md bg-accent px-6 py-3 font-sans text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-strong"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                Ingresar con Cidituc
              </Link>
              <p className="font-sans text-xs text-ink-2">
                Lectura exclusiva para usuarios de Cidituc.
              </p>
            </div>
          </div>

          {/* Miniatura del diario impreso */}
          <div className="fade-up-2 relative mx-auto w-full max-w-sm" aria-hidden="true">
            <div className="absolute inset-0 translate-x-3 translate-y-3 -rotate-1 rounded-sm border border-line bg-chrome" />
            <div className="relative rotate-2 rounded-sm border border-line bg-paper p-5 shadow-xl">
              <div className="flex items-end justify-between gap-2">
                <p className="font-display text-2xl font-black uppercase tracking-tight text-ink">
                  El Sanmiguelino
                </p>
                <LogoHoja className="mb-0.5 h-5 w-5" />
              </div>
              <div className="rule-double mt-2 mb-[6px] py-1">
                <p className="font-sans text-[0.5rem] uppercase tracking-[0.18em] text-ink-2">
                  San Miguel de Tucumán · Edición mensual
                </p>
              </div>
              <p className="mt-3 font-display text-lg font-black leading-tight text-ink">
                El Parque 9 de Julio, un museo a cielo abierto a descubrir
              </p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <div className="flex aspect-[4/3] items-end justify-center border border-line bg-chrome">
                    <svg viewBox="0 0 100 70" className="h-full w-full">
                      <rect width="100" height="70" fill="var(--ink)" opacity="0.08" />
                      <g fill="var(--ink)" opacity="0.3">
                        <rect x="36" y="52" width="28" height="10" />
                        <path d="M50 14 C 43 18, 40 28, 42 38 C 44 46, 46 50, 50 52 C 54 50, 56 46, 58 38 C 60 28, 57 18, 50 14 Z" />
                        <circle cx="50" cy="11" r="4.5" />
                      </g>
                    </svg>
                  </div>
                  <div className="fake-lines mt-2 h-2" />
                </div>
                <div className="space-y-2">
                  <div className="fake-lines h-16" />
                  <div className="fake-lines h-10" />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="fake-lines h-12" />
                <div className="fake-lines h-12" />
                <div className="fake-lines h-12" />
              </div>
            </div>
          </div>
        </section>

        {/* Qué trae */}
        <section
          aria-label="Qué trae El Sanmiguelino"
          className="border-t border-line bg-paper"
        >
          <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-3">
            <div className="fade-up rounded-lg border border-line bg-chrome p-6">
              <Newspaper className="h-6 w-6 text-accent" aria-hidden="true" />
              <h2 className="mt-3 font-display text-xl font-bold text-ink">
                Una edición por mes
              </h2>
              <p className="mt-2 font-serif text-sm leading-relaxed text-ink-2">
                La misma experiencia del impreso que se reparte en la ciudad,
                ahora en tu pantalla: portada, secciones, columnas y epígrafes,
                en modo claro u oscuro.
              </p>
            </div>
            <div className="fade-up-2 rounded-lg border border-line bg-chrome p-6">
              <MessageCircle className="h-6 w-6 text-accent" aria-hidden="true" />
              <h2 className="mt-3 font-display text-xl font-bold text-ink">
                Migue te acompaña
              </h2>
              <p className="mt-2 font-serif text-sm leading-relaxed text-ink-2">
                El asistente virtual del municipio también lee el diario:
                preguntale qué trae la edición o pedile el dato puntual de una
                nota, a cualquier hora.
              </p>
            </div>
            <div className="fade-up-3 rounded-lg border border-line bg-chrome p-6">
              <ThumbsUp className="h-6 w-6 text-accent" aria-hidden="true" />
              <h2 className="mt-3 font-display text-xl font-bold text-ink">
                La palabra del lector
              </h2>
              <p className="mt-2 font-serif text-sm leading-relaxed text-ink-2">
                Cada nota tiene su columna del lector: dejá tu opinión firmada
                con tu usuario y acompañá con un “me gusta” las voces con las
                que coincidís.
              </p>
            </div>
          </div>
        </section>

        {/* Cita editorial */}
        <section aria-label="Palabras de la intendenta" className="border-t border-line">
          <figure className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6">
            <blockquote className="font-display text-2xl font-medium italic leading-snug text-ink">
              “Estamos rescatando nuestra historia, nuestra cultura y el arte en
              este paseo, que es de todos los ciudadanos.”
            </blockquote>
            <figcaption className="mt-4 font-sans text-xs uppercase tracking-[0.15em] text-ink-2">
              Rossana Chahla, intendenta · de la edición de agosto
            </figcaption>
          </figure>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
