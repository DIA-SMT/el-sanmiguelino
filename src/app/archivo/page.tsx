import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Newspaper } from "lucide-react";
import { HojaDiario } from "@/components/hoja-diario";
import { SiteFooter } from "@/components/site-footer";
import { getPublicadas, getResumenEdicion } from "@/lib/repos/edicion";
import { getUsuario } from "@/lib/auth/session";

export const metadata = { title: "Archivo" };

/**
 * Todos los números que salieron.
 *
 * Un diario municipal conserva su archivo: la nota sobre una plaza que se
 * inauguró en agosto sigue siendo la respuesta correcta a una pregunta que
 * alguien va a hacerse en noviembre. Que la edición del mes cambie sola no
 * quiere decir que la anterior desaparezca.
 *
 * Sólo lista ediciones **publicadas y con notas**. Una programada para el mes
 * que viene no está acá, y una vacía tampoco: nunca fue un número del diario.
 */
export default async function ArchivoPage() {
  const usuario = await getUsuario();
  if (!usuario) redirect("/login");

  const [publicadas, enLaCalle] = await Promise.all([
    getPublicadas(),
    getResumenEdicion(),
  ]);

  return (
    <HojaDiario numeroPagina={null}>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <nav aria-label="Volver" className="mb-7">
          <Link
            href="/diario"
            className="group inline-flex items-center gap-2 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-3 transition-colors hover:text-accent"
          >
            <ArrowLeft
              className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-1"
              aria-hidden="true"
            />
            La edición de {enLaCalle.mes}
          </Link>
        </nav>

        <header className="border-b-[3px] border-ink pb-4">
          <h1 className="titular text-[clamp(1.9rem,5.4vw,3.4rem)] text-ink">
            Archivo
          </h1>
          <p className="mt-2 font-sans text-[0.85rem] text-ink-2">
            {publicadas.length}{" "}
            {publicadas.length === 1 ? "número publicado" : "números publicados"}
            . Las notas de los números anteriores siguen en su dirección de
            siempre.
          </p>
        </header>

        <ul className="mt-2 divide-y divide-hairline">
          {publicadas.map((e) => {
            const esLaDeAhora = e.slug === enLaCalle.slug;
            return (
              <li key={e.slug} className="flex flex-wrap items-baseline gap-x-4 gap-y-2 py-5">
                <Newspaper
                  className="h-4 w-4 shrink-0 text-ink-3"
                  aria-hidden="true"
                />
                <h2 className="titular min-w-0 flex-1 text-[1.35rem] text-ink">
                  <Link
                    href={esLaDeAhora ? "/diario" : `/edicion/${e.slug}`}
                    className="titular-link"
                  >
                    {e.mes}
                  </Link>
                </h2>
                <span className="font-sans text-[0.75rem] tabular-nums text-ink-3">
                  N.º {e.numero}
                </span>
                {esLaDeAhora && (
                  <span className="border border-ink bg-ink px-2 py-0.5 font-sans text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-paper">
                    En la calle
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <SiteFooter />
    </HojaDiario>
  );
}
