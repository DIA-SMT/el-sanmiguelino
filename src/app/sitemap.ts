import type { MetadataRoute } from "next";
import { SITIO_URL } from "@/lib/compartir";
import { getIndiceDe, getPublicadas } from "@/lib/repos/edicion";

/**
 * El mapa del sitio para los buscadores: la presentación, la tapa, el archivo,
 * y cada edición PUBLICADA con sus notas.
 *
 * Sale de `getPublicadas()`, que no depende de quién pide: ni de la sesión ni
 * de la vista previa de un administrador. Nunca armarlo con la edición en foco
 * ni con las funciones del editor, o un buscador se llevaría los títulos de
 * una edición que todavía no salió.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (ruta: string) => new URL(ruta, SITIO_URL).toString();
  const ediciones = await getPublicadas();
  const indices = await Promise.all(ediciones.map((e) => getIndiceDe(e.slug)));

  return [
    { url: url("/"), changeFrequency: "monthly", priority: 0.6 },
    { url: url("/diario"), changeFrequency: "weekly", priority: 1 },
    { url: url("/archivo"), changeFrequency: "monthly", priority: 0.5 },
    ...ediciones.map((e) => ({
      url: url(`/edicion/${e.slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...indices.flat().map((n) => ({
      url: url(`/nota/${n.slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
