import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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

