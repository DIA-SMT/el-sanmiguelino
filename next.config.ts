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
  /**
   * Desde qué orígenes se puede pedir el servidor de DESARROLLO.
   *
   * Existe para poder probar en un teléfono de verdad. Next bloquea los pedidos
   * de origen cruzado a `/_next/*` en desarrollo, así que al abrir el sitio
   * desde `http://192.168.x.x:3000` la página HTML llega pero **los chunks de
   * JavaScript vuelven 403**: la app no hidrata, y el botón de ingresar —o
   * cualquier otro— no hace nada. Se ve como si la pantalla se colgara, sin
   * ningún error visible. Pasó exactamente eso probando el paso de página en un
   * iPhone.
   *
   * `192.168.*` cubre la red local doméstica y de oficina; `10.*` la que reparte
   * una VPN o algunos routers. Son rangos privados y no enrutables desde
   * internet, así que la lista no abre nada al mundo.
   *
   * **Sólo tiene efecto en desarrollo.** En producción esto no se lee, y la
   * documentación de Next lo dice: es una protección de los recursos de
   * desarrollo (ver node_modules/next/dist/docs/.../allowedDevOrigins.md).
   */
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],

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
