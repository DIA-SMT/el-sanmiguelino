import Link from "next/link";
import { LogoHoja } from "@/components/brand/logos";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserChip } from "@/components/user-chip";
import type { Edicion, Usuario } from "@/lib/types";

export function Masthead({
  edicion,
  usuario,
}: {
  edicion: Edicion;
  usuario: Usuario;
}) {
  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="flex items-center justify-end gap-2 pt-3 font-sans">
          <ThemeToggle />
          <UserChip usuario={usuario} />
        </div>

        <div className="flex items-end justify-center gap-3 pb-3 pt-2 sm:gap-4">
          <Link
            href="/diario"
            className="flex items-end gap-3 no-underline sm:gap-4"
          >
            <h1 className="font-display text-4xl font-black uppercase tracking-tight text-ink sm:text-6xl">
              El Sanmiguelino
            </h1>
            <LogoHoja decorativo className="mb-1 h-8 w-8 sm:h-11 sm:w-11" />
          </Link>
        </div>

        <p className="rule-double mb-[7px] py-1.5 text-center font-sans text-[0.7rem] uppercase tracking-[0.2em] text-ink-2">
          San Miguel de Tucumán · {edicion.mes} · {edicion.etiqueta ?? "Edición mensual"} · N.º{" "}
          {edicion.numero}
        </p>
      </div>
    </header>
  );
}
