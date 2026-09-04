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

  /**
   * El dominio viejo de Vercel manda todo al dominio nuevo.
   *
   * El diario se mudó a `sanmiguelino.smt.gob.ar`, pero
   * `el-sanmiguelino.vercel.app` seguía sirviendo la aplicación **completa**, sin
   * redirigir. Eso rompe el ingreso de una forma que no se arregla reintentando…
   * salvo reintentando, que es lo peor: quien entra por un dominio deja la cookie
   * del `state` ahí, el derivador lo devuelve al OTRO dominio, y una cookie no
   * viaja entre dominios distintos. Resultado: "la solicitud de ingreso venció"
   * en el primer intento, y el segundo entra bien —porque para entonces la
   * persona ya está parada en el dominio al que la devolvieron—.
   *
   * Le pasó igual a UrbanIA entre el 2026-08-10 y el 2026-08-19, y el comentario
   * del repo `derivador` lo tiene escrito arriba de `RESPALDO_CALLBACK`. Ahora le
   * tocó al diario, por el mismo motivo: se agregó el dominio de `smt.gob.ar` y
   * el registro del derivador quedó apuntando al de Vercel.
   *
   * Con esto hay **un solo dominio** que sostiene cookies: el que vuelva a
   * `el-sanmiguelino.vercel.app/auth/cidituc/callback?auth=…&state=…` es
   * redirigido a `sanmiguelino.smt.gob.ar` con la query intacta —Next la
   * conserva— y ahí la cookie sí está. Arregla el ingreso incluso sin tocar el
   * derivador, que es de otro equipo.
   *
   * Se redirige en vez de dar de baja el dominio para que los enlaces que ya
   * circulan sigan funcionando **con su ruta**: quien tenía guardado
   * `/nota/septiembre-musical` llega a esa misma nota.
   *
   * `permanent: false` a propósito. Un 308 queda cacheado en el navegador de
   * forma casi irreversible, y si algún día hay que volver a usar el dominio de
   * Vercel —una prueba, un rollback— nadie podría entrar.
   *
   * El host se compara **exacto**, así que los dominios de previsualización que
   * genera Vercel para cada rama siguen funcionando solos.
   */
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host" as const, value: "el-sanmiguelino.vercel.app" }],
        destination: "https://sanmiguelino.smt.gob.ar/:path*",
        permanent: false,
      },
    ];
  },

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

  /**
   * `sharp` y `pdf.js` se cargan como paquetes de Node, no se empaquetan.
   *
   * `sharp` es un binario nativo y bundlearlo directamente no funciona.
   * `pdfjs-dist` sí se podría, pero busca sus decodificadores por ruta relativa
   * al paquete, así que sacarlo de `node_modules` le rompe esa búsqueda.
   *
   * Los dos los usa la digitalización del impreso, en el servidor
   * (`src/lib/pdf/digitalizar-servidor.ts`).
   */
  serverExternalPackages: ["sharp", "pdfjs-dist"],

  /**
   * Archivos que hay que meter en la función a la fuerza.
   *
   * Next arma el paquete de cada función siguiendo los `import`, y estos tres
   * directorios **no los importa nadie**: pdf.js los abre por ruta en tiempo de
   * ejecución. Sin declararlos acá, el trazado no los ve, no viajan al deploy,
   * y la digitalización en producción devuelve las páginas con todo su texto y
   * **sin una sola foto**, sin tirar ningún error — que es exactamente la clase
   * de falla que no se descubre hasta que alguien mira el diario.
   *
   * `wasm` son los decodificadores de JPEG 2000 y JBIG2, que es lo que usa un
   * PDF de imprenta para las fotos; los otros dos son las tipografías estándar
   * del formato y las tablas de codificación.
   */
  outputFileTracingIncludes: {
    "/admin/**": [
      "./node_modules/pdfjs-dist/wasm/**",
      "./node_modules/pdfjs-dist/standard_fonts/**",
      "./node_modules/pdfjs-dist/cmaps/**",
    ],
  },
};

export default nextConfig;
