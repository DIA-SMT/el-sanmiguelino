import Link from "next/link";
import { LogoHoja } from "@/components/brand/logos";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <LogoHoja className="h-12 w-12 opacity-60" />
      <h1 className="font-display text-3xl font-black text-ink">
        Esta página no está en la edición
      </h1>
      <p className="max-w-sm font-serif text-ink-2">
        Puede que la nota se haya movido o que el enlace esté mal escrito.
      </p>
      <Link
        href="/"
        className="pressable mt-2 rounded-md bg-accent px-4 py-2 font-sans text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-strong"
      >
        Ir a la portada
      </Link>
    </main>
  );
}
