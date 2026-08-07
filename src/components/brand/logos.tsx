import { cn } from "@/lib/utils";

/** Logo hoja de la Municipalidad de San Miguel de Tucumán:
 *  dos pétalos (azul y celeste) con el sol amarillo. */
export function LogoHoja({
  className,
  title = "Municipalidad de San Miguel de Tucumán",
  decorativo = false,
}: {
  className?: string;
  title?: string;
  /** true cuando el logo acompaña un texto que ya lo nombra (p. ej. dentro de un h1) */
  decorativo?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 240 240"
      role={decorativo ? undefined : "img"}
      aria-label={decorativo ? undefined : title}
      aria-hidden={decorativo || undefined}
      className={cn("h-10 w-10", className)}
    >
      {!decorativo && <title>{title}</title>}
      {/* pétalo izquierdo */}
      <path
        d="M104 232 C 38 208, 8 138, 34 46 C 44 42, 56 40, 66 42 C 112 92, 124 160, 104 232 Z"
        fill="var(--azul)"
      />
      {/* pétalo derecho */}
      <path
        d="M124 230 C 118 158, 136 96, 186 52 C 204 60, 216 72, 222 84 C 226 160, 186 214, 124 230 Z"
        fill="var(--celeste)"
      />
      {/* sol */}
      <circle cx="112" cy="34" r="26" fill="var(--sol)" />
    </svg>
  );
}

/** Isologotipo del equipo desarrollador, para el footer. */
export function LogoDireccionIA({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 240 240" aria-hidden="true" className="h-8 w-8 shrink-0">
        <path
          d="M104 232 C 38 208, 8 138, 34 46 C 44 42, 56 40, 66 42 C 112 92, 124 160, 104 232 Z"
          fill="var(--azul)"
        />
        <path
          d="M124 230 C 118 158, 136 96, 186 52 C 204 60, 216 72, 222 84 C 226 160, 186 214, 124 230 Z"
          fill="var(--celeste)"
        />
        <circle cx="112" cy="34" r="26" fill="var(--sol)" />
      </svg>
      <span className="font-sans font-bold uppercase leading-none tracking-[0.18em] text-ink-2">
        <span className="block text-[0.6rem]">Dirección</span>
        <span className="block text-[0.85rem]">de IA</span>
      </span>
    </span>
  );
}
