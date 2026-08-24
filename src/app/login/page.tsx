import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LogoDireccionIA, LogoHoja } from "@/components/brand/logos";
import { edicionActual } from "@/lib/data/edicion-actual";
import { BotonIngresar } from "./boton-ingresar";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const { volverA } = await searchParams;
  const destino = typeof volverA === "string" ? volverA : "/diario";

  return (
    <main className="escritorio grano relative flex flex-1 items-center justify-center overflow-hidden px-4 py-16 sm:py-24">
      <div className="fade-up hoja grano w-full max-w-md px-8 py-10 text-center sm:px-10">
        <span className="mx-auto flex h-16 w-16 items-center justify-center border border-ink p-[3px]">
          <span className="flex h-full w-full items-center justify-center border border-ink/25">
            <LogoHoja className="h-10 w-10" />
          </span>
        </span>

        <h1 className="bandera mt-6 text-[clamp(1.7rem,7vw,2.3rem)] text-ink">
          El Sanmiguelino
        </h1>
        <div className="rule-double mt-4 mb-[7px] py-1.5">
          <p className="meta">Diario digital · {edicionActual.mes}</p>
        </div>

        <p className="mt-7 text-pretty font-serif text-[0.98rem] leading-[1.7] text-ink-2">
          La edición digital es{" "}
          <strong className="font-semibold text-ink">
            exclusiva para usuarios de Cidituc
          </strong>
          . Ingresá con tu cuenta para leer el diario del mes.
        </p>

        <BotonIngresar destino={destino} />

        <Link
          href="/"
          className="group mt-5 inline-flex items-center gap-2 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-3 transition-colors hover:text-accent"
        >
          <ArrowLeft
            className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-1"
            aria-hidden="true"
          />
          Volver a la página principal
        </Link>

        <div className="rule-thin mt-9 pt-6">
          <p className="flex items-center justify-center gap-2.5">
            <span className="meta">Desarrollado por</span>
            <LogoDireccionIA className="scale-90" />
          </p>
        </div>
      </div>
    </main>
  );
}
