import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * `twMerge` **no conoce las escalas propias del panel, y sin decírselo las
 * borra en silencio.**
 *
 * `tailwind-merge` decide a qué grupo pertenece una clase por su forma. Con
 * `text-sm` acierta —`sm` es un talle que conoce— pero `text-panel-sm` no le
 * suena a nada, así que lo mete en el mismo cajón que `text-panel-tinta`: el de
 * los colores. Y como en un cajón sólo sobrevive el último, `cn("text-panel-sm",
 * "text-panel-tinta")` devuelve **sólo el color**. Medido sobre este repo:
 * `clasesDeCampo()` y el chip venían renderizando con el tamaño heredado del
 * layout en vez del suyo, sin que nada fallara.
 *
 * Es la peor clase de defecto de estilo: no rompe, no avisa, y el diff se ve
 * perfecto. Por eso las escalas se declaran acá y no se resuelve caso por caso.
 *
 * Los radios tenían el problema espejo: `rounded-panel-2` y `rounded-panel-3`
 * no colisionaban con nada, así que sobrevivían LOS DOS y ganaba el que el
 * navegador leyera último.
 *
 * Las clases del diario no se tocan: esto sólo agrega nombres que antes no
 * estaban en ningún grupo.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "text-panel-xs",
        "text-panel-sm",
        "text-panel-base",
        "text-panel-lg",
        "text-panel-xl",
      ],
      rounded: ["rounded-panel", "rounded-panel-2", "rounded-panel-3"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "hace 3 h", "hace 2 días" — para la columna del lector */
export function tiempoRelativo(fechaIso: string, ahora = new Date()): string {
  const fecha = new Date(fechaIso);
  const seg = Math.max(0, Math.floor((ahora.getTime() - fecha.getTime()) / 1000));
  if (seg < 60) return "recién";
  const min = Math.floor(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 30) return dias === 1 ? "hace 1 día" : `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "hace 1 mes" : `hace ${meses} meses`;
}

