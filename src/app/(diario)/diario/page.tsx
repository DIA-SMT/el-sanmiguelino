import Link from "next/link";
import Image from "next/image";
import { ViewTransition } from "react";
import { redirect } from "next/navigation";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Masthead } from "@/components/masthead";
import { SiteFooter } from "@/components/site-footer";
import { FiguraNota } from "@/components/figura-nota";
import { HojaDiario } from "@/components/hoja-diario";
import { edicionActual } from "@/lib/data/edicion-actual";
import { imagenDisponible } from "@/lib/data/imagenes";
import { comentariosRepo } from "@/lib/repos/comentarios";
import { getUsuario } from "@/lib/auth/session";
import { transicionPagina } from "@/lib/transiciones";
import { tiempoRelativo } from "@/lib/utils";
import type { Nota } from "@/lib/types";

function parrafosDe(nota: Nota): string[] {
  return nota.cuerpo.filter((b) => b.tipo === "parrafo").map((b) => b.texto);
}

function citaDe(nota: Nota) {
  const bloque = nota.cuerpo.find((b) => b.tipo === "cita");
  return bloque?.tipo === "cita" ? bloque : null;
}

export default async function Portada() {
  const usuario = await getUsuario();
  if (!usuario) redirect("/login");

  const [principal, segunda, ...cajas] = edicionActual.notas;
  const parrafos = parrafosDe(principal);
  const cita = citaDe(principal);
  const comentarioDestacado = await comentariosRepo.ultimoDeEdicion(
    edicionActual.notas.map((n) => n.slug),
    usuario.id,
  );
  const notaComentada = comentarioDestacado
    ? edicionActual.notas.find((n) => n.slug === comentarioDestacado.notaSlug)
    : null;

  return (
    <ViewTransition {...transicionPagina}>
      <HojaDiario numeroPagina={1}>
        <Masthead edicion={edicionActual} usuario={usuario} />

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          {/* Titular central */}
          <h1 className="entra text-center font-display text-3xl font-black leading-[1.08] text-ink sm:text-5xl">
            <Link
              href={`/nota/${principal.slug}`}
              transitionTypes={["pagina-adelante"]}
              className="transition-colors hover:text-accent-strong"
            >
              {principal.titulo}
            </Link>
          </h1>

          {/* Grilla principal a tres columnas */}
          <div className="entra entra-2 mt-6 grid gap-6 md:grid-cols-[1fr_1.4fr_1fr] md:gap-0">
            {/* Segundo titular */}
            <article className="md:border-r md:border-line md:pr-6">
              <p className="font-sans text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-accent">
                {segunda.seccion}
              </p>
              <h3 className="mt-1.5 font-display text-xl font-bold leading-snug text-ink">
                <Link
                  href={`/nota/${segunda.slug}`}
                  transitionTypes={["pagina-adelante"]}
                  className="transition-colors hover:text-accent-strong"
                >
                  {segunda.titulo}
                </Link>
              </h3>
              <p className="mt-3 text-justify font-serif text-sm leading-relaxed text-ink">
                {parrafosDe(segunda)[0]}
              </p>
              {segunda.imagen && (
                <FiguraNota
                  alt={segunda.imagen.alt}
                  epigrafe={segunda.imagen.epigrafe}
                  src={segunda.imagen.src}
                  className="mt-4"
                />
              )}
            </article>

            {/* Nota principal: foto grande + arranque con capitular */}
            <article className="md:px-6">
              {principal.imagen && (
                <FiguraNota
                  alt={principal.imagen.alt}
                  epigrafe={principal.imagen.epigrafe}
                  src={principal.imagen.src}
                />
              )}
              <p className="drop-cap mt-4 text-justify font-serif text-[0.95rem] leading-relaxed text-ink">
                {parrafos[0]}
              </p>
              <p className="mt-3 text-justify font-serif text-[0.95rem] leading-relaxed text-ink">
                {parrafos[1]}
              </p>
              <Link
                href={`/nota/${principal.slug}`}
                transitionTypes={["pagina-adelante"]}
                className="pressable mt-4 inline-flex items-center gap-1 rounded-md border border-line bg-chrome px-4 py-2 font-sans text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
              >
                Leer la nota completa
              </Link>
            </article>

            {/* Cita en recuadro + continuación */}
            <aside className="md:border-l md:border-line md:pl-6">
              {cita && (
                <figure className="border-y-2 border-ink px-2 py-4 text-center">
                  <blockquote className="font-display text-lg font-medium italic leading-snug text-ink">
                    “{cita.texto}”
                  </blockquote>
                  <figcaption className="mt-3 font-sans text-[0.6rem] uppercase tracking-[0.18em] text-ink-2">
                    {cita.autor}
                    {cita.cargo ? `, ${cita.cargo}` : ""}
                  </figcaption>
                </figure>
              )}
              <p className="mt-4 text-justify font-serif text-sm leading-relaxed text-ink">
                {parrafos[2]}
              </p>
            </aside>
          </div>

          {/* Doble filete separador */}
          <hr className="my-6 border-0 border-b-[3px] border-double border-ink" />

          {/* Fila inferior: notas en recuadro + columna del lector */}
          <section
            aria-label="Más notas de esta edición"
            className="entra entra-3 grid gap-4 md:grid-cols-3"
          >
            {cajas.map((nota) => (
              <article
                key={nota.slug}
                className="border border-line bg-chrome p-4"
              >
                {nota.imagen && imagenDisponible(nota.imagen.src) && (
                  <Link
                    href={`/nota/${nota.slug}`}
                    transitionTypes={["pagina-adelante"]}
                    className="relative mb-3 block aspect-[16/9] overflow-hidden border border-line"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    <Image
                      src={nota.imagen.src}
                      alt=""
                      fill
                      sizes="(min-width: 768px) 360px, 100vw"
                      className="object-cover"
                    />
                  </Link>
                )}
                <p className="font-sans text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-accent">
                  {nota.seccion}
                </p>
                <h3 className="mt-1.5 font-display text-lg font-bold leading-snug text-ink">
                  <Link
                    href={`/nota/${nota.slug}`}
                    transitionTypes={["pagina-adelante"]}
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

            <article className="border border-line bg-bg p-4 md:col-span-3">
              <p className="flex items-center gap-1.5 font-sans text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-accent">
                <ThumbsUp className="h-3 w-3" aria-hidden="true" />
                Columna del lector
              </p>
              {comentarioDestacado ? (
                <>
                  <blockquote className="mt-2 font-serif text-sm italic leading-relaxed text-ink">
                    “{comentarioDestacado.texto}”
                  </blockquote>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-xs text-ink-2">
                    <span className="font-semibold text-ink">
                      {comentarioDestacado.usuarioNombre}
                    </span>
                    <span>{tiempoRelativo(comentarioDestacado.fecha)}</span>
                    {notaComentada && (
                      <span>
                        sobre{" "}
                        <Link
                          href={`/nota/${notaComentada.slug}`}
                          transitionTypes={["pagina-adelante"]}
                          className="italic text-accent underline-offset-2 hover:underline"
                        >
                          {notaComentada.titulo}
                        </Link>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <ThumbsUp className="h-3 w-3" aria-hidden="true" />
                      {comentarioDestacado.likes}
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <ThumbsDown className="h-3 w-3" aria-hidden="true" />
                      {comentarioDestacado.dislikes}
                    </span>
                  </p>
                </>
              ) : (
                <p className="mt-2 font-serif text-sm italic leading-relaxed text-ink-2">
                  Todavía no hay opiniones en esta edición. La primera puede ser
                  la tuya.
                </p>
              )}
              <Link
                href={`/nota/${notaComentada?.slug ?? principal.slug}#columna-lector`}
                transitionTypes={["pagina-adelante"]}
                className="mt-3 inline-block font-sans text-xs font-semibold text-accent underline-offset-2 hover:underline"
              >
                Sumá tu opinión
              </Link>
            </article>
          </section>
        </main>

        <SiteFooter />
      </HojaDiario>
    </ViewTransition>
  );
}
