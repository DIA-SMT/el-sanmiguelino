import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { edicionActual } from "@/lib/data/edicion-actual";
import { imagenDisponible } from "@/lib/data/imagenes";
import { minutosDeLectura } from "@/lib/utils";
import type { Nota } from "@/lib/types";

/** Primer párrafo de la nota, para el arranque de la principal. */
function arranqueDe(nota: Nota): string | undefined {
  const bloque = nota.cuerpo.find((b) => b.tipo === "parrafo");
  return bloque?.tipo === "parrafo" ? bloque.texto : undefined;
}

/**
 * Vista previa de la edición: una portada chica de verdad, con su nota
 * protagonista y tres secundarias, para que se vea cómo se lee el diario antes
 * de ingresar.
 *
 * Los titulares apuntan a la nota real y no al login: el gate se encarga de
 * mandar a ingresar y de volver después a la nota que se quiso leer.
 */
export function VistaPrevia() {
  const [principal, ...resto] = edicionActual.notas;
  const secundarias = resto.slice(0, 3);
  const arranque = arranqueDe(principal);

  return (
    <section
      aria-labelledby="marcando-el-dia"
      className="escritorio grano px-0 py-8 sm:px-6 sm:py-14 lg:py-20"
    >
      {/* La portada chica va apoyada en una hoja sobre el escritorio: es una
          página del diario, no una sección de la landing. */}
      <div className="hoja grano mx-auto w-full max-w-6xl px-4 py-7 sm:px-8 sm:py-10 lg:px-10">
        <div className="filete-seccion flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pb-2">
          <h2 id="marcando-el-dia" className="volanta text-ink">
            Las noticias que están marcando el día
          </h2>
          <p className="meta">Vista previa de la edición</p>
        </div>

        <div className="mt-6 grid gap-x-10 gap-y-7 sm:mt-9 lg:grid-cols-[1.55fr_1fr] lg:gap-y-10">
          {/* La protagonista */}
          <article className="revela lg:border-r lg:border-hairline lg:pr-10">
            {principal.imagen && imagenDisponible(principal.imagen.src) && (
              <Link
                href={`/nota/${principal.slug}`}
                tabIndex={-1}
                aria-hidden="true"
                className="foto-editorial relative mb-5 block aspect-[16/9] w-full"
              >
                <Image
                  src={principal.imagen.src}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 700px, 100vw"
                  className="object-cover"
                />
              </Link>
            )}
            <p className="volanta text-accent">{principal.seccion}</p>
            <h3 className="titular mt-2.5 text-[clamp(1.6rem,3.6vw,2.5rem)] font-black leading-[1.06] text-ink">
              <Link href={`/nota/${principal.slug}`} className="titular-link">
                {principal.titulo}
              </Link>
            </h3>
            <p className="mt-3 line-clamp-3 max-w-2xl text-pretty font-serif text-[0.98rem] italic leading-relaxed text-ink-2 sm:mt-4 sm:line-clamp-none sm:text-[1.02rem]">
              {principal.bajada}
            </p>
            {/* El arranque de la nota es lo más caro en alto y lo más
                redundante con la bajada: en celular no entra. */}
            {arranque && (
              <p className="texto-diario mt-4 hidden max-w-2xl font-serif text-[0.95rem] leading-[1.7] text-ink sm:block">
                {arranque}
              </p>
            )}
            <p className="meta mt-4">
              {minutosDeLectura(principal.cuerpo)} min de lectura
            </p>
          </article>

          {/* Las que siguen */}
          <div className="divide-y divide-hairline">
            {secundarias.map((nota, i) => (
              <article
                key={nota.slug}
                className={`revela grid grid-cols-[1fr_auto] gap-4 py-4 sm:py-5 ${
                  i === 0 ? "lg:pt-0" : ""
                } ${
                  /* En celular alcanzan dos: la tercera empuja la pantalla
                     entera sin agregar información nueva. */
                  i >= 2 ? "hidden sm:grid" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="volanta text-accent">{nota.seccion}</p>
                  <h3 className="titular mt-1.5 text-[1.05rem] font-bold leading-[1.2] text-ink sm:text-[1.1rem]">
                    <Link href={`/nota/${nota.slug}`} className="titular-link">
                      {nota.titulo}
                    </Link>
                  </h3>
                  <p className="mt-1.5 hidden line-clamp-2 font-serif text-[0.85rem] leading-snug text-ink-3 sm:block">
                    {nota.bajada}
                  </p>
                </div>
                {nota.imagen && imagenDisponible(nota.imagen.src) && (
                  <Link
                    href={`/nota/${nota.slug}`}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="foto-editorial relative block h-20 w-20 shrink-0 sm:h-24 sm:w-24"
                  >
                    <Image
                      src={nota.imagen.src}
                      alt=""
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </Link>
                )}
              </article>
            ))}

            <p className="hidden pt-5 font-serif text-[0.9rem] italic leading-relaxed text-ink-3 sm:block">
              La edición completa —{edicionActual.notas.length} notas, columnas
              y la voz de los vecinos— está detrás del ingreso.
            </p>
            <Link
              href="/login"
              className="group mt-1 inline-flex items-center gap-2 border-0 pt-4 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-accent transition-colors hover:text-accent-strong"
            >
              Ingresar al diario
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
