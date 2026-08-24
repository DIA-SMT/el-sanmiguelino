import Link from "next/link";
import Image from "next/image";
import { ViewTransition } from "react";
import { redirect } from "next/navigation";
import { ArrowRight, Clock, Quote, ThumbsDown, ThumbsUp } from "lucide-react";
import { Masthead } from "@/components/masthead";
import { SiteFooter } from "@/components/site-footer";
import { FiguraNota } from "@/components/figura-nota";
import { HojaDiario } from "@/components/hoja-diario";
import {
  getCompletas,
  getIndice,
  getResumenEdicion,
} from "@/lib/repos/edicion";
import { imagenDisponible } from "@/lib/data/imagenes";
import { comentariosRepo } from "@/lib/repos/comentarios";
import { getUsuario } from "@/lib/auth/session";
import { transicionPagina } from "@/lib/transiciones";
import { tiempoRelativo } from "@/lib/utils";
import { seccionesDeEdicion } from "@/lib/data/secciones";
import type { NotaCompleta } from "@/lib/types";

function parrafosDe(nota: NotaCompleta): string[] {
  return nota.cuerpo.filter((b) => b.tipo === "parrafo").map((b) => b.texto);
}

function citaDe(nota: NotaCompleta) {
  const bloque = nota.cuerpo.find((b) => b.tipo === "cita");
  return bloque?.tipo === "cita" ? bloque : null;
}

