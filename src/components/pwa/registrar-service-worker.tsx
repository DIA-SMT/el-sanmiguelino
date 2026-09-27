"use client";

import { useEffect } from "react";

/**
 * Registra el service worker (`public/sw.js`). Va una sola vez, en el layout
 * raíz, y no dibuja nada.
 *
 * **Sólo en producción.** En desarrollo el worker guardaría los chunks de
 * `next dev`, que no llevan hash de contenido como los de un build: un cambio
 * en el código podía no verse hasta borrar la caché a mano. Por lo mismo, en
 * desarrollo se da de baja cualquier worker que haya quedado de haber probado
 * un `next start` en el mismo puerto. Para probar el worker con `next dev` está
 * `NEXT_PUBLIC_PWA_EN_DESARROLLO=1` (ver `.env.example`).
 *
 * La URL lleva la versión del build (`VERSION_SITIO`, de next.config.ts). Es lo
 * que hace que cada deploy instale un worker nuevo y tire las cachés del
 * anterior; el porqué está arriba de todo en `public/sw.js`.
 *
 * Se registra después del `load` y no antes: el worker descarga y guarda la
 * página de aviso, y eso no tiene que competir con la primera carga del diario
 * por la conexión del teléfono.
 */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (
      process.env.NODE_ENV !== "production" &&
      process.env.NEXT_PUBLIC_PWA_EN_DESARROLLO !== "1"
    ) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registros) => registros.forEach((r) => r.unregister()));
      return;
    }

    const registrar = () => {
      navigator.serviceWorker
        .register(`/sw.js?v=${process.env.VERSION_SITIO}`, {
          scope: "/",
          // Que el navegador no use su caché HTTP para ver si hay versión
          // nueva: si la usara, un deploy podía tardar hasta un día en llegar.
          updateViaCache: "none",
        })
        // Sin worker el diario anda igual, sólo que no abre sin señal. No hay
        // nada que avisarle al lector.
        .catch(() => {});
    };

    if (document.readyState === "complete") {
      registrar();
      return;
    }
    window.addEventListener("load", registrar, { once: true });
    return () => window.removeEventListener("load", registrar);
  }, []);

  return null;
}
