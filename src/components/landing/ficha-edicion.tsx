import Link from "next/link";
import { ArrowRight, FileDown } from "lucide-react";
import type { EdicionResumen, NotaResumen } from "@/lib/types";

/**
 * La ficha del número en la calle: la franja que va debajo del encabezado de
 * la landing, con el dato duro de la edición —número, mes, páginas, de qué
 * trata— y las tres puertas: leerla, bajarla en PDF y los números anteriores.
 *
 * La tapa NO se repite acá: ya está arriba, en el encabezado. Esto es la
 * etiqueta del ejemplar en la exhibición, no otro ejemplar.
 *
 * Todo sale de la edición real. Las páginas se cuentan distinto según cómo se
 * publicó el número, y se dicen distinto a propósito: un facsímil tiene
 * páginas (las del PDF); una edición de notas escritas tiene notas, y llamarlas
 * "páginas" sería mentir sobre el papel.
 */
export function FichaEdicion({
  edicion,
  indice,
}: {
  edicion: EdicionResumen;
  indice: NotaResumen[];
}) {
  const secciones = [...new Set(indice.map((n) => n.seccion))];
  const cuantas = edicion.pdf
    ? {
        valor: edicion.pdf.paginas,
        rotulo: edicion.pdf.paginas === 1 ? "página" : "páginas",
      }
    : { valor: indice.length, rotulo: indice.length === 1 ? "nota" : "notas" };

  return (
    <section
      aria-labelledby="edicion-en-la-calle"
      className="grano border-b border-line bg-paper"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_auto] md:items-end md:gap-12 lg:py-12">
        <div className="revela min-w-0">
          <p className="volanta text-accent-strong">La edición en la calle</p>
          <h2
            id="edicion-en-la-calle"
            className="titular mt-3 text-[clamp(1.7rem,4vw,2.5rem)] leading-[1.1] text-ink"
          >
            {edicion.mes}
          </h2>
          {edicion.tema ? (
            <p className="mt-2 max-w-xl text-pretty font-serif text-[1.05rem] italic leading-relaxed text-ink-2">
              {edicion.tema}
            </p>
          ) : null}

          {/* El dato duro, como el cintillo de un ejemplar: filete arriba,
              rótulos en versalitas y el número en la tipografía del titular. */}
          <dl className="mt-6 grid max-w-2xl grid-cols-2 border-t border-ink sm:grid-cols-[repeat(3,auto)] sm:justify-start">
            <div className="border-b border-hairline py-3 pr-8 sm:border-b-0">
              <dt className="meta">Número</dt>
              <dd className="titular mt-1 text-[1.35rem] tabular-nums text-ink">
                N.º {edicion.numero}
              </dd>
            </div>
            <div className="border-b border-hairline py-3 pr-8 sm:border-b-0 sm:border-l sm:pl-8">
              <dt className="meta">Extensión</dt>
              <dd className="titular mt-1 text-[1.35rem] tabular-nums text-ink">
                {cuantas.valor} {cuantas.rotulo}
              </dd>
            </div>
            <div className="col-span-2 py-3 sm:col-span-1 sm:border-l sm:pl-8">
              <dt className="meta">
                {secciones.length === 1 ? "Sección" : "Secciones"}
              </dt>
              <dd className="mt-1.5 font-sans text-[0.78rem] font-semibold uppercase tracking-[0.12em] text-ink-2">
                {secciones.join(" · ")}
              </dd>
            </div>
          </dl>
        </div>

        <div className="revela flex flex-col items-start gap-4 md:items-end">
          <Link
            href="/diario"
            className="pressable group inline-flex items-center gap-2.5 bg-accent px-7 py-3.5 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-accent-contrast shadow-control hover:bg-accent-strong"
          >
            Leer la edición
            <ArrowRight
              className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
          <p className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {edicion.pdf ? (
              <a
                href={edicion.pdf.url}
                target="_blank"
                rel="noopener"
                className="enlace inline-flex items-center gap-1.5 font-sans text-[0.8rem]"
              >
                <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
                Descargar en PDF
              </a>
            ) : null}
            <Link href="/archivo" className="enlace font-sans text-[0.8rem]">
              Números anteriores
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
