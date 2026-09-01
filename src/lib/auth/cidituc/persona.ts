import "server-only";

import { CIDITUC_API, CIDITUC_CONFIGURADO } from "@/lib/auth/config";
import { getDeCidituc, motivoDeFallo } from "@/lib/auth/cidituc/transporte";
import type { MotivoRechazo } from "@/lib/auth/cidituc/errores";

/**
 * Validación del token de Cidituc y lectura de la persona.
 *
 * La consulta a `/usuarios/authStatus` **es** la validación: el backend verifica
 * la firma. No pedimos la clave de firma y no conviene tenerla —es HS256, así
 * que quien la tiene puede fabricar tokens válidos para cualquier `id_persona`
 * de cualquier app del municipio—.
 */

/** Una persona tal como la conoce Cidituc, ya normalizada. */
export interface PersonaCidituc {
  /** `id_persona`. Es el identificador estable entre apps del municipio. */
  id: string;
  /** CUIL, 11 dígitos. */
  cuil: string;
  /** DNI derivado del CUIL. */
  dni: string;
  nombre: string;
  apellido: string;
  email: string | null;
}

export type Validacion =
  | { ok: true; persona: PersonaCidituc }
  | { ok: false; motivo: MotivoRechazo };

const TIMEOUT_MS = 10_000;

/**
 * El backend hace `SELECT p.*` sobre MySQL: un campo con columna numérica llega
 * como **número** y una columna vacía llega como **null**. Exigir `string`
 * descartaba personas válidas en silencio — el parseo entero fallaba y quien
 * ingresaba veía "Cidituc no está disponible" con el backend andando perfecto.
 */
function texto(valor: unknown): string | null {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? String(valor) : null;
  }
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  return limpio === "" ? null : limpio;
}

/**
 * `validado` y `habilita` pueden venir como booleano, número o texto. Devuelve
 * `null` cuando el campo directamente no vino, que no es lo mismo que venir en
 * cero: sólo la baja explícita rechaza.
 */
function bandera(valor: unknown): boolean | null {
  if (valor == null) return null;
  if (typeof valor === "boolean") return valor;
  if (typeof valor === "number") return valor > 0;
  if (typeof valor !== "string") return null;

  const normal = valor.trim().toLowerCase();
  if (normal === "") return null;
  if (normal === "true") return true;
  if (normal === "false") return false;
  const numero = Number(normal);
  return Number.isFinite(numero) ? numero > 0 : null;
}

function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

/** El CUIL es 2 dígitos de prefijo + DNI + 1 verificador. */
function dniDeCuil(cuil: string): string {
  return cuil.length === 11 ? cuil.slice(2, -1) : cuil;
}

/**
 * Cada endpoint envuelve a la persona con una clave distinta:
 * `/usuarios/authStatus` (ciudadanos, el que usamos) devuelve
 * `{ usuarioSinContraseña: {...} }` y `/usuarios/authStatusIA` (empleados
 * municipales, que le da 401 a cualquier vecino) devuelve `{ user: {...} }`. Se
 * aceptan las dos y también la forma plana, por si el backend cambia.
 */
function desenvolver(cuerpo: unknown): Record<string, unknown> | null {
  if (!cuerpo || typeof cuerpo !== "object") return null;
  const contenedor = cuerpo as Record<string, unknown>;
  const adentro =
    contenedor["usuarioSinContraseña"] ?? contenedor["user"] ?? contenedor;
  return adentro && typeof adentro === "object"
    ? (adentro as Record<string, unknown>)
    : null;
}

/** Un token de Cidituc es un JWT: largo, y sin espacios. */
function formaPlausible(token: string): boolean {
  return token.length >= 20 && token.length <= 4096 && !/\s/.test(token);
}

function host(): string {
  try {
    return new URL(CIDITUC_API).host;
  } catch {
    return CIDITUC_API || "(sin CIDITUC_API_URL)";
  }
}

/**
 * Valida el token contra el backend municipal y devuelve la persona.
 *
 * El token **nunca** se loguea. Los errores se registran con el host y el
 * status, que es lo que distingue "la URL apunta a otro lado" de "el backend
 * está caído" de "el certificado no valida". Un "no disponible" mudo no se
 * diagnostica.
 */
export async function validarToken(tokenCrudo: string): Promise<Validacion> {
  if (!CIDITUC_CONFIGURADO) return { ok: false, motivo: "sin-configurar" };

  const token = tokenCrudo.trim();
  if (!formaPlausible(token)) return { ok: false, motivo: "token-invalido" };

  let respuesta;
  try {
    respuesta = await getDeCidituc(
      `${CIDITUC_API}/usuarios/authStatus`,
      token,
      TIMEOUT_MS,
    );
  } catch (error) {
    // Acá caen los fallos de red: DNS, timeout, TLS, o un firewall que no deja
    // salir hacia ese host desde donde corre la app.
    console.error(
      `No se pudo conectar con Cidituc en ${host()}: ${motivoDeFallo(error)}`,
    );
    return { ok: false, motivo: "no-disponible" };
  }

  if (respuesta.status === 401 || respuesta.status === 403) {
    return { ok: false, motivo: "token-invalido" };
  }
  if (respuesta.status < 200 || respuesta.status >= 300) {
    console.error(
      `Cidituc respondió ${respuesta.status} en ${host()}/usuarios/authStatus. ` +
        "Si es 404, CIDITUC_API_URL apunta a un host que no sirve ese endpoint.",
    );
    return { ok: false, motivo: "no-disponible" };
  }

  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(respuesta.body);
  } catch {
    console.error("Cidituc respondió 2xx con algo que no es JSON.");
    return { ok: false, motivo: "no-disponible" };
  }

  const datos = desenvolver(cuerpo);
  if (!datos) {
    console.error("Cidituc respondió un JSON sin la persona adentro.");
    return { ok: false, motivo: "no-disponible" };
  }

  const id = texto(datos["id_persona"]);
  const documento = texto(datos["documento_persona"]);
  if (!id || !documento) {
    // Sólo los nombres de los campos que faltaron: el cuerpo trae datos de una
    // persona y no tiene por qué quedar en los logs del hosting.
    console.error(
      "Respuesta de Cidituc sin los campos mínimos:",
      [!id && "id_persona", !documento && "documento_persona"]
        .filter(Boolean)
        .join(", "),
    );
    return { ok: false, motivo: "no-disponible" };
  }

  // El login de Cidituc ya impide emitir un token para una cuenta dada de baja.
  // Algunas cuentas históricas usan otros valores positivos y algunas respuestas
  // no traen estos campos: sólo rechazamos la baja explícita.
  if (bandera(datos["validado"]) === false || bandera(datos["habilita"]) === false) {
    return { ok: false, motivo: "cuenta-inactiva" };
  }

  const cuil = soloDigitos(documento);
  if (cuil.length !== 11) {
    // Era el único camino de falla completamente mudo: cartel de "no disponible"
    // con el backend respondiendo 200. Se loguea el largo, nunca el documento.
    console.error(
      `Cidituc devolvió un documento_persona de ${cuil.length} dígitos; se esperaba un CUIL de 11.`,
    );
    return { ok: false, motivo: "no-disponible" };
  }

  return {
    ok: true,
    persona: {
      id,
      cuil,
      dni: dniDeCuil(cuil),
      nombre: texto(datos["nombre_persona"]) ?? "",
      apellido: texto(datos["apellido_persona"]) ?? "",
      email: texto(datos["email_persona"])?.toLowerCase() ?? null,
    },
  };
}
