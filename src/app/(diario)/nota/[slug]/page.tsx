import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ViewTransition } from "react";
import { Masthead } from "@/components/masthead";
import { SiteFooter } from "@/components/site-footer";
import { FiguraNota } from "@/components/figura-nota";
import { HojaDiario } from "@/components/hoja-diario";
import { ColumnaDelLector } from "@/components/comentarios/columna-del-lector";
import { transicionPagina } from "@/lib/transiciones";
import { edicionActual, getNota } from "@/lib/data/edicion-actual";
import { slugificarSeccion } from "@/lib/data/secciones";
import { getUsuario } from "@/lib/auth/session";
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
        <h2 className="mb-2 mt-6 font-sans text-sm font-bold uppercase tracking-wide text-ink first:mt-0">
          {bloque.texto}
        </h2>
      );
    case "cita":
      return (
        <figure className="my-6 border-y-2 border-ink py-4 text-center">
          <blockquote className="font-display text-xl font-medium italic leading-snug text-ink">
            “{bloque.texto}”
          </blockquote>
          <figcaption className="mt-3 font-sans text-xs uppercase tracking-[0.15em] text-ink-2">
            {bloque.autor}
            {bloque.cargo ? `, ${bloque.cargo}` : ""}
          </figcaption>
        </figure>
      );
    default:
      return (
        <p
          className={`mb-4 text-justify font-serif text-[0.95rem] leading-relaxed text-ink ${
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
    <ViewTransition {...transicionPagina}>
      <HojaDiario numeroPagina={numeroPagina}>
        <Masthead
          edicion={edicionActual}
          usuario={usuario}
          seccionActiva={slugificarSeccion(nota.seccion)}
        />

        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
          <nav aria-label="Volver" className="mb-6">
            <Link
              href="/diario"
              transitionTypes={["pagina-atras"]}
              className="inline-flex items-center gap-1.5 font-sans text-sm text-ink-2 transition-colors hover:text-accent"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Portada de {edicionActual.mes}
            </Link>
          </nav>

          <article>
            <header className="entra mx-auto max-w-3xl text-center">
              <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                {nota.seccion}
              </p>
              <h1 className="mt-3 font-display text-4xl font-black leading-[1.05] text-ink sm:text-5xl">
                {nota.titulo}
              </h1>
              <p className="mt-4 font-serif text-lg italic leading-relaxed text-ink-2">
                {nota.bajada}
              </p>
            </header>

            {nota.imagen && (
              <FiguraNota
                alt={nota.imagen.alt}
                epigrafe={nota.imagen.epigrafe}
                src={nota.imagen.src}
                className="entra entra-2 mx-auto mt-8 max-w-4xl"
              />
            )}

            <div className="entra entra-3 note-columns mx-auto mt-8 max-w-6xl">
              {nota.cuerpo.map((bloque, i) => (
                <Bloque
                  key={i}
                  bloque={bloque}
                  esPrimero={i === primerParrafoIdx}
                />
              ))}
            </div>
          </article>

          <ColumnaDelLector notaSlug={nota.slug} usuario={usuario} />
        </main>

        <SiteFooter />
      </HojaDiario>
    </ViewTransition>
  );
}
