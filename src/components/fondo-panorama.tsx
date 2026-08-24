import Image from "next/image";
import { imagenDisponible } from "@/lib/data/imagenes";

/** Panorámica aérea del centro de San Miguel de Tucumán. Ver la procedencia y
 *  la licencia en `public/portada/README.md`. */
const PANORAMA = "/portada/panoramica-tucuman.jpg";

/**
 * El fondo del sitio: la ciudad, siempre. Va una sola vez en el layout raíz,
 * fija al viewport y detrás de todo, así el papel se desplaza y el escritorio
 * se queda quieto.
 *
 * Fija y no dentro de cada sección por dos razones: se descarga una sola vez
 * para todo el sitio, y al no scrollear no hay que recortarla contra bloques
 * altísimos —que era lo que obligaba a ampliarla y la ensuciaba—.
 *
 * Nada de trama de semitono acá. La probé y sobre una foto velada los puntos
 * no se leen como impresión sino como una imagen dañada: es lo que hacía que
 * el fondo pareciera un GIF viejo. La textura la pone `.grano`, que es ruido
 * fino y no una grilla regular.
 *
 * El velo es lo único que separa la foto del contenido, y quien apoya texto
 * directamente encima (el hero de la landing) suma el suyo.
 *
 * Server Component: si el archivo no está en /public no renderiza nada y el
 * sitio se queda con el color de escritorio.
 */
export function FondoPanorama() {
  if (!imagenDisponible(PANORAMA)) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden"
    >
      <Image
        src={PANORAMA}
        alt=""
        fill
        preload
        /* Cubre el viewport, no una página entera: con el ancho de pantalla
           alcanza, porque el alto nunca pide más origen del que tiene el
           archivo. */
        sizes="100vw"
        className="object-cover object-[50%_42%] saturate-[0.72] contrast-[0.96]"
      />

      {/* Velo del tema: pasa la foto al tono de la edición y la manda al fondo,
          sin borrarla. */}
      <div
        className="absolute inset-0"
        style={{ background: "var(--velo-panorama)" }}
      />
    </div>
  );
}
