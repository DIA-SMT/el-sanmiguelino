import { cache } from "react";
import { cookies } from "next/headers";
import { esAdmin } from "@/lib/auth/dal";

/**
 * Qué edición está mirando esta persona.
 *
 * Por defecto, la que está publicada. Un administrador puede poner otra "en
 * foco" —una de septiembre todavía sin salir, por ejemplo— y a partir de ahí el
 * **diario entero** se la muestra: la tapa, las notas, el buscador, Migue. No
 * es una pantalla de vista previa aparte, es el diario de verdad mostrando otra
 * edición.
 *
 * Esa diferencia es el punto. Una vista previa que se dibuja con su propio
 * código te muestra que todo está bien y el día que sale aparece el problema
 * igual, porque lo que probaste no era lo que el lector iba a ver. Acá lo que
 * se ve es exactamente lo mismo, con otros datos.
 *
 * **La cookie sola no alcanza.** Se verifica que quien pide sea administrador
 * en cada request: si no, cualquiera que se ponga la cookie a mano leería la
 * edición del mes que viene antes de tiempo.
 */

export const COOKIE_EDICION = "sm_edicion";

export const edicionEnFoco = cache(async (): Promise<string | null> => {
  const jar = await cookies();
  const slug = jar.get(COOKIE_EDICION)?.value?.trim();
  if (!slug) return null;
  // El chequeo va DESPUÉS de mirar la cookie a propósito: sin cookie no hay
  // nada que decidir y no vale la pena resolver la sesión en cada request de
  // cada lector.
  if (!(await esAdmin())) return null;
  return slug;
});
