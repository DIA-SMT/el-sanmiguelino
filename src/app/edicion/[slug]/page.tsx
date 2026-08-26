import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { HojaDiario } from "@/components/hoja-diario";
import { SiteFooter } from "@/components/site-footer";
import { getIndiceDe, getPublicadas, getResumenEdicion } from "@/lib/repos/edicion";
import { getUsuario } from "@/lib/auth/session";

/**
 * Un número del archivo: su sumario.
 *
 * La edición que está en la calle redirige a `/diario`, que es el diario de
 * verdad con su paso de página. Las viejas muestran el sumario —el foliado y
 * los titulares— y desde ahí se entra a cada nota, que sigue viva en su
 * dirección de siempre.
 *
 * Es a propósito que no repliquen la tapa completa. Un archivo es una tabla de
 * contenidos: quien entra acá viene a buscar una nota que recuerda, no a leer
 * la tapa de nuevo. Y replicarla sería una segunda tapa que hay que mantener
 * al día con la primera.
 */
export default async function EdicionPage({
  params,
}: PageProps<"/edicion/[slug]">) {
  const usuario = await getUsuario();
  if (!usuario) redirect("/login");

  const { slug } = await params;
  const enLaCalle = await getResumenEdicion();
  if (slug === enLaCalle.slug) redirect("/diario");

  const publicadas = await getPublicadas();
  const edicion = publicadas.find((e) => e.slug === slug);
  // Sólo el archivo: una edición sin publicar no se lee por su dirección
  // aunque alguien la adivine.
  if (!edicion) notFound();

  const notas = await getIndiceDe(slug);

  return (
    <HojaDiario numeroPagina={null}>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <nav aria-label="Volver" className="mb-7">
          <Link
            href="/archivo"
            className="group inline-flex items-center gap-2 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-3 transition-colors hover:text-accent"
          >
            <ArrowLeft
              className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-1"
              aria-hidden="true"
            />
            Archivo
          </Link>
        </nav>

        <header className="border-b-[3px] border-ink pb-4">
          <p className="volanta text-accent">Número del archivo</p>
          <h1 className="titular mt-2.5 text-[clamp(1.9rem,5.4vw,3.4rem)] text-ink">
            {edicion.mes}
          </h1>
          <p className="mt-2 font-sans text-[0.8rem] text-ink-3">
            N.º {edicion.numero} · {notas.length}{" "}
            {notas.length === 1 ? "nota" : "notas"}
            {edicion.etiqueta ? ` · ${edicion.etiqueta}` : ""}
          </p>
        </header>

        <ol className="mt-2 divide-y divide-hairline">
          {notas.map((nota, i) => (
            <li key={nota.slug} className="flex gap-5 py-5">
              <span className="w-12 shrink-0 pt-1 font-sans text-[0.72rem] uppercase tracking-[0.12em] tabular-nums text-ink-3">
                Pág. {i + 2}
              </span>
              <div className="min-w-0 flex-1">
                <p className="volanta text-accent">{nota.seccion}</p>
                <h2 className="titular mt-1.5 text-[1.35rem] text-ink">
                  <Link href={`/nota/${nota.slug}`} className="titular-link">
                    {nota.titulo}
                  </Link>
                </h2>
                <p className="mt-2 max-w-3xl font-serif text-[0.95rem] leading-relaxed text-ink-2">
                  {nota.bajada}
                </p>
                <p className="meta mt-2.5 inline-flex items-center gap-1.5">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {nota.minutosLectura} min
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <SiteFooter />
    </HojaDiario>
  );
}
