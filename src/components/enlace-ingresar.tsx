"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { rutaDeIngreso } from "@/lib/auth/destino";
import { useRutaActual } from "@/lib/auth/usar-ruta-actual";
import { salida } from "@/lib/salida";

/**
 * El "Ingresar" de la cabecera, en el lugar del nombre cuando no hay sesión.
 *
 * Lleva a /login —que explica para qué sirve ingresar y muestra los errores de
 * Cidituc— con la página actual como destino, query incluida: quien ingresa
 * desde una búsqueda vuelve a esa búsqueda. Es de cliente porque la cabecera se
 * arma en el servidor sin saber en qué ruta está.
 *
 * Es también el único camino al panel para un administrador sin sesión: /admin
 * responde 404 hasta que ingresa, para no anunciar que existe.
 *
 * Recién salido de la cuenta, toma el foco y lo dice. Cerrar sesión ya no
 * cambia de página: el botón "Cerrar sesión" desaparece, y sin esto el foco
 * caía en el <body> sin que nadie anunciara nada (ver `src/lib/salida.ts`).
 */
export function EnlaceIngresar() {
  const enlace = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!salida.reciente) return;
    salida.reciente = false;
    enlace.current?.setAttribute("aria-describedby", "salida-reciente");
    enlace.current?.focus();
  }, []);

  return (
    <>
      <Link
        ref={enlace}
        href={rutaDeIngreso(useRutaActual())}
        className="pressable inline-flex h-9 items-center gap-1.5 border border-line bg-chrome px-2.5 font-sans text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-ink-2 hover:border-ink hover:text-ink"
      >
        <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
        Ingresar
      </Link>
      <span id="salida-reciente" className="sr-only">
        Cerraste sesión. Podés seguir leyendo.
      </span>
    </>
  );
}
