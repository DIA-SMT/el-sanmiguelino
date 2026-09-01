import type { NextRequest } from "next/server";
import { inicioCidituc } from "@/lib/auth/cidituc/flujo";

/**
 * Arranque del ingreso. Es un GET porque lo abre una navegación normal desde el
 * botón: no hay formulario, no hay credenciales nuestras, y lo único que hace es
 * dejar una cookie de diez minutos y redirigir al derivador municipal.
 *
 * La ruta vive en `/auth/cidituc/*` y no bajo `/api` para que el registro en el
 * derivador tenga la misma forma que el de las otras apps del municipio. Ese
 * mapa se edita a mano en otro repositorio: cuanto menos se parezca nuestra
 * entrada a sus vecinas, más fácil es que alguien la copie mal.
 */
export async function GET(request: NextRequest) {
  return inicioCidituc(request);
}
