import type { MetadataRoute } from "next";

/**
 * El diario instalado como aplicación. Next lo sirve en `/manifest.webmanifest`
 * y pone el `<link rel="manifest">` solo.
 *
 * Ojo con el proxy: el navegador pide el manifest **sin cookies** (así lo dice
 * la especificación, salvo `crossorigin="use-credentials"`), así que para el
 * gate de Cidituc llega siempre sin sesión. Si el proxy lo agarrara, lo mandaría
 * a /login y el sitio dejaría de ser instalable sin ningún error visible. Por
 * eso está exento en el `matcher` de `src/proxy.ts`, igual que `/sw.js`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    /* La identidad de la aplicación instalada. Sin `id`, el navegador usa
       `start_url`, y cambiar la página de arranque algún día haría que cada
       teléfono viera una aplicación distinta a la que ya tiene instalada. */
    id: "/",
    name: "El Sanmiguelino",
    short_name: "Sanmiguelino",
    description:
      "El diario digital mensual de la Municipalidad de San Miguel de Tucumán. Exclusivo para usuarios de Cidituc.",
    lang: "es-AR",
    dir: "ltr",
    /* Arranca en el diario y no en la landing: quien instala la aplicación ya
       es lector. Sin sesión, el proxy lo manda a /login, y de ahí vuelve al
       diario. */
    start_url: "/diario",
    scope: "/",
    display: "standalone",
    /* El manifest no admite un color por tema, así que va el del escritorio en
       claro, que es lo que se ve en la pantalla de carga. Una vez cargada la
       página manda el `themeColor` del layout, que sí distingue claro y
       oscuro. */
    background_color: "#ece7db",
    theme_color: "#ece7db",
    categories: ["news"],
    /* Los genera `npm run marca:iconos` desde el isotipo municipal. El porqué
       de cada uno está en `scripts/generar-iconos.mjs`. */
    icons: [
      {
        src: "/iconos/icono-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/iconos/icono-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/iconos/icono-mascara-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
