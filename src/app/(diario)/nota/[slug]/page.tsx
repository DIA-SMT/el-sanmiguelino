import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { ViewTransition } from "react";
import { Masthead } from "@/components/masthead";
import { SiteFooter } from "@/components/site-footer";
import { FiguraNota } from "@/components/figura-nota";
import { CitaPersona } from "@/components/cita-persona";
import { HojaDiario } from "@/components/hoja-diario";
import { ColumnaDelLector } from "@/components/comentarios/columna-del-lector";
import { CompartirNota } from "@/components/compartir-nota";
import { NotasRelacionadas } from "@/components/notas-relacionadas";
import { transicionPagina } from "@/lib/transiciones";
import { getIndice, getNota, getResumenEdicion } from "@/lib/repos/edicion";
import { seccionesDeEdicion, slugificarSeccion } from "@/lib/data/secciones";
import { getUsuario } from "@/lib/auth/session";
import type { BloqueNota } from "@/lib/types";

export async function generateMetadata({
  params,
}: PageProps<"/nota/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const nota = await getNota(slug);
  return { title: nota?.titulo ?? "Nota" };
}

function Bloque({ bloque }: { bloque: BloqueNota }) {
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
        <CitaPersona
          texto={bloque.texto}
          autor={bloque.autor}
          cargo={bloque.cargo}
          retrato={bloque.retrato}
          className="my-7"
        />
      );
    default:
      return (
        <p className="texto-diario font-serif text-[0.97rem] leading-[1.72] text-ink">
          {bloque.texto}
        </p>
      );
  }
}

export default async function NotaPage({ params }: PageProps<"/nota/[slug]">) {
  const usuario = await getUsuario();
  if (!usuario) redirect("/login");

  const { slug } = await params;
  const nota = await getNota(slug);
  if (!nota) notFound();

  const [edicion, indice] = await Promise.all([
    getResumenEdicion(),
    getIndice(),
  ]);

  const numeroPagina = indice.findIndex((n) => n.slug === nota.slug) + 2;

  return (
    <>
      {/* Avance de lectura: lo mueve el scroll, sin JavaScript. Queda fuera de
          la transición porque no es parte del papel. */}
      <div className="progreso-lectura" aria-hidden="true" />

      <ViewTransition {...transicionPagina}>
        <HojaDiario numeroPagina={numeroPagina}>
          <Masthead
            edicion={edicion}
            secciones={seccionesDeEdicion(indice)}
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
                Portada de {edicion.mes}
              </Link>
            </nav>

            <article>
              <header className="entra">
                <p className="volanta text-accent">{nota.seccion}</p>
                <h1 className="titular mt-2.5 text-[clamp(1.9rem,5.4vw,3.5rem)] text-ink">
                  {nota.titulo}
                </h1>
                <p className="bajada mt-4 max-w-3xl text-[clamp(0.98rem,1.6vw,1.15rem)]">
                  {nota.bajada}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-hairline py-2.5">
                  <p className="meta">San Miguel de Tucumán</p>
                  <span aria-hidden="true" className="text-line">
                    ·
                  </span>
                  <p className="meta">{edicion.mes}</p>
                  <span aria-hidden="true" className="text-line">
                    ·
                  </span>
                  <p className="meta inline-flex items-center gap-1.5">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {nota.minutosLectura} min
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
                  <Bloque key={i} bloque={bloque} />
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
