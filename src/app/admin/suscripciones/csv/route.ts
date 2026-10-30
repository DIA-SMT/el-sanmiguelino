import { requerirAdmin } from "@/lib/auth/dal";
import { listarSuscripciones } from "@/lib/repos/suscripciones";
import { anotar } from "@/lib/repos/auditoria";

/**
 * La lista del newsletter, para pasársela a quien manda los correos.
 *
 * `requerirAdmin()` acá adentro y no confiando en el layout: en el App Router
 * el layout no corre para los route handlers. Sin esto, la lista de correos
 * de los vecinos sería una URL que cualquiera con sesión puede pedir.
 */

/**
 * Escapa un campo para CSV.
 *
 * El apóstrofo, la coma y el salto de línea aparecen en nombres reales, así
 * que esto no es teórico: sin comillas, el primer campo con coma corre todas
 * las columnas de esa fila.
 *
 * Y lo que empieza con `=`, `+`, `-` o `@` se antepone con un apóstrofo: Excel
 * lo interpretaría como fórmula. Una lista de vecinos no tiene por qué poder
 * ejecutar nada en la máquina de quien la abre.
 */
function campo(valor: string | number | null): string {
  const s = valor === null ? "" : String(valor);
  const seguro = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${seguro.replaceAll('"', '""')}"`;
}

export async function GET() {
  const { usuario } = await requerirAdmin();
  const suscripciones = await listarSuscripciones();

  /* La única LECTURA que se anota, y por eso mismo: acá los datos personales de
     los vecinos —nombre y correo— salen del sistema en un archivo
     que después vive en la computadora de alguien. Que eso pase sin dejar
     rastro es lo que no puede ser. Se anota cuántas filas se llevó, nunca
     cuáles. */
  await anotar(usuario, {
    accion: "suscripciones.descarga",
    resumen: `Descargó el padrón de suscripciones (${suscripciones.length} ${suscripciones.length === 1 ? "vecino" : "vecinos"})`,
    detalle: { filas: suscripciones.length },
  });

  const filas = [
    ["nombre", "email", "fecha"],
    ...suscripciones.map((s) => [s.nombre, s.email, s.fecha]),
  ];
  // BOM al principio: sin él, Excel en Windows abre el archivo en la
  // codificación del sistema y "Tucumán" llega como "TucumÃ¡n".
  const csv = "﻿" + filas.map((f) => f.map(campo).join(",")).join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="suscripciones.csv"',
      // Son datos personales: que no queden en la caché de nadie.
      "Cache-Control": "no-store",
    },
  });
}
