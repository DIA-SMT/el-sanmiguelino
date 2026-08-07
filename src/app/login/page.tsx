import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LogoDireccionIA, LogoHoja } from "@/components/brand/logos";
import { BotonIngresar } from "./boton-ingresar";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const { volverA } = await searchParams;
  const destino = typeof volverA === "string" ? volverA : "/diario";

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-lg border border-line bg-paper p-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
        <LogoHoja className="mx-auto h-14 w-14" />
        <h1 className="mt-5 font-display text-3xl font-black uppercase tracking-tight text-ink">
          El Sanmiguelino
        </h1>
        <p className="mt-1 font-sans text-[0.65rem] uppercase tracking-[0.2em] text-ink-2">
          Diario digital · Municipalidad de San Miguel de Tucumán
        </p>

        <div className="rule-thin my-6" aria-hidden="true" />

        <p className="font-serif text-sm leading-relaxed text-ink-2">
          La edición digital es <strong className="text-ink">exclusiva para usuarios de Cidituc</strong>.
          Ingresá con tu cuenta para leer el diario del mes.
        </p>

        <BotonIngresar destino={destino} />

        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-1.5 font-sans text-xs text-ink-2 transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Volver a la página principal
        </Link>

        <p className="mt-8 flex items-center justify-center gap-2 font-sans text-[0.65rem] text-ink-2">
          Desarrollado por <LogoDireccionIA className="scale-90" />
        </p>
      </div>
    </main>
  );
}
