"use server";

import { redirect } from "next/navigation";
import { confirmar, darDeBajaConEnlace } from "@/lib/repos/suscripciones";

/**
 * Lo que hacen los botones de las páginas a las que llevan los correos.
 *
 * No piden sesión: la llave es el enlace firmado (`newsletter/enlaces.ts`).
 * Quien tiene el correo tiene el enlace, y eso es lo que tiene que alcanzar
 * para darse de baja sin ingresar a ningún lado.
 *
 * Después de actuar se vuelve a la misma página, que ahora lee el estado nuevo
 * y dice cómo quedó. Así el resultado no depende de JavaScript.
 */

function token(datos: FormData): string {
  const t = datos.get("t");
  return typeof t === "string" ? t.slice(0, 200) : "";
}

export async function confirmarAction(datos: FormData): Promise<void> {
  const t = token(datos);
  await confirmar(t);
  redirect(`/newsletter/confirmar?t=${encodeURIComponent(t)}`);
}

export async function darDeBajaAction(datos: FormData): Promise<void> {
  const t = token(datos);
  await darDeBajaConEnlace(t, "enlace");
  redirect(`/newsletter/baja?t=${encodeURIComponent(t)}`);
}
