import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import { Masthead } from "@/components/masthead";
import { SiteFooter } from "@/components/site-footer";
import { HojaDiario } from "@/components/hoja-diario";
import { getBuscables, getResumenEdicion } from "@/lib/repos/edicion";
import { imagenDisponible } from "@/lib/data/imagenes";
import { buscarEnEdicion, MINIMO_CONSULTA } from "@/lib/data/buscar";
import { seccionesDeEdicion } from "@/lib/data/secciones";
import { getUsuario } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Buscar" };

export default async function BuscarPage({
  searchParams,
}: PageProps<"/buscar">) {
  const usuario = await getUsuario();
  if (!usuario) redirect("/login");

  const [edicion, buscables] = await Promise.all([
    getResumenEdicion(),
    getBuscables(),
  ]);
  const { q } = await searchParams;
  const consulta = typeof q === "string" ? q : "";
  const corta = consulta.trim().length < MINIMO_CONSULTA;
  const resultados = corta ? [] : buscarEnEdicion(buscables, consulta);

  return (
    <HojaDiario numeroPagina={null}>
      <Masthead
        edicion={edicion}
        secciones={seccionesDeEdicion(buscables)}
        usuario={usuario}
      />

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <nav aria-label="Volver" className="mb-7">
          <Link
            href="/diario"
            className="group inline-flex items-center gap-2 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-3 transition-colors hover:text-accent"
          >
            <ArrowLeft
              className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-1"
              aria-hidden="true"
            />
            Portada de {edicion.mes}
          </Link>
        </nav>

        <header className="entra border-b-[3px] border-double border-ink pb-4">
          <h1 className="bandera text-[clamp(2rem,6vw,3.4rem)] text-ink">
            Buscar
          </h1>
          {/* Formulario GET: anda sin JavaScript y deja la búsqueda en la URL,
              así se puede compartir o volver con el historial. */}
          <form action="/buscar" className="mt-5 flex max-w-xl gap-2">
            <label htmlFor="q" className="sr-only">
              Buscar en la edición de {edicion.mes}
            </label>
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
                aria-hidden="true"
              />
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={consulta}
                placeholder="Palabra, tema o sección…"
                className="h-11 w-full border border-line bg-chrome pl-10 pr-3 font-serif text-[0.98rem] text-ink transition-colors placeholder:italic placeholder:text-ink-3 focus:border-accent"
              />
            </div>
            <button
              type="submit"
              className="pressable shrink-0 bg-ink px-5 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-paper hover:bg-accent hover:text-accent-contrast"
            >
              Buscar
            </button>
          </form>
        </header>

        {corta ? (
          <p className="mt-10 max-w-xl font-serif text-[1.02rem] italic leading-relaxed text-ink-2">
            Escribí al menos {MINIMO_CONSULTA} letras para buscar en las{" "}
            {buscables.length} notas de la edición de {edicion.mes}.
          </p>
        ) : (
          <>
            <p className="meta mt-6">
              {resultados.length === 0
                ? "Sin resultados"
                : resultados.length === 1
                  ? "1 resultado"
                  : `${resultados.length} resultados`}{" "}
              para “{consulta.trim()}”
            </p>

            {resultados.length === 0 ? (
              <div className="mt-8 border border-dashed border-line bg-paper-2 p-10 text-center">
                <p className="font-serif text-lg italic text-ink-2">
                  No encontramos nada con esa palabra en la edición de{" "}
                  {edicion.mes}.
                </p>
                <Link
                  href="/diario"
                  className="pressable mt-6 inline-block border border-ink px-5 py-2.5 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink hover:bg-ink hover:text-paper"
                >
                  Volver a la portada
                </Link>
              </div>
            ) : (
              <div className="mt-6 divide-y divide-hairline border-t border-hairline">
                {resultados.map(({ nota, donde, fragmento }) => (
                  <article
                    key={nota.slug}
                    className="grid gap-5 py-6 sm:grid-cols-[1fr_11rem] sm:gap-8"
                  >
                    <div className="min-w-0">
                      <p className="volanta text-accent">{nota.seccion}</p>
                      <h2 className="titular mt-2 text-[clamp(1.2rem,2.6vw,1.7rem)] font-bold leading-[1.16] text-ink">
                        <Link
                          href={`/nota/${nota.slug}`}
                          className="titular-link"
                        >
                          {nota.titulo}
                        </Link>
                      </h2>

                      {fragmento ? (
                        <p className="mt-2.5 max-w-2xl font-serif text-[0.92rem] leading-[1.7] text-ink-2">
                          {fragmento.antes}
                          <mark>{fragmento.coincidencia}</mark>
                          {fragmento.despues}
                        </p>
                      ) : (
                        <p className="mt-2.5 max-w-2xl text-pretty font-serif text-[0.92rem] leading-[1.7] text-ink-2">
                          {nota.bajada}
                        </p>
                      )}

                      <p className="meta mt-3">
                        {donde === "cuerpo" ? "En el cuerpo" : null}
                        {donde === "bajada" ? "En la bajada" : null}
                        {donde === "titulo" ? "En el título" : null}
                        {donde === "seccion" ? "En la sección" : null}
                        {" · "}
                        {nota.minutosLectura} min de lectura
                      </p>
                    </div>

                    {nota.imagen && imagenDisponible(nota.imagen.src) && (
                      <Link
                        href={`/nota/${nota.slug}`}
                        tabIndex={-1}
                        aria-hidden="true"
                        className="foto-editorial relative block aspect-[4/3] w-full sm:aspect-[4/3]"
                      >
                        <Image
                          src={nota.imagen.src}
                          alt=""
                          fill
                          sizes="(min-width: 640px) 176px, 100vw"
                          className="object-cover"
                        />
                      </Link>
                    )}
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <SiteFooter />
    </HojaDiario>
  );
}
