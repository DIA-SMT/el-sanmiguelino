"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PaginaEdicion } from "@/lib/data/paginas";
import {
  useDeslizarPaginas,
  type DireccionPagina,
} from "@/lib/deslizar-paginas";

/**
 * Mando de paso de página: las flechas al costado de la hoja, las flechas del
 * teclado y el gesto del dedo.
 *
 * Vive en el layout del escritorio y no en la página, por dos razones. Una es
 * conceptual: el mando es del escritorio, no del papel —por eso las flechas
 * quedan quietas mientras la hoja gira—. La otra es práctica: al pasar de
 * página el segmento se suspende y muestra su `loading.tsx`, lo que desmonta
 * todo lo que viva adentro. Con el mando en la página, las flechas
 * desaparecían y el teclado dejaba de responder justo durante la carga.
 */
/**
 * Deja escrito dónde cae el centro de la pantalla dentro de la hoja, en
 * coordenadas de la propia hoja. Ese punto es el eje del giro.
 *
 * Hace falta porque la captura de la view transition es la hoja ENTERA —en una
 * nota, más de tres pantallas de alto— y `perspective()` clava el punto de
 * fuga en el `transform-origin`. Con `center`, el punto de fuga quedaba más de
 * mil píxeles abajo de lo que el lector está mirando y el giro se leía como un
 * plano que se corre. Además cambiaba según el scroll, por eso el giro se
 * sentía distinto cada vez.
 */
function anclarEje(cual: "vieja" | "nueva") {
  const hoja = document.querySelector<HTMLElement>(".hoja");
  if (!hoja) return;
  const y = Math.round(
    window.innerHeight / 2 - hoja.getBoundingClientRect().top,
  );
  document.documentElement.style.setProperty(`--eje-hoja-${cual}`, `${y}px`);
}

