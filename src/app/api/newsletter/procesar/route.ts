import { createHash, timingSafeEqual } from "node:crypto";
import { type NextRequest } from "next/server";
import { procesarCola } from "@/lib/newsletter/envios";

/**
 * Una vuelta de la cola del newsletter. La llama Supabase (pg_cron + pg_net)
 * cada minuto; nadie la abre desde un navegador.
 *
 * Por qué Supabase y no el cron de Vercel: en el plan Hobby, Vercel corre un
 * cron por día, y un newsletter programado para las 10:00 no puede salir a la
 * medianoche. La instalación del cron está en `docs/informe-tecnico.md`.
 *
 * **La llave es `NEWSLETTER_CRON_SECRET`**, en la cabecera
 * `Authorization: Bearer …`. Sin esa variable cargada la ruta no hace nada
 * (503): una cola que cualquiera puede disparar es una manera de gastar el
 * tope diario de correos del municipio. Es pública en el proxy (no hay sesión
 * de nadie: la pide la base) y la comparación es de tiempo constante.
 */

// Vercel Hobby corta a los 10 s; la cola deja de empezar correos a los 6,5.
export const maxDuration = 10;

function autorizada(request: NextRequest): boolean | null {
  const secreto = process.env.NEWSLETTER_CRON_SECRET;
  if (!secreto || secreto.length < 32) return null;
  const dada = request.headers.get("authorization") ?? "";
  // Se comparan los hash: así los dos lados miden lo mismo y
  // `timingSafeEqual` no tira por largo distinto.
  const a = createHash("sha256").update(dada).digest();
  const b = createHash("sha256").update(`Bearer ${secreto}`).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const ok = autorizada(request);
  if (ok === null) {
    return Response.json({ error: "La cola no está habilitada." }, { status: 503 });
  }
  if (!ok) return Response.json({ error: "No autorizado." }, { status: 401 });

  try {
    const vuelta = await procesarCola();
    // Sólo cuentas: ni correos ni nombres viajan de vuelta a la base.
    return Response.json(vuelta);
  } catch (error) {
    console.error(
      "[newsletter] la vuelta de la cola falló:",
      error instanceof Error ? error.message : error,
    );
    return Response.json({ error: "La vuelta falló." }, { status: 500 });
  }
}
