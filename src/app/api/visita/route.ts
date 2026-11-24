import { type NextRequest } from "next/server";
import { esAdmin } from "@/lib/auth/dal";
import { sumarVisita } from "@/lib/repos/visitas";
import { esRobot, rutaContable } from "@/lib/visitas";

/**
 * Suma una visita. La manda el navegador del lector al abrir cada página del
 * diario (`ContadorDeVisitas`), sin esperar respuesta.
 *
 * Por qué desde el navegador y no contando cada pedido en el servidor: el
 * servidor recibe también las precargas de enlaces, los pedidos de navegación
 * interna y a los robots. Lo que llega acá es una página que alguien abrió de
 * verdad.
 *
 * **Qué NO se cuenta:** robots (por su `User-Agent`), quienes administran el
 * panel (para que corregir una nota diez veces no sean diez lecturas), y la
 * misma página pedida otra vez desde el mismo lugar en la media hora
 * siguiente (recargar no es leer dos veces).
 *
 * **Qué NO se guarda:** la IP se usa sólo para ese freno de media hora, en la
 * memoria del servidor, y nunca llega a la base. Ver `repos/visitas.ts`.
 *
 * Es pública en el proxy (la mayoría de los lectores no tiene sesión). Lo
 * peor que alguien puede hacer es inflar el número de una página que existe;
 * por eso el panel lo presenta como visitas, no como un dato exacto.
 */

/** La misma página desde el mismo lugar, sólo una vez cada media hora. */
const VENTANA_MS = 30 * 60 * 1000;
const vistas = new Map<string, number>();

function yaContada(clave: string, ahora: number): boolean {
  const antes = vistas.get(clave);
  if (antes !== undefined && ahora - antes < VENTANA_MS) return true;
  // Que la memoria no crezca sin tope: con miles de claves, se vacía. Perder
  // el freno un instante sólo puede sumar alguna recarga de más.
  if (vistas.size > 20_000) vistas.clear();
  vistas.set(clave, ahora);
  return false;
}

export async function POST(request: NextRequest) {
  // 204 siempre: el navegador no espera nada, y a quien quiera probar qué
  // cuenta y qué no, la respuesta no le dice nada.
  const nada = new Response(null, { status: 204 });

  if (esRobot(request.headers.get("user-agent"))) return nada;

  let ruta: string | null = null;
  try {
    const cuerpo = (await request.json()) as { ruta?: unknown };
    ruta = rutaContable(cuerpo?.ruta);
  } catch {
    return nada;
  }
  if (!ruta) return nada;

  if (await esAdmin()) return nada;

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  if (yaContada(`${ip}|${ruta}`, Date.now())) return nada;

  await sumarVisita(ruta);
  return nada;
}
