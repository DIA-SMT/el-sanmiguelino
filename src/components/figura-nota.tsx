import { cn } from "@/lib/utils";

/**
 * Figura de nota. Mientras no haya assets reales de la edición, renderiza un
 * placeholder duotono con trama de semitono (estética de foto de diario).
 * Cuando lleguen las imágenes, este componente pasa a envolver next/image.
 */
export function FiguraNota({
  alt,
  epigrafe,
  className,
}: {
  alt: string;
  epigrafe: string;
  className?: string;
}) {
  return (
    <figure className={cn("w-full", className)}>
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
        {/* silueta abstracta de monumento sobre pedestal */}
        <g fill="var(--ink)" opacity="0.32">
          <rect x="290" y="380" width="220" height="90" />
          <rect x="320" y="350" width="160" height="30" />
          <path d="M400 120 C 360 140, 340 200, 350 260 C 356 300, 370 330, 400 350 C 430 330, 444 300, 450 260 C 460 200, 440 140, 400 120 Z" />
          <circle cx="400" cy="105" r="26" />
        </g>
        <rect x="0.5" y="0.5" width="799" height="519" fill="none" stroke="var(--line)" />
      </svg>
      <figcaption className="mt-2 border-b border-line pb-2 font-serif text-sm italic leading-snug text-ink-2">
        {epigrafe}
      </figcaption>
    </figure>
  );
}
