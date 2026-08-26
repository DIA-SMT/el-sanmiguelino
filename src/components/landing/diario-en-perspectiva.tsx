import Image from "next/image";
import { LogoHoja } from "@/components/brand/logos";
import {
  getCompletas,
  getIndice,
  getResumenEdicion,
} from "@/lib/repos/edicion";
import { imagenDisponible } from "@/lib/data/imagenes";
import { seccionesDeEdicion } from "@/lib/data/secciones";

/**
 * El diario impreso apoyado en el escritorio, visto en ángulo, con la pila de
 * hojas de abajo asomando.
 *
 * Es 3D de verdad y no una tarjeta rotada: la perspectiva va en el envoltorio
 * y las hojas de la pila se separan con `translateZ`, así el canto que se
 * acerca crece y el lejano se comprime. Rotar en 2D daba justamente la
 * sensación de plancha que había que sacar.
 *
 * Va con contenido real de la edición y no con líneas de relleno: a este
 * tamaño no se lee de corrido, pero se reconoce que es un diario. Decorativo
 * para lectores de pantalla —los mismos titulares están enlazados más abajo,
 * en la vista previa.
 */
export async function DiarioEnPerspectiva() {
  const [edicion, indice] = await Promise.all([
    getResumenEdicion(),
    getIndice(),
  ]);
  const [principal] = await getCompletas([indice[0].slug]);
  const secundarias = indice.slice(1, 4);
  const secciones = seccionesDeEdicion(indice)
    .slice(0, 6)
    .map((s) => s.nombre);

  return (
    /* Sin tope de ancho en celular. Probé acotarlo para ganar alto y no sirve:
       al angostarse, el contenido de la portada reflowea y la pieza queda
       igual de alta, sólo que más flaca. El alto del hero se recortó por otro
       lado —los chips duplicados y los paddings—. */
    <div aria-hidden="true" className="select-none">
      <div className="fade-up-2 [perspective:1600px] [perspective-origin:35%_25%]">
        <div className="relative [transform:rotateX(4deg)_rotateY(-15deg)_rotateZ(-1.2deg)] [transform-style:preserve-3d]">
          {/* La pila: los cantos de las hojas de abajo */}
          {[
            { z: -18, x: 10, y: 12 },
            { z: -12, x: 6, y: 8 },
            { z: -6, x: 3, y: 4 },
          ].map(({ z, x, y }) => (
            <div
              key={z}
              style={{ transform: `translate3d(${x}px, ${y}px, ${z}px)` }}
              className="absolute inset-0 border border-line bg-paper-2 shadow-flotante"
            />
          ))}

          {/* La hoja de arriba */}
          <div className="hoja grano relative px-4 pb-4 pt-3.5 shadow-flotante sm:px-5 sm:pb-5">
            {/* Bandera */}
            <div className="flex items-center justify-between gap-3 border-b border-hairline pb-2">
              <span className="font-sans text-[0.42rem] uppercase tracking-[0.16em] text-ink-3">
                Edición N.º {edicion.numero}
              </span>
              <span className="flex items-center gap-1.5">
                <LogoHoja className="h-3 w-3" decorativo />
                <span className="bandera text-[0.95rem] text-ink sm:text-[1.15rem]">
                  El Sanmiguelino
                </span>
              </span>
              <span className="font-sans text-[0.42rem] uppercase tracking-[0.16em] text-ink-3">
                {edicion.mes}
              </span>
            </div>

            {/* Barra de secciones */}
            <div className="flex items-center justify-between gap-1 border-b border-ink py-1.5">
              {secciones.map((s) => (
                <span
                  key={s}
                  className="font-sans text-[0.4rem] font-semibold uppercase tracking-[0.14em] text-ink-2"
                >
                  {s}
                </span>
              ))}
            </div>

            {/* Nota de tapa */}
            <div className="mt-3 grid grid-cols-[1.15fr_1fr] gap-3">
              <div className="min-w-0">
                <p className="font-sans text-[0.4rem] font-semibold uppercase tracking-[0.18em] text-accent">
                  {principal.seccion}
                </p>
                <p className="titular mt-1 text-[0.82rem] leading-[1.1] text-ink sm:text-[0.95rem]">
                  {principal.titulo}
                </p>
                <p className="mt-1.5 font-serif text-[0.44rem] leading-[1.5] text-ink-2">
                  {principal.bajada.slice(0, 150)}…
                </p>
                <p className="mt-1.5 font-sans text-[0.4rem] uppercase tracking-[0.12em] text-ink-3">
                  Redacción · {principal.minutosLectura} min de lectura
                </p>
              </div>
              {principal.imagen && imagenDisponible(principal.imagen.src) && (
                <div className="foto-editorial relative aspect-[4/5] w-full">
                  <Image
                    src={principal.imagen.src}
                    alt=""
                    fill
                    sizes="220px"
                    className="object-cover"
                  />
                </div>
              )}
            </div>

            {/* Las que siguen, a tres columnas */}
            <div className="mt-3 grid grid-cols-3 gap-2.5 border-t border-ink pt-2">
              {secundarias.map((nota) => (
                <div key={nota.slug} className="min-w-0">
                  <p className="font-sans text-[0.38rem] font-semibold uppercase tracking-[0.16em] text-accent">
                    {nota.seccion}
                  </p>
                  <p className="titular mt-0.5 text-[0.5rem] leading-[1.2] text-ink">
                    {nota.titulo.slice(0, 62)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
