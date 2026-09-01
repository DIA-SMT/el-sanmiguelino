import "server-only";

import http from "node:http";
import https from "node:https";
import tls from "node:tls";

import { SECTIGO_CA_DV_R36 } from "@/lib/auth/cidituc/sectigo-ca";

/**
 * Transporte HTTPS hacia el backend de Cidituc.
 *
 * Por qué no alcanza `fetch`: `estadisticas.smt.gob.ar:5000` sirve una cadena
 * TLS **incompleta**. Manda un solo certificado —la hoja `*.smt.gob.ar`— y nunca
 * el intermedio que la firma ("Sectigo Public Server Authentication CA DV R36").
 *
 * En Windows no se nota, porque el store del sistema ya tiene ese intermedio y
 * completa la cadena solo; por eso en desarrollo el login anda. El runtime Linux
 * de Vercel usa el bundle de Mozilla, que trae la raíz (R46) pero ningún
 * intermedio: el handshake muere con `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, `fetch`
 * tira una excepción, y la persona —que ya se autenticó bien en Cidituc— ve un
 * "no disponible" que no explica nada. **Probar desde la laptop no prueba nada**,
 * y `curl -k` lo tapa por completo.
 *
 * La solución es aportar el intermedio nosotros. No se apaga la verificación: la
 * cadena se valida entera contra las raíces del runtime más este certificado. Si
 * el backend cambiara a uno que no encadena hasta una raíz confiable, el
 * handshake seguiría fallando, como corresponde.
 *
 * Temporal: el día que infraestructura sirva la cadena completa, este archivo se
 * borra y vuelve el `fetch` común.
 */

/**
 * Las raíces del runtime más el intermedio que el servidor no manda.
 *
 * `CIDITUC_CA_PEM` permite reemplazarlo desde el entorno para poder rotarlo sin
 * un deploy. Si no está cargada se usa el embebido, así el ingreso no depende de
 * que alguien se acuerde de una variable.
 */
function autoridadesConfiables() {
  const delEntorno = process.env.CIDITUC_CA_PEM?.trim();
  return [...tls.rootCertificates, delEntorno || SECTIGO_CA_DV_R36];
}

/** La respuesta esperada es un JSON de pocos kilobytes; el tope evita sorpresas. */
const MAX_BYTES = 1_000_000;

export interface RespuestaCidituc {
  status: number;
  body: string;
}

/**
 * GET al backend de Cidituc, con la cadena de confianza completa.
 *
 * No sigue redirecciones ni las trata como error: un 3xx vuelve como `status` y
 * lo loguea el llamador, que es más útil que una excepción muda. Acepta `http://`
 * para el backend local de desarrollo.
 */
export function getDeCidituc(
  url: string,
  token: string,
  timeoutMs: number,
): Promise<RespuestaCidituc> {
  const destino = new URL(url);
  const esHttps = destino.protocol === "https:";
  const cliente = esHttps ? https : http;

  return new Promise((resolve, reject) => {
    const pedido = cliente.request(
      {
        protocol: destino.protocol,
        hostname: destino.hostname,
        port: destino.port || (esHttps ? 443 : 80),
        path: `${destino.pathname}${destino.search}`,
        method: "GET",
        // El token va CRUDO en Authorization. Con prefijo "Bearer" da 401
        // siempre, incluso con un token bueno.
        headers: { Accept: "application/json", Authorization: token },
        ...(esHttps ? { ca: autoridadesConfiables() } : {}),
      },
      (respuesta) => {
        let body = "";
        let bytes = 0;
        respuesta.setEncoding("utf8");
        respuesta.on("data", (parte: string) => {
          bytes += Buffer.byteLength(parte);
          if (bytes > MAX_BYTES) {
            pedido.destroy(
              new Error("la respuesta de Cidituc supera el tamaño esperado"),
            );
            return;
          }
          body += parte;
        });
        respuesta.on("end", () =>
          resolve({ status: respuesta.statusCode ?? 0, body }),
        );
      },
    );

    pedido.setTimeout(timeoutMs, () => {
      pedido.destroy(
        Object.assign(new Error(`Cidituc no respondió en ${timeoutMs} ms`), {
          code: "ETIMEDOUT",
        }),
      );
    });
    pedido.on("error", reject);
    pedido.end();
  });
}

/**
 * Traduce el error a algo accionable para el log. Un "fetch failed" a secas no
 * sirve: la razón real vive en el `code` —ECONNREFUSED, ENOTFOUND, ETIMEDOUT o
 * un error de certificado—.
 */
export function motivoDeFallo(error: unknown): string {
  const detalle = error as {
    code?: string;
    message?: string;
    cause?: { code?: string };
  };
  const code = detalle?.code ?? detalle?.cause?.code;

  if (
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    code === "SELF_SIGNED_CERT_IN_CHAIN" ||
    code === "CERT_HAS_EXPIRED" ||
    code === "ERR_TLS_CERT_ALTNAME_INVALID"
  ) {
    return `${code}: el certificado del backend no valida. Revisar el intermedio de src/lib/auth/cidituc/sectigo-ca.ts.`;
  }

  return code ?? detalle?.message ?? "error desconocido";
}
