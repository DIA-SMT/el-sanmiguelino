import { LogoDireccionIA } from "@/components/brand/logos";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-paper">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4 py-8 text-center sm:px-6">
        <p className="font-serif text-sm text-ink-2">
          Municipalidad de San Miguel de Tucumán · 9 de Julio 570, San Miguel de
          Tucumán (4000), Tucumán.
          <br />
          Publicación gratuita, prohibida su venta.
        </p>
        <div className="rule-thin w-full max-w-xs" aria-hidden="true" />
        <p className="flex items-center gap-3 font-sans text-xs text-ink-2">
          <span>Desarrollado por</span>
          <LogoDireccionIA />
        </p>
      </div>
    </footer>
  );
}
