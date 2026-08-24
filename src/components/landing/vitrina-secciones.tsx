import Image from "next/image";
import Link from "next/link";
import { getEdicion } from "@/lib/repos/edicion";
import { imagenDisponible } from "@/lib/data/imagenes";
import { notasPorSeccion, seccionesDeEdicion } from "@/lib/data/secciones";

/**
 * Las secciones de la edición como vitrina, no como botonera: cada una entra
 * con la foto de una de sus notas y su nombre en tipografía de titular.
 *
 * Las secciones sin foto cargada no muestran un hueco: caen en una placa
 * tipográfica con la trama de semitono, que se lee como una decisión y no como
 * una imagen que falta.
 */
export async function VitrinaSecciones() {
  const edicion = await getEdicion();
  const secciones = seccionesDeEdicion(edicion).map((seccion) => {
    const notas = notasPorSeccion(edicion, seccion.slug);
    const conFoto = notas.find((n) => imagenDisponible(n.imagen?.src));
    return {
      ...seccion,
      cantidad: notas.length,
      foto: conFoto?.imagen,
    };
  });

  return (
    <section aria-labelledby="secciones-edicion" className="grano bg-paper">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="filete-seccion flex flex-wrap items-end justify-between gap-x-6 gap-y-2 pb-2">
          <h2 id="secciones-edicion" className="volanta text-ink">
            Las secciones de la edición
          </h2>
          <p className="meta">
            {edicion.mes} · N.º {edicion.numero}
          </p>
        </div>

        {/* Tira apretada, no galería: las secciones son un índice, no
            contenido. En escritorio entran todas en una fila; en celular van
            de tres en tres para que no sean tres pantallas de scroll. */}
        <ul className="mt-8 grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-6 lg:gap-x-3">
          {secciones.map((seccion) => (
            <li key={seccion.slug} className="revela">
              <Link
                href={`/seccion/${seccion.slug}`}
                className="group block focus-visible:outline-offset-4"
              >
                <div className="foto-editorial relative aspect-[5/6] w-full">
                  {seccion.foto && imagenDisponible(seccion.foto.src) ? (
                    <Image
                      src={seccion.foto.src}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 190px, 33vw"
                      className="object-cover"
                    />
                  ) : (
                    <span className="trama-punto absolute inset-0 flex items-center justify-center bg-paper-2">
                      {/* La inicial y no el nombre completo: a este tamaño
                          "Innovación" no entra en la placa y se cortaba. */}
                      <span
                        aria-hidden="true"
                        className="bandera text-[clamp(2.5rem,8vw,4rem)] leading-none text-ink/12"
                      >
                        {seccion.nombre.charAt(0)}
                      </span>
                    </span>
                  )}
                </div>

                {/* El nombre en versalitas y no en titular: acá la foto es la
                    que habla y el nombre es la etiqueta. */}
                <div className="mt-2.5 border-t border-ink pt-2 transition-colors duration-300 group-hover:border-accent">
                  <h3 className="font-sans text-[0.62rem] font-semibold uppercase leading-tight tracking-[0.16em] text-ink transition-colors duration-300 group-hover:text-accent-strong">
                    {seccion.nombre}
                  </h3>
                  <span className="mt-1 block font-sans text-[0.6rem] tabular-nums text-ink-3">
                    {seccion.cantidad === 1
                      ? "1 nota"
                      : `${seccion.cantidad} notas`}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
