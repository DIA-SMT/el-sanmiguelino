"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { nombreDeDiario } from "@/lib/auth/cidituc/nombre";
import { olvidarBorradores } from "@/lib/borradores";
import { olvidarPaginasGuardadas } from "@/lib/pwa";
import { salida } from "@/lib/salida";

export function UserChip({
  nombre: nombreCrudo,
  soloMonograma = false,
  salirA,
}: {
  /** Sólo el nombre, no el usuario entero: este componente es de cliente y lo
   *  que recibe viaja dentro del HTML. */
  nombre: string;
  /**
   * Deja el nombre para el lector de pantalla y muestra sólo el monograma, a
   * cualquier ancho.
   *
   * Existe por la barra del panel plegada, que mide 80px: ahí el nombre no
   * entra y `sm:not-sr-only` no ayuda, porque mira el ancho de la VENTANA y no
   * el del hueco donde el chip está metido. Es una prop y no un selector CSS
   * desde afuera a propósito — quien lo mete en un lugar angosto lo sabe, y una
   * regla que alcance el marcado ajeno se rompe al primer cambio de acá.
   */
  soloMonograma?: boolean;
  /** A dónde ir al cerrar sesión, si quedarse no sirve. Lo decide quien lo
   *  monta: la cabecera lo pasa durante la vista previa de una edición, que sin
   *  sesión es un 404. */
  salirA?: string;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const [saliendo, setSaliendo] = useState(false);

  // Se normaliza también acá y no sólo al ingresar. Normalizar en el login es la
  // optimización; normalizar al mostrar es la corrección: una sesión emitida
  // antes de que existiera `nombreDeDiario` arrastra el nombre en mayúsculas
  // hasta ocho horas, y no hay motivo para que alguien tenga que volver a entrar
  // para que su nombre se vea bien. La función es pura y no importa nada.
  const nombre = nombreDeDiario(nombreCrudo);

  async function cerrarSesion() {
    setSaliendo(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      // Después del logout y no antes: si el POST falla, la sesión sigue
      // abierta y las páginas guardadas siguen siendo de esta persona.
      await olvidarPaginasGuardadas();
      // Y los comentarios a medio escribir que esperaban un nuevo ingreso: no
      // son del que viene (ver `src/lib/borradores.ts`).
      olvidarBorradores();
      // Leer es libre: quien sale de su cuenta se queda en lo que estaba
      // leyendo, ahora sin nombre. Antes iba a "/", que para alguien sin
      // sesión es la presentación. Desde el panel o desde la vista previa de
      // una edición, en cambio, se va a la tapa: sin sesión los dos son 404.
      const destino = salirA ?? (ruta.startsWith("/admin") ? "/diario" : null);
      // El "Ingresar" que aparece en lugar de este chip toma el foco y avisa
      // que se cerró la sesión (ver `src/lib/salida.ts`).
      salida.reciente = true;
      if (destino) router.push(destino);
      router.refresh();
    } catch {
      setSaliendo(false);
    }
  }

  // Primera palabra y ÚLTIMA, no las dos primeras: con "Alfredo Agustin Brito"
  // las dos primeras dan "AA" —dos veces el nombre de pila y nunca el apellido—.
  const palabras = nombre.split(" ").filter(Boolean);
  const iniciales = (
    palabras.length > 1
      ? palabras[0][0] + palabras[palabras.length - 1][0]
      : (palabras[0]?.[0] ?? "")
  ).toLocaleUpperCase("es");

  return (
    /* `flex-wrap` con `max-w-full` y no una fila fija: los dos controles suman
       80px de ancho, y en la barra plegada del panel el hueco es de 64 — ahí se
       salían del borde. Envolviendo se apilan solos donde no entran y siguen en
       fila donde sí, que es lo que hace que la misma pieza sirva en la cabecera
       del diario, en un teléfono y en una barra de 80px sin que nadie le tenga
       que decir en cuál está. */
    <div className="flex max-w-full flex-wrap items-center justify-center gap-2">
      {/* En el teléfono queda sólo el monograma. Con la franja institucional, el
          tema, el ingreso al panel y el cierre de sesión, el nombre completo era
          el cuarto elemento de una fila de 360px y la empujaba fuera de la
          pantalla. Va con `sr-only` y no con `hidden`: sigue estando para el
          lector de pantalla, que si no se encuentra un botón sin nombre. */}
      <span className="inline-flex items-center gap-0 border border-line bg-chrome p-1 sm:gap-2.5 sm:py-1 sm:pl-1 sm:pr-3">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center bg-ink font-sans text-[0.6rem] font-bold tracking-wider text-paper"
        >
          {iniciales}
        </span>
        <span
          className={
            soloMonograma
              ? "sr-only"
              : "sr-only font-sans text-[0.7rem] font-medium text-ink sm:not-sr-only sm:max-w-[9rem] sm:truncate"
          }
        >
          {nombre}
        </span>
      </span>
      <button
        type="button"
        onClick={cerrarSesion}
        disabled={saliendo}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        className="pressable inline-flex h-9 w-9 items-center justify-center border border-line bg-chrome text-ink-2 hover:border-ink hover:text-ink disabled:opacity-50"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
