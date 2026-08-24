import Image from "next/image";
import Link from "next/link";
import { imagenDisponible } from "@/lib/data/imagenes";
import { notasRelacionadas } from "@/lib/data/relacionadas";
import { getEdicion } from "@/lib/repos/edicion";
import { minutosDeLectura } from "@/lib/utils";

/** Pie de nota: qué leer después. Mismo lenguaje que las fichas de la portada
 *  —filete arriba, foto, volanta, titular— para que se lea como parte del
 *  diario y no como un módulo de recomendados. */
export async function NotasRelacionadas({ notaSlug }: { notaSlug: string }) {
  const notas = notasRelacionadas(await getEdicion(), notaSlug);
  if (notas.length === 0) return null;

  return (
    <section
      aria-labelledby="seguir-leyendo"
      className="mx-auto mt-14 w-full max-w-6xl"
    >
      <div className="filete-seccion pb-2">
        <h2 id="seguir-leyendo" className="volanta text-ink">
          Seguir leyendo
        </h2>
      </div>

      <div className="mt-6 grid gap-x-7 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {notas.map((nota) => (
          <article
            key={nota.slug}
            className="revela border-t border-hairline pt-4"
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
            <h3 className="titular mt-2 text-[1.1rem] font-bold leading-[1.18] text-ink">
              <Link
                href={`/nota/${nota.slug}`}
                transitionTypes={["pagina-adelante"]}
                className="titular-link"
              >
                {nota.titulo}
              </Link>
            </h3>
            <p className="meta mt-2">
              {minutosDeLectura(nota.cuerpo)} min de lectura
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
