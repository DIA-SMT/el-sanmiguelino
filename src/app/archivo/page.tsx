import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { LogoSanmiguelino } from "@/components/brand/logos";
import { HojaDiario } from "@/components/hoja-diario";
import { TapaDiferida } from "@/components/pdf/tapa-diferida";
import { SiteFooter } from "@/components/site-footer";
import { imagenDisponible } from "@/lib/data/imagenes";
import {
  getIndiceDe,
  getPublicadas,
  getResumenEdicion,
} from "@/lib/repos/edicion";
import type { EdicionResumen, NotaResumen } from "@/lib/types";

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
 *
 * Desde el rediseño de octubre de 2026 es una hemeroteca y no una lista: cada
 * número con su tapa. La tapa nunca se inventa —ver `TapaDelNumero`—.
 */
export default async function ArchivoPage() {
  const [publicadas, enLaCalle] = await Promise.all([
    getPublicadas(),
    getResumenEdicion(),
  ]);

  /* La nota de tapa de cada número de notas escritas, para armar su portada.
     Los facsímiles no la necesitan: su tapa es la página 1 del PDF. */
  const tapas = await Promise.all(
    publicadas.map(async (e) =>
      e.pdf ? undefined : (await getIndiceDe(e.slug))[0],
    ),
  );

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
          <p className="volanta text-accent-strong">Hemeroteca</p>
          <h1 className="titular mt-2 text-[clamp(1.9rem,5.4vw,3.4rem)] text-ink">
            Archivo
          </h1>
          <p className="mt-2 font-sans text-[0.85rem] text-ink-2">
            {publicadas.length}{" "}
            {publicadas.length === 1 ? "número publicado" : "números publicados"}
            . Las notas de los números anteriores siguen en su dirección de
            siempre.
          </p>
        </header>

        <ul className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 sm:gap-x-8 lg:grid-cols-4">
          {publicadas.map((e, i) => (
            <FichaDeNumero
              key={e.slug}
              edicion={e}
              tapa={tapas[i]}
              enLaCalle={e.slug === enLaCalle.slug}
            />
          ))}
        </ul>
      </div>

      <SiteFooter />
    </HojaDiario>
  );
}

/**
 * Un número en la hemeroteca: su tapa apoyada como un ejemplar en el estante,
 * y abajo el cintillo con mes, número y estado.
 *
 * La tarjeta entera se puede apretar, pero el `<a>` es sólo el título y se
 * estira con `after:` sobre toda la tarjeta. No se envuelve la tapa en el
 * enlace porque el visor del PDF trae su propio enlace cuando falla ("abrir el
 * PDF"), y un enlace adentro de otro no es HTML válido.
 */
function FichaDeNumero({
  edicion,
  tapa,
  enLaCalle,
}: {
  edicion: EdicionResumen;
  tapa: NotaResumen | undefined;
  enLaCalle: boolean;
}) {
  const href = enLaCalle ? "/diario" : `/edicion/${edicion.slug}`;
  return (
    <li className="group relative flex flex-col">
      <div className="relative border border-line bg-paper p-1.5 shadow-flotante transition-transform duration-300 group-hover:-translate-y-1 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0">
        <TapaDelNumero edicion={edicion} tapa={tapa} />
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-ink pt-2">
        <span className="meta tabular-nums">N.º {edicion.numero}</span>
        {enLaCalle ? (
          <span className="border border-ink bg-ink px-1.5 py-0.5 font-sans text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-paper">
            En la calle
          </span>
        ) : (
          <span className="meta">{edicion.pdf ? "Impresa" : "Digital"}</span>
        )}
      </div>
      <h2 className="titular mt-1.5 text-[1.2rem] leading-tight text-ink">
        <Link
          href={href}
          className="titular-link after:absolute after:inset-0 after:content-['']"
        >
          {edicion.mes}
        </Link>
      </h2>
      {edicion.tema ? (
        <p className="mt-1 line-clamp-2 font-serif text-[0.85rem] italic leading-snug text-ink-2">
          {edicion.tema}
        </p>
      ) : null}
      <span
        aria-hidden="true"
        className="mt-2 inline-flex items-center gap-1.5 font-sans text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-accent-strong"
      >
        Leer
        <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
      </span>
    </li>
  );
}

/**
 * La tapa de un número, y nunca una inventada.
 *
 * - **Impreso (PDF):** la página 1 del PDF, que se dibuja recién cuando la
 *   tarjeta se acerca a la pantalla (`TapaDiferida`).
 * - **Notas escritas:** una portada armada con lo que el número tiene de
 *   verdad —el logotipo, el mes, la foto y el título de su nota de tapa—, la
 *   misma idea que la miniatura de la landing.
 *
 * La portada armada es decorativa (`aria-hidden`): todo lo que dice ya lo
 * dicen el título y el cintillo de la tarjeta. La del PDF no, porque es la
 * página de verdad y lleva su nombre.
 */
function TapaDelNumero({
  edicion,
  tapa,
}: {
  edicion: EdicionResumen;
  tapa: NotaResumen | undefined;
}) {
  if (edicion.pdf) {
    return (
      <TapaDiferida
        url={edicion.pdf.url}
        etiqueta={`Tapa de El Sanmiguelino, ${edicion.mes}`}
      />
    );
  }

  const src = tapa?.imagen?.src;
  const foto = imagenDisponible(src) ? src : null;

  return (
    <div
      aria-hidden="true"
      className="grano flex aspect-[29/42] flex-col overflow-hidden bg-paper px-2.5 pt-2.5 pb-2"
    >
      <div className="flex items-center justify-between gap-2 border-b border-ink pb-1.5">
        <LogoSanmiguelino decorativo className="w-[62%] text-ink" />
        <span className="font-sans text-[0.42rem] uppercase tracking-[0.14em] text-ink-3">
          N.º {edicion.numero}
        </span>
      </div>
      <p className="mt-1 font-sans text-[0.42rem] uppercase tracking-[0.14em] text-ink-3">
        {edicion.mes}
      </p>
      {foto ? (
        <div className="foto-editorial relative mt-2 min-h-0 flex-1">
          <Image
            src={foto}
            alt=""
            fill
            sizes="(min-width: 1024px) 240px, (min-width: 640px) 30vw, 45vw"
            className="object-cover"
          />
        </div>
      ) : (
        <div className="mt-2 flex-1 border-y border-hairline" />
      )}
      {tapa ? (
        <p className="titular mt-2 line-clamp-3 text-[0.78rem] leading-[1.15] text-ink">
          {tapa.titulo}
        </p>
      ) : null}
    </div>
  );
}
