import type { NextRequest } from "next/server";
import { callbackCidituc } from "@/lib/auth/cidituc/flujo";

/**
 * La vuelta desde Cidituc, con `?auth=<token>`.
 *
 * Esta URL es la que está escrita en el login de Ciudad Digital (repo
 * `cidituc`, `src/routes/PrivateRoute.jsx`, constante `CALLBACK_SANMIGUELINO`).
 * Cambiarla acá sin cambiarla allá rompe el ingreso de una manera que engaña:
 * la cookie del flujo la puso un dominio y la vuelta llega a otro, así que el
 * ingreso se rechaza como vencido.
 */
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return callbackCidituc(request);
}
