import Image from "next/image";
import { imagenDisponible } from "@/lib/data/imagenes";
import { cn } from "@/lib/utils";

/**
 * Cita de una persona, con la forma del impreso.
 *
 * En el papel es: retrato **circular** en blanco y negro a la izquierda, un
 * filete fino arriba del texto que arranca a la derecha del retrato, la cita en
 * la sans del diario en **negrita** y la atribución debajo, chica y en caja
 * normal. Alineada a la izquierda.
 *
 * Lo que NO es, y era lo que hacíamos: un recuadro con fondo, un ícono de
 * comillas de librería, serif itálica y todo centrado. Eso es vocabulario de
 * blog. El diario marca la cita con el peso y el filete, no con una caja.
 *
 * El retrato es opcional y no se inventa: sin foto de la persona el bloque
 * sigue siendo correcto —filete, cita en negrita, atribución— y simplemente no
 * hay círculo. Es una publicación oficial; poner la cara equivocada al lado de
 * una declaración es peor que no poner ninguna.
 */
export function CitaPersona({
  texto,
  autor,
  cargo,
  retrato,
  className,
}: {
  texto: string;
  autor: string;
  cargo?: string;
  /** Ruta bajo /public. Si no está el archivo, no se renderiza el círculo. */
  retrato?: string;
  className?: string;
}) {
  const hayRetrato = Boolean(retrato && imagenDisponible(retrato));

  return (
    <figure className={cn("flex items-start gap-5", className)}>
      {hayRetrato && (
        <Image
          src={retrato!}
          alt=""
          width={168}
          height={168}
          sizes="(min-width: 640px) 88px, 68px"
          className="h-[68px] w-[68px] shrink-0 rounded-full object-cover grayscale sm:h-[88px] sm:w-[88px]"
        />
      )}
      <div className="min-w-0 flex-1 border-t border-ink pt-3.5">
        <blockquote className="font-sans text-[1.05rem] font-bold leading-[1.32] text-ink sm:text-[1.15rem]">
          “{texto}”
        </blockquote>
        <figcaption className="atribucion mt-3">
          {autor}
          {cargo ? `, ${cargo}` : ""}
        </figcaption>
      </div>
    </figure>
  );
}
