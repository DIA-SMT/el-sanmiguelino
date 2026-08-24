import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Masthead } from "@/components/masthead";
import { SiteFooter } from "@/components/site-footer";
import { FiguraNota } from "@/components/figura-nota";
import { HojaDiario } from "@/components/hoja-diario";
import { edicionActual } from "@/lib/data/edicion-actual";
import { imagenDisponible } from "@/lib/data/imagenes";
import { getSeccion, notasPorSeccion, slugificarSeccion } from "@/lib/data/secciones";
import { getUsuario } from "@/lib/auth/session";
import { minutosDeLectura } from "@/lib/utils";

export async function generateMetadata({
  params,
}: PageProps<"/seccion/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const seccion = getSeccion(edicionActual, slug);
  return { title: seccion?.nombre ?? "Sección" };
}

export default async function SeccionPage({
  params,
}: PageProps<"/seccion/[slug]">) {
  const usuario = await getUsuario();
  if (!usuario) redirect("/login");

  const { slug } = await params;
  const seccion = getSeccion(edicionActual, slug);
  if (!seccion) notFound();

  const notas = notasPorSeccion(edicionActual, slug);
  // Jerarquía de sección: una protagonista, después las que la acompañan y al
  // final el listado. Con las secciones flacas de esta edición muchas veces
  // sólo hay protagonista, y está bien: los bloques vacíos no se renderizan.
  const [principal, ...siguen] = notas;
  const secundarias = siguen.slice(0, 2);
  const ultimas = siguen.slice(2);

  // Una sección de una sola nota dejaría la hoja casi vacía: se cierra con el
  // resto de la edición para que siempre haya para dónde seguir.
  const otrasDeLaEdicion = edicionActual.notas
    .filter((n) => slugificarSeccion(n.seccion) !== slug)
    .slice(0, 3);

  return (
    <HojaDiario numeroPagina={null}>
      <Masthead
        edicion={edicionActual}
        usuario={usuario}
        seccionActiva={seccion.slug}
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
            Portada de {edicionActual.mes}
          </Link>
        </nav>

        <header className="entra flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b-[3px] border-double border-ink pb-3">
          <h1 className="bandera text-[clamp(2rem,6vw,3.4rem)] text-ink">
            {seccion.nombre}
          </h1>
          <p className="meta pb-1.5">
            {notas.length === 1 ? "1 nota" : `${notas.length} notas`} en{" "}
            {edicionActual.mes}
          </p>
        </header>

        {!principal ? (
          <div className="mt-10 border border-dashed border-line bg-paper-2 p-12 text-center">
            <p className="font-serif text-lg italic text-ink-2">
              Esta sección no tiene notas en la edición de {edicionActual.mes}.
            </p>
            <Link
              href="/diario"
              className="pressable mt-6 inline-flex items-center gap-2 border border-ink px-5 py-2.5 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink hover:bg-ink hover:text-paper"
            >
              Volver a la portada
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <>
            {/* La protagonista de la sección */}
            <article className="entra entra-2 mt-8 grid gap-7 lg:grid-cols-[1.35fr_1fr] lg:gap-10">
              <div className="min-w-0">
                <p className="volanta text-accent">{seccion.nombre}</p>
                <h2 className="titular mt-2.5 text-[clamp(1.7rem,4.4vw,2.9rem)] font-black leading-[1.05] text-ink">
                  <Link href={`/nota/${principal.slug}`} className="titular-link">
                    {principal.titulo}
                  </Link>
                </h2>
                <p className="mt-4 max-w-2xl text-pretty font-serif text-[1.05rem] italic leading-relaxed text-ink-2">
                  {principal.bajada}
                </p>
                <p className="meta mt-4">
                  {minutosDeLectura(principal.cuerpo)} min de lectura
                </p>
                <Link
                  href={`/nota/${principal.slug}`}
                  className="pressable group mt-6 inline-flex items-center gap-2 border border-ink px-5 py-2.5 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink hover:bg-ink hover:text-paper"
                >
                  Leer la nota completa
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
              </div>
              {principal.imagen && (
                <FiguraNota
                  alt={principal.imagen.alt}
                  epigrafe={principal.imagen.epigrafe}
                  src={principal.imagen.src}
                  prioridad
                  sizes="(min-width: 1024px) 480px, 100vw"
                />
              )}
            </article>

            {secundarias.length > 0 && (
              <section aria-labelledby="acompanan" className="mt-12">
                <div className="filete-seccion pb-2">
                  <h2 id="acompanan" className="volanta text-ink">
                    También en {seccion.nombre}
                  </h2>
                </div>
                <div className="mt-6 grid gap-x-7 gap-y-8 sm:grid-cols-2">
                  {secundarias.map((nota) => (
                    <article
                      key={nota.slug}
                      className="revela border-t border-hairline pt-4"
                    >
                      {nota.imagen && imagenDisponible(nota.imagen.src) && (
                        <Link
                          href={`/nota/${nota.slug}`}
                          tabIndex={-1}
                          aria-hidden="true"
                          className="foto-editorial relative mb-3.5 block aspect-[16/10]"
                        >
                          <Image
                            src={nota.imagen.src}
                            alt=""
                            fill
                            sizes="(min-width: 640px) 50vw, 100vw"
                            className="object-cover"
                          />
                        </Link>
                      )}
                      <h3 className="titular text-[1.25rem] font-bold leading-[1.16] text-ink">
                        <Link href={`/nota/${nota.slug}`} className="titular-link">
                          {nota.titulo}
                        </Link>
                      </h3>
                      <p className="mt-2 text-pretty font-serif text-[0.9rem] leading-[1.65] text-ink-2">
                        {nota.bajada}
                      </p>
                      <p className="meta mt-2.5">
                        {minutosDeLectura(nota.cuerpo)} min de lectura
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {ultimas.length > 0 && (
              <section aria-labelledby="ultimas" className="mt-12">
                <div className="filete-seccion pb-2">
                  <h2 id="ultimas" className="volanta text-ink">
                    Últimas de {seccion.nombre}
                  </h2>
                </div>
                <ul className="mt-4 divide-y divide-hairline border-t border-hairline">
                  {ultimas.map((nota) => (
                    <li
                      key={nota.slug}
                      className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4"
                    >
                      <h3 className="titular min-w-0 flex-1 text-[1.05rem] font-bold leading-snug text-ink">
                        <Link href={`/nota/${nota.slug}`} className="titular-link">
                          {nota.titulo}
                        </Link>
                      </h3>
                      <span className="meta shrink-0">
                        {minutosDeLectura(nota.cuerpo)} min
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {otrasDeLaEdicion.length > 0 && (
          <section aria-labelledby="resto-edicion" className="mt-14">
            <div className="filete-seccion pb-2">
              <h2 id="resto-edicion" className="volanta text-ink">
                En el resto de la edición
              </h2>
            </div>
            <ul className="mt-4 divide-y divide-hairline border-t border-hairline">
              {otrasDeLaEdicion.map((nota) => (
                <li
                  key={nota.slug}
                  className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-4"
                >
                  <span className="volanta shrink-0 text-accent">
                    {nota.seccion}
                  </span>
                  <h3 className="titular min-w-0 flex-1 text-[1.05rem] font-bold leading-snug text-ink">
                    <Link href={`/nota/${nota.slug}`} className="titular-link">
                      {nota.titulo}
                    </Link>
                  </h3>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <SiteFooter />
    </HojaDiario>
  );
}
