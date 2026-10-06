import type { MetadataRoute } from "next";

/**
 * El diario instalado como aplicación. Next lo sirve en `/manifest.webmanifest`
 * y pone el `<link rel="manifest">` solo.
 *
 * Ojo con el proxy: Chrome y Safari piden el manifest **sin cookies** salvo que
 * el `<link>` lleve `crossorigin="use-credentials"`. Es cosa de los motores y
 * no de la especificación de HTML, que diría `same-origin`, pero es lo que
 * pasa. En producción, entonces, llega al gate de Cidituc sin sesión: si el
 * proxy lo agarrara, lo mandaría a /login y el sitio dejaría de ser instalable
 * sin ningún error visible. Por eso está exento en el `matcher` de
 * `src/proxy.ts`, igual que `/sw.js`.
 *
 * Un deploy de preview de Vercel NO sirve para comprobar si la excepción hace
 * falta: ahí Next le agrega `use-credentials` al `<link>` por su cuenta
 * (`node_modules/next/dist/lib/metadata/metadata.js`, `VERCEL_ENV`), la cookie
 * viaja y el manifest pasa aunque no esté exento.
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
      "El diario digital mensual de la Municipalidad de San Miguel de Tucumán: las obras, la cultura y las historias de la ciudad, para leer como un diario de papel.",
    lang: "es-AR",
    dir: "ltr",
    /* Arranca en el diario y no en la presentación: quien instala la
       aplicación ya es lector. Leer es libre, así que abre directo, con o sin
       sesión. */
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
