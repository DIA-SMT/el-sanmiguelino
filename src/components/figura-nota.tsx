import Image from "next/image";
import { imagenDisponible } from "@/lib/data/imagenes";
import { medirImagen } from "@/lib/medir-imagen";
import { cn } from "@/lib/utils";

/**
 * Figura de nota (Server Component). Si la nota declara `src` y el archivo
 * existe en /public, muestra la foto real; si no, un placeholder duotono con
 * trama de semitono (estética de foto de diario).
 *
 * **Ninguna foto se recorta.** Se muestra con su propia proporción, la que
 * sale de leer su encabezado (`medirImagen`).
 *
 * Antes había un recorte fijo de 8:5, el del impreso, para todo lo apaisado.
 * Dos veces mostró por qué no sirve:
 * - Una foto vertical perdía dos tercios, y lo primero que se iba era la cara:
 *   la tapa de septiembre salió con Duki decapitado. Desde entonces las
 *   verticales van con su proporción, **en una columna angosta**, que es lo que
 *   hace un diario con una foto parada: no la estira a lo ancho de la página.
 * - Una panorámica (el Paseo Alberdi de octubre, casi 2,6:1) perdía más de un
 *   tercio del ancho, y con él los rótulos que tenía encima —"Escultura del
 *   Libro Monumental", "Tótem interactivo"— y el epígrafe impreso en la foto.
 *   Lo que se recorta de una foto así no es aire: es lo que la foto dice.
 *
 * Si no se puede medir (el servidor de las fotos no contesta), va la caja de
 * proporción fija, pero con la foto ENTERA adentro (`object-contain`): una
 * banda de papel a los costados antes que un rótulo cortado.
 */
export async function FiguraNota({
  alt,
  epigrafe,
  src,
  className,
  /** La caja cuando la foto no se puede medir (y la del dibujo de reemplazo);
   *  por defecto el 8:5 del impreso. La foto no se recorta igual. */
  proporcion = "aspect-[8/5]",
  /** true para la foto principal de la página: es el elemento LCP y se
   *  precarga desde el <head> (en Next 16 esto es `preload`, no `priority`) */
  prioridad = false,
  sizes = "(min-width: 1024px) 640px, 100vw",
  /** Firma del fotógrafo. En el impreso va en cuerpo 6 girada contra el borde
   *  de la página; acá va debajo del epígrafe, más chica y en versalitas, que
   *  es como la lleva un diario cuando no puede girarla. */
  credito,
}: {
  alt: string;
  epigrafe: string;
  src?: string;
  className?: string;
  proporcion?: string;
  prioridad?: boolean;
  sizes?: string;
  credito?: string;
  /**
   * Era "respetar la proporción real en vez del recorte 8:5", para las
   * infografías. Ahora ninguna figura se recorta, así que no cambia nada; queda
   * para no tocar a quien lo pasa.
   */
  sinRecorte?: boolean;
}) {
  const real = imagenDisponible(src);
  const medidas = real && src ? await medirImagen(src) : null;
  // 1.1 y no 1: una foto casi cuadrada entra bien en el recorte, y cambiarle
  // la caja por tres píxeles de diferencia sería ruido.
  const vertical = medidas ? medidas.alto / medidas.ancho > 1.1 : false;

  return (
    <figure className={cn("w-full", className)}>
      {real ? (
        <div
          className={cn(
            "foto-editorial relative",
            vertical
              ? "mx-auto w-full max-w-[22rem]"
              : medidas
                ? "w-full"
                : cn("w-full", proporcion),
          )}
          style={
            medidas
              ? { aspectRatio: `${medidas.ancho} / ${medidas.alto}` }
              : undefined
          }
        >
          <Image
            src={src}
            alt={alt}
            fill
            // Una foto vertical se dibuja en una columna de 22rem: pedirla del
            // ancho de la página sería traer cuatro veces los píxeles que se
            // ven.
            sizes={vertical ? "(min-width: 640px) 352px, 100vw" : sizes}
            preload={prioridad}
            // Con la caja a la medida de la foto, `object-cover` no recorta
            // nada (y no deja el filo de un píxel que deja `contain` al
            // redondear). Sin medidas, `contain`: entera, aunque sobre papel.
            className={cn(
              "foto-asienta",
              medidas ? "object-cover" : "object-contain",
            )}
          />
        </div>
      ) : (
        <div className={cn("foto-editorial relative w-full", proporcion)}>
          <svg
            viewBox="0 0 800 520"
            role="img"
            aria-label={alt}
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 h-full w-full"
          >
            <defs>
              <pattern
                id="halftone"
                width="7"
                height="7"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="3.5" cy="3.5" r="1.1" fill="var(--ink)" opacity="0.16" />
              </pattern>
              <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--ink)" stopOpacity="0.04" />
                <stop offset="1" stopColor="var(--ink)" stopOpacity="0.14" />
              </linearGradient>
            </defs>
            <rect width="800" height="520" fill="url(#cielo)" />
            <rect width="800" height="520" fill="url(#halftone)" />
            <g fill="var(--ink)" opacity="0.3">
              <rect x="290" y="380" width="220" height="90" />
              <rect x="320" y="350" width="160" height="30" />
              <path d="M400 120 C 360 140, 340 200, 350 260 C 356 300, 370 330, 400 350 C 430 330, 444 300, 450 260 C 460 200, 440 140, 400 120 Z" />
              <circle cx="400" cy="105" r="26" />
            </g>
          </svg>
        </div>
      )}
      {/* En el impreso el epígrafe es una línea diminuta apoyada debajo de la
          foto, a la izquierda: sin guión de color, sin itálica y sin filete
          que lo separe. Todo eso lo habíamos puesto nosotros. */}
      <figcaption className="mt-2 font-sans text-[0.68rem] leading-snug text-ink-3 text-pretty">
        {epigrafe}
        {credito ? (
          <span className="mt-1 block text-[0.6rem] uppercase tracking-[0.12em] text-ink-3/80">
            {credito}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
