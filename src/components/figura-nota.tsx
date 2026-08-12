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
}: {
  alt: string;
  epigrafe: string;
  src?: string;
  className?: string;
}) {
  const real = imagenDisponible(src);

  return (
    <figure className={cn("w-full", className)}>
      {real ? (
        <div className="relative aspect-[8/5] w-full overflow-hidden border border-line bg-chrome">
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(min-width: 1024px) 640px, 100vw"
            className="object-cover"
          />
        </div>
      ) : (
        <svg
          viewBox="0 0 800 520"
          role="img"
          aria-label={alt}
          className="block w-full border border-line bg-chrome"
        >
          <defs>
            <pattern id="halftone" width="7" height="7" patternUnits="userSpaceOnUse">
              <circle cx="3.5" cy="3.5" r="1.1" fill="var(--ink)" opacity="0.16" />
            </pattern>
            <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--ink)" stopOpacity="0.04" />
              <stop offset="1" stopColor="var(--ink)" stopOpacity="0.14" />
            </linearGradient>
          </defs>
          <rect width="800" height="520" fill="url(#cielo)" />
          <rect width="800" height="520" fill="url(#halftone)" />
          <g fill="var(--ink)" opacity="0.32">
            <rect x="290" y="380" width="220" height="90" />
            <rect x="320" y="350" width="160" height="30" />
            <path d="M400 120 C 360 140, 340 200, 350 260 C 356 300, 370 330, 400 350 C 430 330, 444 300, 450 260 C 460 200, 440 140, 400 120 Z" />
            <circle cx="400" cy="105" r="26" />
          </g>
          <rect x="0.5" y="0.5" width="799" height="519" fill="none" stroke="var(--line)" />
        </svg>
      )}
      <figcaption className="mt-2 border-b border-line pb-2 font-serif text-sm italic leading-snug text-ink-2">
        {epigrafe}
      </figcaption>
    </figure>
  );
}
