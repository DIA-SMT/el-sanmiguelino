import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import {
  CIDITUC_CLAVE,
  CIDITUC_CONFIGURADO,
  CIDITUC_DERIVADOR,
} from "@/lib/auth/config";
import { validarToken } from "@/lib/auth/cidituc/persona";
import { urlDelDerivador } from "@/lib/auth/cidituc/derivador";
import type { ErrorIngreso } from "@/lib/auth/cidituc/errores";
import { SESSION_COOKIE, TTL_SESION_SEG } from "@/lib/auth/cookie";
import { crearToken } from "@/lib/auth/session";

/**
 * El ingreso por Cidituc, de punta a punta.
 *
 *   /auth/cidituc/inicio  →  derivador  →  /auth/cidituc/callback?auth=…
 *
 * El token de Cidituc no se guarda en ningún lado y no sobrevive al callback: lo
 * único que queda es **nuestra** sesión firmada con nuestro secreto. Cidituc dice
 * quién es la persona; qué puede hacer lo decide el diario.
 */

/**
 * Cookie del flujo: `<nonce>|<a dónde volver>`, diez minutos de vida.
 *
 * El nonce es protección CSRF —que alguien nos empuje un token ajeno al
 * callback— y el destino viaja acá y no en la URL porque el derivador no nos
 * devuelve parámetros propios: sólo `auth` y lo que pusimos en `state`.
 */
const COOKIE_FLUJO = "sm_cidituc";
const VIDA_FLUJO_SEG = 10 * 60;

/**
 * Tope del nombre que entra al token de sesión.
 *
 * La cookie viaja en **cada** pedido, y los navegadores la tiran entera pasados
 * los ~4 KB. El nombre es el único campo del payload que lo escribe otro sistema,
 * así que es el único que puede crecer sin que nos enteremos. Setenta y dos
 * caracteres alcanzan para cualquier nombre y apellido reales.
 */
const LARGO_MAXIMO_NOMBRE = 72;

const OPCIONES_COOKIE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/**
 * ¿Es un destino interno? Sólo rutas de este sitio.
 *
 * `//otro.sitio` y `/\otro.sitio` son URLs absolutas para el navegador aunque
 * empiecen con barra: sin este chequeo, el callback sería un redirector abierto
 * y bastaría un enlace preparado para mandar a alguien afuera desde nuestro
 * dominio.
 */
const DESTINO_POR_DEFECTO = "/diario";

function destinoSeguro(valor: string | null | undefined): string {
  if (!valor || !valor.startsWith("/")) return DESTINO_POR_DEFECTO;
  if (valor.startsWith("//") || valor.startsWith("/\\")) return DESTINO_POR_DEFECTO;
  return valor;
}

function interna(request: NextRequest, pathname: string, search = "") {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  url.hash = "";
  return url;
}

function conError(request: NextRequest, error: ErrorIngreso) {
  // El destino se rescata de la cookie ANTES de borrarla. Las tres formas de
  // fallar el state son fallas de *primer* intento, así que sin esto alguien que
  // fue interceptado leyendo una nota reintenta y aterriza en la tapa: perdió el
  // lugar donde estaba justo por culpa del error.
  const { destino } = leerFlujo(request);
  const parametros = new URLSearchParams({ error });
  if (destino !== DESTINO_POR_DEFECTO) parametros.set("volverA", destino);

  const res = NextResponse.redirect(
    interna(request, "/login", `?${parametros}`),
    303,
  );
  res.cookies.set(COOKIE_FLUJO, "", { ...OPCIONES_COOKIE, maxAge: 0 });
  return res;
}

/** Lo que guardamos en la cookie del flujo: el nonce y a dónde volver. */
function leerFlujo(request: NextRequest): { nonce: string; destino: string } {
  const guardado = request.cookies.get(COOKIE_FLUJO)?.value ?? "";
  const corte = guardado.indexOf("|");
  return {
    nonce: corte === -1 ? guardado : guardado.slice(0, corte),
    destino: destinoSeguro(corte === -1 ? null : guardado.slice(corte + 1)),
  };
}

