import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LogoHoja } from "@/components/brand/logos";

export default function NotFound() {
  return (
    <main className="escritorio grano flex flex-1 items-center justify-center px-4 py-24">
      <div className="fade-up hoja grano max-w-md px-8 py-12 text-center sm:px-10">
        <LogoHoja className="mx-auto h-12 w-12 opacity-70" />
        <p className="volanta mt-6 text-accent">Error 404</p>
        <h1 className="titular mt-3 text-[clamp(1.5rem,5vw,2.1rem)] leading-tight text-ink">
          Esta página no está en la edición
        </h1>
        <p className="mt-4 text-pretty font-serif text-[0.98rem] leading-[1.7] text-ink-2">
          Puede que la nota se haya movido o que el enlace esté mal escrito.
        </p>
        <Link
          href="/"
          className="pressable group mt-7 inline-flex items-center gap-2.5 bg-ink px-6 py-3 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-paper hover:bg-accent hover:text-accent-contrast"
        >
          Ir a la portada
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1"
            aria-hidden="true"
          />
        </Link>
      </div>
    </main>
  );
}
