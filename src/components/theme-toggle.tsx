"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

type Tema = "light" | "dark" | null;

/** El tema vive en el atributo data-theme de <html> (lo fija el script
 *  anti-flash del layout); acá solo lo observamos y lo alternamos. */
function suscribir(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function leerTema(): Tema {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function ThemeToggle() {
  // En el server no hay tema: se renderiza un placeholder hasta hidratar.
  const tema = useSyncExternalStore<Tema>(suscribir, leerTema, () => null);

  function alternar() {
    const proximo = tema === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = proximo;
    try {
      localStorage.setItem("sm-theme", proximo);
    } catch {
      /* modo incógnito */
    }
  }

  const esOscuro = tema === "dark";

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={esOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-pressed={esOscuro}
      className="pressable inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-chrome text-ink-2 transition-colors hover:text-ink"
    >
      {tema === null ? (
        <span className="h-4 w-4" aria-hidden="true" />
      ) : esOscuro ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
