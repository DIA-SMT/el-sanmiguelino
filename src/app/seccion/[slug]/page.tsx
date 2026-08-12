import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Masthead } from "@/components/masthead";
import { SiteFooter } from "@/components/site-footer";
import { FiguraNota } from "@/components/figura-nota";
import { MigueChat } from "@/components/migue/migue-chat";
import { edicionActual } from "@/lib/data/edicion-actual";
import { getSeccion, notasPorSeccion } from "@/lib/data/secciones";
import { getUsuario } from "@/lib/auth/session";

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

  return (
    <>
      <Masthead
        edicion={edicionActual}
        usuario={usuario}
        seccionActiva={seccion.slug}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">
        <h2 className="border-b-2 border-ink pb-2 font-sans text-sm font-bold uppercase tracking-[0.22em] text-ink">
          {seccion.nombre}
        </h2>

        {notas.length === 0 ? (
          <div className="mt-10 border border-dashed border-line p-10 text-center">
            <p className="font-serif italic text-ink-2">
              Esta sección no tiene notas en la edición de {edicionActual.mes}.
            </p>
            <Link
              href="/diario"
              className="pressable mt-4 inline-block rounded-md bg-accent px-4 py-2 font-sans text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-strong"
            >
              Volver a la portada
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {notas.map((nota) => (
              <article
                key={nota.slug}
                className="grid gap-4 border border-line bg-chrome p-5 sm:grid-cols-[1fr_auto]"
              >
                <div>
                  <h3 className="font-display text-2xl font-bold leading-snug text-ink">
                    <Link
                      href={`/nota/${nota.slug}`}
                      className="transition-colors hover:text-accent-strong"
                    >
                      {nota.titulo}
                    </Link>
                  </h3>
                  <p className="mt-2 text-justify font-serif text-sm leading-relaxed text-ink-2">
                    {nota.bajada}
                  </p>
                  <Link
                    href={`/nota/${nota.slug}`}
                    className="mt-3 inline-block font-sans text-xs font-semibold text-accent underline-offset-2 hover:underline"
                  >
                    Leer la nota completa
                  </Link>
                </div>
                {nota.imagen && (
                  <FiguraNota
                    alt={nota.imagen.alt}
                    epigrafe={nota.imagen.epigrafe}
                    src={nota.imagen.src}
                    className="sm:w-40"
                  />
                )}
              </article>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
      <MigueChat />
    </>
  );
}