/**
 * Arranca el ingreso: guarda el nonce y manda al derivador.
 *
 * El `#` de la URL no es decorativo — el derivador usa HashRouter y sin él te
 * expulsa a `ciudaddigital.smt.gob.ar`, que es otro sitio.
 */
export function inicioCidituc(request: NextRequest): NextResponse {
  if (!CIDITUC_CONFIGURADO) return conError(request, "sin-configurar");

  const destino = destinoSeguro(request.nextUrl.searchParams.get("volverA"));
  const nonce = crypto.randomUUID();

  let destinoCidituc: string;
  try {
    destinoCidituc = urlDelDerivador(CIDITUC_DERIVADOR, CIDITUC_CLAVE, nonce);
  } catch {
    console.error(
      `CIDITUC_DERIVADOR_URL no es una URL válida: ${JSON.stringify(CIDITUC_DERIVADOR)}. ` +
        "Va el origen solo (https://cidituc.smt.gob.ar); el #/login lo agrega urlDelDerivador().",
    );
    return conError(request, "sin-configurar");
  }

  const res = NextResponse.redirect(destinoCidituc, 303);
  res.cookies.set(COOKIE_FLUJO, `${nonce}|${destino}`, {
    ...OPCIONES_COOKIE,
    maxAge: VIDA_FLUJO_SEG,
  });
  return res;
}

/**
 * Vuelta desde Cidituc: valida el token y emite la sesión del diario.
 */
export async function callbackCidituc(
  request: NextRequest,
): Promise<NextResponse> {
  const parametros = request.nextUrl.searchParams;
  const token = parametros.get("auth") ?? "";
  const estadoDevuelto = parametros.get("state") ?? "";

  const { nonce, destino } = leerFlujo(request);

  if (!nonce || !estadoDevuelto || nonce !== estadoDevuelto) {
    const causa: ErrorIngreso = !estadoDevuelto
      ? "state-ausente"
      : !nonce
        ? "state-vencido"
        : "state-distinto";
    // Sólo si estaban, nunca el valor: identifica el caso sin registrar el nonce.
    console.error("Ingreso por Cidituc rechazado al comparar el state.", {
      causa,
      cookiePresente: Boolean(nonce),
      statePresente: Boolean(estadoDevuelto),
      tokenPresente: Boolean(token),
    });
    return conError(request, causa);
  }

  if (!token) return conError(request, "sin-token");

  const validacion = await validarToken(token);
  if (!validacion.ok) return conError(request, validacion.motivo);

  const { persona } = validacion;
  const nombre = (
    [persona.nombre, persona.apellido].filter(Boolean).join(" ").trim() ||
    // Cidituc admite nombre y apellido vacíos. Antes que mostrar el documento de
    // alguien al pie de un comentario, el diario prefiere no nombrarlo.
    "Vecino/a"
  ).slice(0, LARGO_MAXIMO_NOMBRE);

  // Lo único que puede tirar de acá para abajo, y tira por una sola razón:
  // falta SESSION_SECRET o es corto. Sin este catch sale un 500 en blanco con la
  // persona ya autenticada, que es el peor momento para no decir nada.
  let sesion: string;
  try {
    sesion = crearToken({ id: persona.id, nombre });
  } catch (error) {
    console.error(
      "Cidituc validó la identidad pero no se pudo firmar la sesión:",
      error instanceof Error ? error.message : error,
    );
    return conError(request, "sesion-fallida");
  }

  // A una URL limpia: el token no queda en la barra de direcciones, ni en el
  // historial, ni en el Referer de la próxima navegación.
  const res = NextResponse.redirect(interna(request, destino), 303);
  res.cookies.set(SESSION_COOKIE, sesion, {
    ...OPCIONES_COOKIE,
    maxAge: TTL_SESION_SEG,
  });
  res.cookies.set(COOKIE_FLUJO, "", { ...OPCIONES_COOKIE, maxAge: 0 });
  return res;
}
