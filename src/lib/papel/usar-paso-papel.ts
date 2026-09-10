"use client";

import { useCallback, useEffect, useRef } from "react";
import type { DireccionPagina } from "@/lib/deslizar-paginas";
import type { CapturaPapel, crearSuperficie } from "./superficie";

const DURACION = 760;
type Superficie = NonNullable<ReturnType<typeof crearSuperficie>>;
type Motor = typeof import("./captura") & typeof import("./superficie");
let motor: Promise<Motor> | undefined;
const cargarMotor = () => motor ??= Promise.all([import("./captura"), import("./superficie")])
  .then(([captura, superficie]) => ({ ...captura, ...superficie }));

function firma(hoja: HTMLElement) {
  const r = hoja.getBoundingClientRect();
  return [r.x, r.y, r.width, r.height, innerWidth, innerHeight, document.documentElement.dataset.theme].join(":");
}

/** Una única transición para enlaces, teclado y gesto. La captura se prepara
 * al quedar quieta la lectura; la navegación nunca depende de WebGL. */
export function usePasoPapel(pathname: string) {
  const enCurso = useRef(false);
  const cache = useRef<{ hoja: HTMLElement; firma: string; captura: CapturaPapel } | null>(null);
  const preparando = useRef<Promise<void> | null>(null);
  const pendiente = useRef<{
    superficie: Superficie; destino: string; hoja: HTMLElement; animando: boolean;
  } | null>(null);
  const frame = useRef(0);
  const plazo = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const montado = useRef(true);
  const revision = useRef(0);
  const invalidarRevision = useCallback(() => { revision.current += 1; }, []);

  const terminar = useCallback(() => {
    cancelAnimationFrame(frame.current);
    clearTimeout(plazo.current);
    pendiente.current?.superficie.destruir();
    pendiente.current = null;
    enCurso.current = false;
    document.documentElement.removeAttribute("data-papel-ocupado");
  }, []);

  const preparar = useCallback(() => {
    if (preparando.current || enCurso.current || document.hidden ||
      matchMedia("(prefers-reduced-motion: reduce)").matches) return preparando.current;
    const hoja = document.querySelector<HTMLElement>(".hoja");
    if (!hoja || hoja.dataset.papelCargando !== undefined) return null;
    const clave = firma(hoja);
    if (cache.current?.hoja === hoja && cache.current.firma === clave) return null;
    const version = revision.current;
    preparando.current = cargarMotor().then(async ({ capturarPapel }) => {
      await document.fonts.ready;
      const captura = await capturarPapel(hoja);
      if (montado.current && hoja.isConnected && version === revision.current && firma(hoja) === clave) {
        cache.current = { hoja, firma: clave, captura };
      }
    }).catch(() => {
      // Un recurso que no se puede rasterizar conserva la navegación normal.
      cache.current = null;
    }).finally(() => { preparando.current = null; });
    return preparando.current;
  }, []);

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; invalidarRevision(); terminar(); };
  }, [invalidarRevision, terminar]);

  useEffect(() => {
    let temporizador: ReturnType<typeof setTimeout>;
    const programar = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => { void preparar(); }, 280);
    };
    const invalidar = () => { invalidarRevision(); cache.current = null; programar(); };
    const alScroll = () => {
      if (pendiente.current?.animando) terminar();
      programar();
    };
    const alResize = () => { terminar(); invalidar(); };
    const alOcultar = () => { if (document.hidden) terminar(); else programar(); };
    const observador = new MutationObserver(invalidar);
    const escritorio = document.querySelector(".escritorio");
    if (escritorio) observador.observe(escritorio, { childList: true, subtree: true, characterData: true });
    const tema = new MutationObserver(invalidar);
    tema.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    window.addEventListener("scroll", alScroll, { passive: true });
    window.addEventListener("resize", alResize);
    document.addEventListener("visibilitychange", alOcultar);
    document.addEventListener("load", invalidar, true);
    programar();
    return () => {
      invalidarRevision();
      cache.current = null;
      clearTimeout(temporizador);
      observador.disconnect(); tema.disconnect();
      window.removeEventListener("scroll", alScroll);
      window.removeEventListener("resize", alResize);
      document.removeEventListener("visibilitychange", alOcultar);
      document.removeEventListener("load", invalidar, true);
    };
  }, [invalidarRevision, pathname, preparar, terminar]);

  useEffect(() => {
    const paso = pendiente.current;
    if (!paso) return;
    if (paso.destino !== pathname) { terminar(); return; }
    const esperarContenido = () => {
      if (pendiente.current !== paso) return;
      const nueva = document.querySelector<HTMLElement>(".hoja");
      if (!nueva || nueva === paso.hoja || nueva.dataset.papelCargando !== undefined) {
        frame.current = requestAnimationFrame(esperarContenido);
        return;
      }
      // Dejar que Next termine de colocar la nueva página y ajustar el scroll.
      frame.current = requestAnimationFrame(() => {
        const inicio = performance.now();
        paso.animando = true;
        const animar = (ahora: number) => {
          const t = Math.min(1, (ahora - inicio) / DURACION);
          const avance = t * t * (3 - 2 * t);
          paso.superficie.dibujar(avance);
          if (t < 1) frame.current = requestAnimationFrame(animar);
          else { terminar(); void preparar(); }
        };
        frame.current = requestAnimationFrame(animar);
      });
    };
    frame.current = requestAnimationFrame(esperarContenido);
  }, [pathname, terminar, preparar]);

  const pasar = useCallback(async (
    destino: string,
    direccion: DireccionPagina,
    navegar: (curvado: boolean) => void,
  ) => {
    if (enCurso.current) return;
    const tarea = preparar();
    enCurso.current = true;
    document.documentElement.dataset.papelOcupado = "true";
    if (tarea) await Promise.race([tarea, new Promise((r) => setTimeout(r, 180))]);
    if (!montado.current) return;
    const hoja = document.querySelector<HTMLElement>(".hoja");
    const lista = cache.current;
    let superficie: Superficie | null = null;
    if (hoja && lista?.hoja === hoja && lista.firma === firma(hoja) &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      try {
        const { crearSuperficie } = await cargarMotor();
        if (!montado.current) return;
        superficie = crearSuperficie(lista.captura, direccion === "adelante");
      } catch { /* Fallback de CSS, sin bloquear el enlace. */ }
    }
    cache.current = null;
    if (superficie && hoja) {
      pendiente.current = { superficie, destino, hoja, animando: false };
      // Una ruta que tarda o falla nunca deja una hoja inmóvil encima del error.
      plazo.current = setTimeout(terminar, 3000);
    } else {
      plazo.current = setTimeout(terminar, 450);
    }
    navegar(Boolean(superficie));
  }, [preparar, terminar]);

  return { pasar, enCurso };
}
