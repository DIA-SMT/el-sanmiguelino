import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, Quote } from "lucide-react";
import { ViewTransition } from "react";
import { Masthead } from "@/components/masthead";
import { SiteFooter } from "@/components/site-footer";
import { FiguraNota } from "@/components/figura-nota";
import { HojaDiario } from "@/components/hoja-diario";
import { ColumnaDelLector } from "@/components/comentarios/columna-del-lector";
import { CompartirNota } from "@/components/compartir-nota";
import { NotasRelacionadas } from "@/components/notas-relacionadas";
import { transicionPagina } from "@/lib/transiciones";
import { edicionActual, getNota } from "@/lib/data/edicion-actual";
import { slugificarSeccion } from "@/lib/data/secciones";
import { getUsuario } from "@/lib/auth/session";
import { minutosDeLectura } from "@/lib/utils";
import type { BloqueNota } from "@/lib/types";

export async function generateMetadata({
  params,
}: PageProps<"/nota/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const nota = getNota(slug);
  return { title: nota?.titulo ?? "Nota" };
}

function Bloque({ bloque, esPrimero }: { bloque: BloqueNota; esPrimero: boolean }) {
  switch (bloque.tipo) {
    case "subtitulo":
      return (
        <h2 className="mb-3 mt-7 flex items-baseline gap-2.5 font-sans text-[0.72rem] font-bold uppercase tracking-[0.18em] text-ink first:mt-0">
          <span
            aria-hidden="true"
            className="h-[2px] w-4 shrink-0 translate-y-[-0.25em] bg-accent"
          />
          {bloque.texto}
        </h2>
      );
    case "cita":
      return (
        <figure className="my-7 border-y border-ink bg-paper-2 px-4 py-5 text-center">
          <Quote className="mx-auto h-4 w-4 text-accent" aria-hidden="true" />
          <blockquote className="titular mt-3 text-[1.15rem] font-medium italic leading-snug text-ink">
            “{bloque.texto}”
          </blockquote>
          <figcaption className="meta mt-3.5">
            {bloque.autor}
            {bloque.cargo ? ` · ${bloque.cargo}` : ""}
          </figcaption>
        </figure>
      );
    default:
      return (
        <p
          className={`texto-diario mb-4 font-serif text-[0.97rem] leading-[1.72] text-ink ${
            esPrimero ? "drop-cap" : ""
          }`}
        >
          {bloque.texto}
        </p>
      );
  }
}

export default async function NotaPage({ params }: PageProps<"/nota/[slug]">) {
  const usuario = await getUsuario();
  if (!usuario) redirect("/login");

  const { slug } = await params;
  const nota = getNota(slug);
  if (!nota) notFound();

  const primerParrafoIdx = nota.cuerpo.findIndex((b) => b.tipo === "parrafo");

  const numeroPagina =
    edicionActual.notas.findIndex((n) => n.slug === nota.slug) + 2;

  return (
    <>
      {/* Avance de lectura: lo mueve el scroll, sin JavaScript. Queda fuera de
          la transición porque no es parte del papel. */}
      <div className="progreso-lectura" aria-hidden="true" />

      <ViewTransition {...transicionPagina}>
        <HojaDiario numeroPagina={numeroPagina}>
          <Masthead
            edicion={edicionActual}
            usuario={usuario}
            seccionActiva={slugificarSeccion(nota.seccion)}
          />

          <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
            <nav aria-label="Volver" className="mb-7">
              <Link
                href="/diario"
                transitionTypes={["pagina-atras"]}
                className="group inline-flex items-center gap-2 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-3 transition-colors hover:text-accent"
              >
                <ArrowLeft
                  className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-1"
                  aria-hidden="true"
                />
                Portada de {edicionActual.mes}
              </Link>
            </nav>

            <article>
              <header className="entra mx-auto max-w-3xl text-center">
                <p className="volanta text-accent">{nota.seccion}</p>
                <h1 className="titular mt-3 text-[clamp(2rem,5.2vw,3.4rem)] font-black leading-[1.04] text-ink">
                  {nota.titulo}
                </h1>
                <p className="mx-auto mt-4 max-w-2xl text-pretty font-serif text-[1.05rem] italic leading-relaxed text-ink-2">
                  {nota.bajada}
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-y border-hairline py-2.5">
                  <p className="meta">San Miguel de Tucumán</p>
                  <span aria-hidden="true" className="text-line">
                    ·
                  </span>
                  <p className="meta">{edicionActual.mes}</p>
                  <span aria-hidden="true" className="text-line">
                    ·
                  </span>
                  <p className="meta inline-flex items-center gap-1.5">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {minutosDeLectura(nota.cuerpo)} min
                  </p>
                </div>
              </header>

              {nota.imagen && (
                <FiguraNota
                  alt={nota.imagen.alt}
                  epigrafe={nota.imagen.epigrafe}
                  src={nota.imagen.src}
                  prioridad
                  className="entra entra-2 mx-auto mt-9 max-w-4xl"
                  sizes="(min-width: 1024px) 900px, 100vw"
                />
              )}

              <div className="entra entra-3 note-columns mx-auto mt-9 max-w-6xl">
                {nota.cuerpo.map((bloque, i) => (
                  <Bloque
                    key={i}
                    bloque={bloque}
                    esPrimero={i === primerParrafoIdx}
                  />
                ))}
              </div>

              {/* Cierre de nota, como el cuadratín del impreso */}
              <span
                aria-hidden="true"
                className="mx-auto mt-8 block h-[7px] w-[7px] bg-accent"
              />
            </article>

            <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-between gap-4 border-t border-hairline pt-5">
              <p className="meta">Compartir esta nota</p>
              <CompartirNota titulo={nota.titulo} />
            </div>

            <NotasRelacionadas notaSlug={nota.slug} />

            <ColumnaDelLector notaSlug={nota.slug} usuario={usuario} />
          </main>

          <SiteFooter />
        </HojaDiario>
      </ViewTransition>
    </>
  );
}
