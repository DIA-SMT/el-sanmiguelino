import type { NextRequest } from "next/server";
import { callbackCidituc } from "@/lib/auth/cidituc/flujo";

/**
 * La vuelta desde Cidituc, con `?auth=<token>`.
 *
 * Esta URL es la que está registrada en el derivador (repo `derivador`,
 * `src/components/Login/Login.jsx`, mapa `RESPALDO_CALLBACK`). Cambiarla acá sin
 * cambiarla allá rompe el ingreso de una manera que engaña: el primer intento
 * falla porque la cookie del `state` la puso otro dominio, y el segundo entra
 * bien porque para entonces la persona ya está parada en el dominio viejo.
 */
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return callbackCidituc(request);
}