export function MandoPaginas({ paginas }: { paginas: PaginaEdicion[] }) {
  const pathname = usePathname();
  const router = useRouter();

  // Mantener apretada la flecha (o encadenar gestos) dejaba giros a medio hacer
  const enCurso = useRef(false);
  const pistaAtras = useRef<HTMLDivElement>(null);
  const pistaAdelante = useRef<HTMLDivElement>(null);

  const indice = paginas.findIndex((p) => p.href === pathname);
  // Fuera de las páginas numeradas (el listado de una sección) no hay mando.
  const enPagina = indice >= 0;
  const anterior = enPagina ? paginas[indice - 1] ?? null : null;
  const siguiente = enPagina ? paginas[indice + 1] ?? null : null;

  const hayDestino = useCallback(
    (direccion: DireccionPagina) =>
      Boolean(direccion === "adelante" ? siguiente : anterior),
    [anterior, siguiente],
  );

  /** Único camino para pasar de página: lo comparten el teclado y el gesto, y
   *  con él la guardia contra giros encadenados. */
  const pasar = useCallback(
    (direccion: DireccionPagina) => {
      const destino = direccion === "adelante" ? siguiente : anterior;
      if (!destino || enCurso.current) return;
      anclarEje("vieja");
      enCurso.current = true;
      // Tiene que cubrir el giro completo de la hoja (1150ms en globals.css) o
      // se encadenan vueltas a medio hacer.
      window.setTimeout(() => {
        enCurso.current = false;
      }, 1180);
      router.push(destino.href, {
        transitionTypes: [
          direccion === "adelante" ? "pagina-adelante" : "pagina-atras",
        ],
      });
    },
    [anterior, siguiente, router],
  );

  useDeslizarPaginas({ hayDestino, alPasar: pasar, pistaAtras, pistaAdelante });

  // Traer las hojas vecinas antes de que las pidan. Sin esto, avanzar a una
  // página nunca visitada la suspende en su `loading.tsx`, la transición
  // captura el esqueleto en vez de la nota y el giro se ve como un parpadeo.
  // Volver ya andaba bien justamente porque la anterior estaba en caché.
  useEffect(() => {
    if (anterior) router.prefetch(anterior.href);
    if (siguiente) router.prefetch(siguiente.href);
  }, [anterior, siguiente, router]);

  // El eje de la cara que ENTRA: la hoja nueva siempre aterriza arriba de todo,
  // así que se calcula al cambiar de ruta. Corre durante la transición, pero
  // esa cara está en opacity 0 hasta la mitad del giro: no se ve el cambio.
  useEffect(() => {
    anclarEje("nueva");
  }, [pathname]);

  // El eje de la cara que SALE. `pasar()` cubre el teclado y el gesto, pero las
  // flechas y los botones del pasador son <Link> y no pasan por ahí: se ancla
  // en captura, antes de que el enlace navegue.
  //
  // **La guardia `enCurso` no sobra: sin ella el punto de fuga teleporta a
  // mitad del giro.** Este listener está en `document`, en captura, sin filtrar
  // el objetivo, y `::view-transition` tiene `pointer-events: none` justamente
  // para que los toques lleguen al DOM vivo — así que cualquier dedo apoyado en
  // cualquier parte de la pantalla, durante los 1150ms que dura la animación,
  // reescribía `--eje-hoja-vieja`. Y `transform-origin` no es una propiedad
  // animada: se re-resuelve en el siguiente recálculo y el eje del giro SALTA.
  //
  // En una computadora nadie toca la pantalla mientras algo se anima. En un
  // teléfono apoyar el pulgar dos veces en poco más de un segundo es,
  // simplemente, leer. De ahí que el mismo gesto diera un giro distinto cada
  // vez.
  useEffect(() => {
    const alApoyar = () => {
      if (enCurso.current) return;
      anclarEje("vieja");
    };
    document.addEventListener("pointerdown", alApoyar, true);
    return () => document.removeEventListener("pointerdown", alApoyar, true);
  }, []);

  useEffect(() => {
    function alPresionar(e: KeyboardEvent) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // No robar las flechas mientras se escribe o dentro de un diálogo
      const activo = document.activeElement as HTMLElement | null;
      if (
        activo &&
        (activo.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(activo.tagName) ||
          activo.closest("[role='dialog']"))
      ) {
        return;
      }

      const direccion: DireccionPagina =
        e.key === "ArrowRight" ? "adelante" : "atras";
      if (!hayDestino(direccion)) return;
      e.preventDefault();
      pasar(direccion);
    }

    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [hayDestino, pasar]);

  if (!enPagina) return null;

  const claseFlecha =
    "pressable pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-line bg-chrome/90 text-ink shadow-flotante backdrop-blur-sm hover:border-ink hover:bg-chrome sm:h-13 sm:w-13";

  return (
    <>
      {/* Canto de la hoja: se ilumina a medida que el dedo arrastra. La
          opacidad la escribe el gesto directo en el DOM. Es el aviso de que al
          soltar se va a pasar de página. */}
      <div
        ref={pistaAtras}
        aria-hidden="true"
        style={{ opacity: 0 }}
        className="pointer-events-none fixed inset-y-0 left-0 z-20 w-24 bg-gradient-to-r from-ink/25 to-transparent transition-opacity duration-100"
      />
      <div
        ref={pistaAdelante}
        aria-hidden="true"
        style={{ opacity: 0 }}
        className="pointer-events-none fixed inset-y-0 right-0 z-20 w-24 bg-gradient-to-l from-ink/25 to-transparent transition-opacity duration-100"
      />

      {/* Flechas al costado de la hoja, siempre a mano */}
      <div
        style={{ viewTransitionName: "flechas-pagina" }}
        className="pointer-events-none fixed inset-x-1 top-1/2 z-30 flex -translate-y-1/2 justify-between sm:inset-x-3"
      >
        {anterior ? (
          <Link
            href={anterior.href}
            transitionTypes={["pagina-atras"]}
            prefetch
            rel="prev"
            aria-label={`Página anterior: ${anterior.titulo}`}
            className={claseFlecha}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
        ) : (
          <span />
        )}
        {siguiente ? (
          <Link
            href={siguiente.href}
            transitionTypes={["pagina-adelante"]}
            prefetch
            rel="next"
            aria-label={`Página siguiente: ${siguiente.titulo}`}
            className={claseFlecha}
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        ) : (
          <span />
        )}
      </div>
    </>
  );
}
