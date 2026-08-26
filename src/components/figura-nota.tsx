import Image from "next/image";
import { imagenDisponible } from "@/lib/data/imagenes";
import { cn } from "@/lib/utils";

/**
 * Figura de nota (Server Component). Si la nota declara `src` y el archivo
 * existe en /public, muestra la foto real; si no, un placeholder duotono con
 * trama de semitono (estética de foto de diario).
 */
export function FiguraNota({
  alt,
  epigrafe,
  src,
  className,
  /** proporción del recorte; por defecto el 8:5 del impreso */
  proporcion = "aspect-[8/5]",
  /** true para la foto principal de la página: es el elemento LCP y se
   *  precarga desde el <head> (en Next 16 esto es `preload`, no `priority`) */
  prioridad = false,
  sizes = "(min-width: 1024px) 640px, 100vw",
}: {
  alt: string;
  epigrafe: string;
  src?: string;
  className?: string;
  proporcion?: string;
  prioridad?: boolean;
  sizes?: string;
}) {
  const real = imagenDisponible(src);

  return (
    <figure className={cn("w-full", className)}>
      {real ? (
        <div className={cn("foto-editorial relative w-full", proporcion)}>
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            preload={prioridad}
            className="foto-asienta object-cover"
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
      </figcaption>
    </figure>
  );
}
