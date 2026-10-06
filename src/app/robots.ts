import type { MetadataRoute } from "next";
import { SITIO_URL } from "@/lib/compartir";

/**
 * Qué puede recorrer un buscador. Desde que leer es libre, las notas, las
 * ediciones y el archivo se indexan; lo demás no:
 *
 * - el panel, la API y el ingreso no son contenido;
 * - `/buscar` arma una página por cada `?q=`, infinitas, y cada una consulta
 *   la base;
 * - `/interactivo` es la pieza que va adentro de una nota, no una página;
 * - `/sin-conexion` es el aviso de la aplicación instalada.
 *
 * En las direcciones de prueba de Vercel no hace falta nada: Vercel ya les
 * pone `noindex`.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/auth/",
        "/login",
        "/buscar",
        "/interactivo",
        "/sin-conexion",
      ],
    },
    sitemap: new URL("/sitemap.xml", SITIO_URL).toString(),
  };
}
