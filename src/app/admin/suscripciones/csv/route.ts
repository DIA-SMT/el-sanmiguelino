import { requerirAdmin } from "@/lib/auth/dal";
import { listarSuscripciones } from "@/lib/repos/suscripciones";

/**
 * La lista de suscripciones, para pasársela a quien reparte.
 *
 * `requerirAdmin()` acá adentro y no confiando en el layout: en el App Router
 * el layout no corre para los route handlers. Sin esto, la lista de domicilios
 * de los vecinos sería una URL que cualquiera con sesión puede pedir.
 */

/**
 * Escapa un campo para CSV.
 *
 * El apóstrofo, la coma y el salto de línea son moneda corriente en un
 * domicilio argentino —"Av. Sarmiento 1234, 2º B"—, así que esto no es
 * teórico: sin comillas, la primera dirección con coma corre todas las
 * columnas de esa fila.
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
  await requerirAdmin();
  const suscripciones = await listarSuscripciones();

  const filas = [
    ["nombre", "edad", "email", "direccion", "fecha"],
    ...suscripciones.map((s) => [
      s.nombre,
      s.edad,
      s.email,
      s.direccion,
      s.fecha,
    ]),
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
