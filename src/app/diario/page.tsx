import Link from "next/link";
import { redirect } from "next/navigation";
import { Masthead } from "@/components/masthead";
import { SiteFooter } from "@/components/site-footer";
import { FiguraNota } from "@/components/figura-nota";
import { MigueChat } from "@/components/migue/migue-chat";
import { edicionActual } from "@/lib/data/edicion-actual";
import { getUsuario } from "@/lib/auth/session";

export default async function Portada() {
  const usuario = await getUsuario();
  if (!usuario) redirect("/login");

  const [principal, ...secundarias] = edicionActual.notas;

  return (
    <>
      <Masthead edicion={edicionActual} usuario={usuario} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {/* Nota principal */}
        <article className="grid gap-8 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              {principal.seccion}
            </p>
            <h2 className="mt-2 font-display text-4xl font-black leading-[1.05] text-ink sm:text-5xl">
              <Link
                href={`/nota/${principal.slug}`}
                className="transition-colors hover:text-accent-strong"
              >
                {principal.titulo}
              </Link>
            </h2>
            <p className="mt-4 font-serif text-lg leading-relaxed text-ink-2">
              {principal.bajada}
            </p>
            <Link
              href={`/nota/${principal.slug}`}
              className="pressable mt-5 inline-flex items-center gap-1 rounded-md border border-line bg-chrome px-4 py-2 font-sans text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
            >
              Leer la nota completa
            </Link>
          </div>
          {principal.imagen && (
            <FiguraNota
              alt={principal.imagen.alt}
              epigrafe={principal.imagen.epigrafe}
            />
          )}
        </article>

        <hr className="rule-thin my-10 border-0" />

        {/* Secundarias */}
        <section aria-label="Más notas de esta edición">
          <div className="grid gap-8 md:grid-cols-3">
            {secundarias.map((nota) => (
              <article
                key={nota.slug}
                className="flex flex-col border-t-2 border-ink pt-4"
              >
                <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-accent">
                  {nota.seccion}
                </p>
                <h3 className="mt-2 font-display text-xl font-bold leading-snug text-ink">
                  <Link
                    href={`/nota/${nota.slug}`}
                    className="transition-colors hover:text-accent-strong"
                  >
                    {nota.titulo}
                  </Link>
                </h3>
                <p className="mt-2 font-serif text-sm leading-relaxed text-ink-2">
                  {nota.bajada}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
      <MigueChat />
    </>
  );
}
