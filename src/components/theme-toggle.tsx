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
    const raiz = document.documentElement;

    // El cambio de tema va sin transiciones (ver globals.css): se apagan, se
    // fuerza el recálculo con el tema nuevo ya puesto, y se vuelven a
    // encender en el cuadro siguiente. Sin esto, todo lo que tenga transición
    // de color queda pintado con el tema anterior.
    raiz.setAttribute("data-cambiando-tema", "");
    raiz.dataset.theme = proximo;
    void raiz.offsetHeight;
    requestAnimationFrame(() => {
      raiz.removeAttribute("data-cambiando-tema");
    });

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
      title={esOscuro ? "Edición de día" : "Edición nocturna"}
      className="pressable relative inline-flex h-9 w-9 items-center justify-center overflow-hidden border border-line bg-chrome text-ink-2 hover:border-ink hover:text-ink"
    >
      {/* Los dos iconos conviven y se cruzan: el cambio de tema se ve. */}
      <Sun
        aria-hidden="true"
        className={`absolute h-4 w-4 transition-all duration-300 ${
          tema === null
            ? "opacity-0"
            : esOscuro
              ? "rotate-0 opacity-100"
              : "-rotate-90 opacity-0"
        }`}
      />
      <Moon
        aria-hidden="true"
        className={`absolute h-4 w-4 transition-all duration-300 ${
          tema === null
            ? "opacity-0"
            : esOscuro
              ? "rotate-90 opacity-0"
              : "rotate-0 opacity-100"
        }`}
      />
    </button>
  );
}
