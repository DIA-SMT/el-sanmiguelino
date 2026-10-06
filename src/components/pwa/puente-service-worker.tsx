"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { avisarRutaMostrada } from "@/lib/pwa";

/** Si el worker corre en este entorno. Sólo en producción: en desarrollo
 *  guardaría los chunks de `next dev`, que no llevan hash de contenido como
 *  los de un build, y un cambio en el código podía no verse hasta borrar la
 *  caché a mano. Para probarlo con `next dev` está
 *  `NEXT_PUBLIC_PWA_EN_DESARROLLO=1` (ver `.env.example`). */
const WORKER_ACTIVO =
  process.env.NODE_ENV === "production" ||
  process.env.NEXT_PUBLIC_PWA_EN_DESARROLLO === "1";

/**
 * El lado de la página del service worker (`public/sw.js`). Va una sola vez, en
 * el layout raíz, y no dibuja nada. Hace dos cosas:
 *
 * 1. **Registra el worker**, después del `load`: el worker descarga y guarda la
 *    página de aviso, y eso no tiene que competir con la primera carga del
 *    diario por la conexión del teléfono. La URL lleva la versión del build
 *    (`VERSION_SITIO`, de next.config.ts), que es lo que hace que cada deploy
 *    instale un worker nuevo y tire las cachés del anterior.
 * 2. **Le avisa qué ruta está en pantalla**, en cada cambio de ruta y cada vez
 *    que un worker nuevo toma el control. La navegación interna de Next son
 *    pedidos RSC: le llegan al worker, pero él los deja ir a la red sin
 *    tocarlos, a propósito (el protocolo es interno de Next; ver
 *    `public/sw.js`). Sin este aviso sólo se guardaba la página por la que se
 *    entraba a la aplicación.
 *
 * En desarrollo, sin la variable, da de baja cualquier worker que haya quedado
 * de haber probado un `next start` en el mismo puerto.
 */
export function PuenteServiceWorker() {
  const ruta = usePathname();
  const router = useRouter();

  /*
   * Al volver la señal, la página se vuelve a armar. Lo que se guarda para
   * leer sin conexión es la versión SIN SESIÓN de cada página (ver
   * `public/sw.js`): quien ingresó y abrió la aplicación sin señal la ve sin su
   * nombre, y al reconectarse seguía viendo "Ingresar" —y a Migue pidiéndole
   * que ingrese— hasta recargar, porque el layout no se vuelve a pedir en una
   * navegación interna. `router.refresh()` rearma todo con la cookie. `online`
   * sólo dispara después de haber estado sin red: es un pedido por reconexión.
   */
  useEffect(() => {
    const alVolverLaSenal = () => router.refresh();
    window.addEventListener("online", alVolverLaSenal);
    return () => window.removeEventListener("online", alVolverLaSenal);
  }, [router]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (!WORKER_ACTIVO) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registros) => registros.forEach((r) => r.unregister()));
      return;
    }

    // Un worker que toma el control —el de la primera instalación, o el de un
    // deploy nuevo— arranca con las cachés vacías, así que la página que ya
    // estaba en pantalla no está guardada en ninguna. Se le vuelve a avisar.
    const alTomarControl = () => void avisarRutaMostrada(location.pathname);
    navigator.serviceWorker.addEventListener("controllerchange", alTomarControl);

    const registrar = () => {
      navigator.serviceWorker
        .register(`/sw.js?v=${process.env.VERSION_SITIO}`, { scope: "/" })
        // Sin worker el diario anda igual, sólo que no abre sin señal. No hay
        // nada que avisarle al lector.
        .catch(() => {});
    };
    if (document.readyState === "complete") registrar();
    else window.addEventListener("load", registrar, { once: true });

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        alTomarControl,
      );
      window.removeEventListener("load", registrar);
    };
  }, []);

  useEffect(() => {
    if (WORKER_ACTIVO && "serviceWorker" in navigator) {
      void avisarRutaMostrada(ruta);
    }
  }, [ruta]);

  return null;
}