export default async function Portada() {
  const usuario = await getUsuario();
  if (!usuario) redirect("/login");

  const [edicion, indice] = await Promise.all([
    getResumenEdicion(),
    getIndice(),
  ]);
  // Sólo las dos primeras necesitan el cuerpo: la tapa muestra sus párrafos y
  // su cita. Las demás entran como fichas, con titular y bajada.
  const [principal, segunda] = await getCompletas(
    indice.slice(0, 2).map((n) => n.slug),
  );
  const cajas = indice.slice(2);
  const parrafos = parrafosDe(principal);
  const cita = citaDe(principal);
  // Las notas empiezan en la página 2: la 1 es esta portada.
  const paginaPrincipal =
    indice.findIndex((n) => n.slug === principal.slug) + 2;
  const comentarioDestacado = await comentariosRepo.ultimoDeEdicion(
    indice.map((n) => n.slug),
    usuario.id,
  );
  const notaComentada = comentarioDestacado
    ? indice.find((n) => n.slug === comentarioDestacado.notaSlug)
    : null;

  return (
    <ViewTransition {...transicionPagina}>
      <HojaDiario numeroPagina={1}>
        <Masthead
          edicion={edicion}
          secciones={seccionesDeEdicion(indice)}
          usuario={usuario}
        />

        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          {/* Apertura: la nota de tapa */}
          <div className="entra mx-auto max-w-4xl text-center">
            <p className="volanta text-accent">{principal.seccion}</p>
            <h1 className="titular mt-3 text-[clamp(1.9rem,5.4vw,3.6rem)] font-black leading-[1.04] text-ink">
              <Link
                href={`/nota/${principal.slug}`}
                transitionTypes={["pagina-adelante"]}
                className="transition-colors hover:text-accent-strong"
              >
                {principal.titulo}
              </Link>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-pretty font-serif text-[1.05rem] italic leading-relaxed text-ink-2">
              {principal.bajada}
            </p>
            <p className="meta mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <span>San Miguel de Tucumán</span>
              <span aria-hidden="true" className="text-line">
                ·
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {principal.minutosLectura} min de lectura
              </span>
            </p>
          </div>

          <hr className="mt-7 border-0 border-t border-ink" />

          {/* Grilla principal a tres columnas, como la tapa del impreso */}
          <div className="entra entra-2 mt-7 grid gap-8 md:grid-cols-[0.85fr_1.45fr_0.85fr] md:gap-0">
            {/* Segundo titular */}
            <article className="md:border-r md:border-hairline md:pr-7">
              <p className="volanta text-accent">{segunda.seccion}</p>
              <h2 className="titular mt-2 text-[1.35rem] font-bold leading-[1.15] text-ink">
                <Link
                  href={`/nota/${segunda.slug}`}
                  transitionTypes={["pagina-adelante"]}
                  className="titular-link"
                >
                  {segunda.titulo}
                </Link>
              </h2>
              <p className="texto-diario mt-3 font-serif text-[0.9rem] leading-[1.68] text-ink">
                {parrafosDe(segunda)[0]}
              </p>
              {segunda.imagen && (
                <FiguraNota
                  alt={segunda.imagen.alt}
                  epigrafe={segunda.imagen.epigrafe}
                  src={segunda.imagen.src}
                  className="mt-5"
                  sizes="(min-width: 768px) 260px, 100vw"
                />
              )}
            </article>

            {/* Nota principal: foto grande y arranque con capitular */}
            <article className="md:px-7">
              {principal.imagen && (
                <FiguraNota
                  alt={principal.imagen.alt}
                  epigrafe={principal.imagen.epigrafe}
                  src={principal.imagen.src}
                  prioridad
                  sizes="(min-width: 768px) 640px, 100vw"
                />
              )}
              <p className="drop-cap texto-diario mt-5 font-serif text-[0.97rem] leading-[1.72] text-ink">
                {parrafos[0]}
              </p>
              <p className="texto-diario mt-3 font-serif text-[0.97rem] leading-[1.72] text-ink">
                {parrafos[1]}
              </p>
              <Link
                href={`/nota/${principal.slug}`}
                transitionTypes={["pagina-adelante"]}
                className="pressable group mt-5 inline-flex items-center gap-2 border border-ink bg-transparent px-5 py-2.5 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink hover:bg-ink hover:text-paper"
              >
                Leer la nota completa
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            </article>

            {/* Cita en recuadro y continuación */}
            <aside className="md:border-l md:border-hairline md:pl-7">
              {cita && (
                <figure className="border-y border-ink bg-paper-2 px-4 py-5 text-center">
                  <Quote
                    className="mx-auto h-4 w-4 text-accent"
                    aria-hidden="true"
                  />
                  <blockquote className="titular mt-3 text-[1.05rem] font-medium italic leading-snug text-ink">
                    “{cita.texto}”
                  </blockquote>
                  <figcaption className="meta mt-3.5">
                    {cita.autor}
                    {cita.cargo ? ` · ${cita.cargo}` : ""}
                  </figcaption>
                </figure>
              )}
              <p className="texto-diario mt-5 font-serif text-[0.9rem] leading-[1.68] text-ink">
                {parrafos[2]}
              </p>
              <p className="mt-3 font-serif text-[0.85rem] italic text-ink-3">
                Sigue en la página{" "}
                <Link
                  href={`/nota/${principal.slug}`}
                  transitionTypes={["pagina-adelante"]}
                  className="enlace not-italic tabular-nums"
                >
                  {paginaPrincipal}
                </Link>
              </p>
            </aside>
          </div>

          {/* Doble filete separador */}
          <hr className="my-9 border-0 border-b-[3px] border-double border-ink" />

          {/* Más notas de la edición */}
          <section aria-labelledby="mas-notas">
            <div className="filete-seccion pb-2">
              <h2 id="mas-notas" className="volanta text-ink">
                Más de esta edición
              </h2>
            </div>

            <div className="mt-6 grid gap-x-7 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {cajas.map((nota) => (
                <article
                  key={nota.slug}
                  className="revela group border-t border-hairline pt-4"
                >
                  {nota.imagen && imagenDisponible(nota.imagen.src) && (
                    <Link
                      href={`/nota/${nota.slug}`}
                      transitionTypes={["pagina-adelante"]}
                      className="foto-editorial relative mb-3.5 block aspect-[16/10]"
                      tabIndex={-1}
                      aria-hidden="true"
                    >
                      <Image
                        src={nota.imagen.src}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                        className="object-cover"
                      />
                    </Link>
                  )}
                  <p className="volanta text-accent">{nota.seccion}</p>
                  <h3 className="titular mt-2 text-[1.15rem] font-bold leading-[1.18] text-ink">
                    <Link
                      href={`/nota/${nota.slug}`}
                      transitionTypes={["pagina-adelante"]}
                      className="titular-link"
                    >
                      {nota.titulo}
                    </Link>
                  </h3>
                  <p className="mt-2 text-pretty font-serif text-[0.88rem] leading-[1.65] text-ink-2">
                    {nota.bajada}
                  </p>
                </article>
              ))}
            </div>
          </section>

          {/* Columna del lector */}
          <section
            aria-labelledby="voz-del-lector"
            className="revela mt-10 border-y border-ink bg-paper-2 px-5 py-6 sm:px-7"
          >
            <p
              id="voz-del-lector"
              className="volanta flex items-center gap-2 text-accent"
            >
              <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
              La palabra del lector
            </p>
            {comentarioDestacado ? (
              <>
                <blockquote className="titular mt-3 max-w-3xl text-[1.15rem] font-medium italic leading-snug text-ink">
                  “{comentarioDestacado.texto}”
                </blockquote>
                <p className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-xs text-ink-3">
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
                        className="enlace italic"
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
              <p className="mt-3 max-w-2xl font-serif text-[0.95rem] italic leading-relaxed text-ink-2">
                Todavía no hay opiniones en esta edición. La primera puede ser
                la tuya.
              </p>
            )}
            <Link
              href={`/nota/${notaComentada?.slug ?? principal.slug}#columna-lector`}
              transitionTypes={["pagina-adelante"]}
              className="mt-4 inline-flex items-center gap-1.5 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-accent transition-colors hover:text-accent-strong"
            >
              Sumá tu opinión
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </section>
        </main>

        <SiteFooter />
      </HojaDiario>
    </ViewTransition>
  );
}
