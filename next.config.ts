import type { NextConfig } from "next";

/** El host del proyecto de Supabase, sacado de SUPABASE_URL. Se lee acá porque
 *  next.config se evalúa al compilar y el valor tiene que estar en el bundle. */
const hostSupabase = (() => {
  const url = process.env.SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  images: {
    /* Lista blanca obligatoria desde Next 16: sin esto, cualquier `quality`
     * distinto del default es un 400. `localPatterns` NO se define: definirlo
     * bloquea con 400 todo lo que no esté listado. */
    qualities: [75],

    /**
     * De dónde se aceptan imágenes remotas.
     *
     * El patrón está acotado al **bucket**, no al host: sin el `pathname`,
     * cualquier archivo de cualquier bucket del proyecto —incluidos los
     * privados que algún día existan— pasaría por el optimizador de Next, que
     * es un proxy público. Un comodín acá convierte al sitio en un servidor de
     * imágenes ajeno.
     *
     * El host sale de `SUPABASE_URL`. Si falta, no se declara ningún patrón:
     * en desarrollo sin Storage las fotos se sirven desde /public y no hay
     * nada remoto que permitir.
     */
    remotePatterns: hostSupabase
      ? [
          {
            protocol: "https" as const,
            hostname: hostSupabase,
            pathname: "/storage/v1/object/public/diario/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
