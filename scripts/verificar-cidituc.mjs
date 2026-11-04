/**
 * ¿El ingreso con Cidituc puede funcionar desde acá?
 *
 * Se corre con `npm run verificar:cidituc`. Toca la red de verdad: pregunta al
 * backend municipal, no simula nada. Y no necesita que nadie preste su cuenta —
 * todo lo que hace se apoya en que un token inventado tiene que ser rechazado
 * con 401, y ese 401 *es* la validación funcionando.
 *
 * Los tres chequeos, en orden de qué tan caro sale descubrirlos tarde:
 *
 *  1. **La cadena TLS.** El backend manda un solo certificado y omite el
 *     intermedio de Sectigo. Windows lo completa con su store, así que desde esta
 *     máquina `fetch` anda igual y el problema aparece recién en Vercel, con
 *     `UNABLE_TO_VERIFY_LEAF_SIGNATURE` y una persona ya autenticada mirando un
 *     cartel de "no disponible". Acá se reproduce a propósito el runtime de
 *     Vercel —sólo las raíces que trae Node— y después se comprueba que con
 *     nuestro intermedio sí valida. `curl -k` tapa exactamente esto, por eso no
 *     sirve para diagnosticar.
 *
 *  2. **El endpoint.** Un 401 es la respuesta buena. Un 404 significa que
 *     `CIDITUC_API_URL` apunta a un host que no sirve la API. Sin respuesta, un
 *     firewall o el servidor caído.
 *
 *  3. **El prefijo del header.** Con `Bearer` da 401 *siempre*, también con un
 *     token bueno, así que un 401 constante en producción casi nunca es el token.
 *     Se manda una consulta con prefijo sólo para dejar dicho en pantalla que ese
 *     401 no prueba nada.
 *
 * Lo que este script NO puede probar: que el login de Ciudad Digital publicado
 * tenga la rama del diario. Eso vive en otro repositorio (`cidituc`) y se
 * verifica mirando el bundle desplegado. Ver docs/integracion-cidituc.md.
 */
import { config as cargarEnv } from "dotenv";
import tls from "node:tls";
import https from "node:https";
import http from "node:http";

const { SECTIGO_CA_DV_R36 } = await import(
  new URL("../src/lib/auth/cidituc/sectigo-ca.ts", import.meta.url).href
);
const { urlDelLogin, urlDeSalida } = await import(
  new URL("../src/lib/auth/cidituc/login.ts", import.meta.url).href
);
const { nombreDeDiario } = await import(
  new URL("../src/lib/auth/cidituc/nombre.ts", import.meta.url).href
);

cargarEnv({ path: ".env.local", quiet: true });

const TOKEN_FALSO = "token-invalido-de-prueba-para-verificar-la-validacion";
const TIMEOUT_MS = 10_000;

/**
 * La MISMA autoridad que va a usar la app, no siempre el intermedio embebido.
 *
 * Si no, el día de la rotación el script miente en las dos direcciones: da verde
 * con una CIDITUC_CA_PEM rota, y da rojo cuando el embebido venció pero la del
 * entorno anda. Es la línea equivalente de autoridadesConfiables() en
 * src/lib/auth/cidituc/transporte.ts.
 */
const CA_DEL_ENTORNO = (process.env.CIDITUC_CA_PEM ?? "").trim();
const CA_EN_USO = CA_DEL_ENTORNO || SECTIGO_CA_DV_R36;
const AUTORIDADES = [...tls.rootCertificates, CA_EN_USO];

let fallas = 0;

function ok(nombre, condicion, detalle = "") {
  if (!condicion) fallas++;
  console.log(`  ${condicion ? "ok " : "MAL"} ${nombre}`);
  if (detalle) console.log(`        ${detalle}`);
}

/* --------------------------------------------------------------- variables */

console.log("\nConfiguración\n");

const api = (process.env.CIDITUC_API_URL ?? "").trim().replace(/\/+$/, "");
const login = (process.env.CIDITUC_LOGIN_URL ?? "").trim();
const callback = (process.env.CIDITUC_CALLBACK_URL ?? "").trim();
const clave = (process.env.CIDITUC_CLAVE_APP ?? "").trim() || "sanmiguelino";

// A propósito no cuenta como falla: hasta que el login de Ciudad Digital
// publicado tenga la rama del diario, tenerlo apagado es la configuración
// CORRECTA —un botón que manda a una pantalla que no sabe volver es peor que
// ningún botón—. Todo lo demás se puede
// verificar igual, y de hecho es lo que hay que verificar antes de prenderlo.
const habilitado = (process.env.CIDITUC_HABILITADO ?? "").trim();
const prendido = habilitado === "1";
if (prendido) {
  console.log("  ok  CIDITUC_HABILITADO en 1");
} else if (habilitado !== "" && habilitado !== "0") {
  // Se exige exactamente "1", y eso falla callado: un `true` heredado de
  // UrbanIA (que usa CIDITUC_ENABLED="true") deja el ingreso apagado sin
  // decirlo. Es una falla de verdad, no una configuración a medias.
  ok(`CIDITUC_HABILITADO tiene que ser "1", no "${habilitado}"`, false,
    'Con cualquier otro valor el ingreso queda apagado y nada lo avisa. UrbanIA usa CIDITUC_ENABLED="true"; acá no.');
} else {
  console.log(
    "  --  CIDITUC_HABILITADO apagado: el botón de /login no aparece todavía\n" +
      "        Es lo correcto hasta que Ciudad Digital publique la rama del diario.",
  );
}

// El único camino del callback que puede tirar después de que Cidituc dijo que
// sí. Sin secreto, la persona se autentica bien y recibe un cartel de
// "sesion-fallida": el error más fácil de cometer al cargar variables nuevas.
const secreto = (process.env.SESSION_SECRET ?? "").trim();
ok("SESSION_SECRET de 32 caracteres o más", secreto.length >= 32,
  secreto.length === 0
    ? "falta: en produccion el callback no puede firmar la sesion y corta despues de autenticar"
    : secreto.length < 32
      ? `tiene ${secreto.length}; en produccion la app tira`
      : "");
ok("CIDITUC_API_URL cargada", Boolean(api), api || "falta en .env.local");
ok("CIDITUC_LOGIN_URL cargada", Boolean(login), login || "falta en .env.local");
ok("CIDITUC_CALLBACK_URL cargada", Boolean(callback), callback || "falta en .env.local");

if (login) {
  // El origen solo: el "#/login" lo agrega la app. Si acá viene con hash, el
  // flujo arma una URL con dos fragmentos y el login no entiende ninguno.
  ok("el login es el origen solo, sin #", !login.includes("#"),
    login.includes("#") ? "sacale el #/login: eso lo agrega urlDelLogin()" : "");
}

if (callback) {
  ok("el callback termina en /auth/cidituc/callback",
    callback.endsWith("/auth/cidituc/callback"),
    "tiene que ser idéntico al escrito en PrivateRoute.jsx del repo `cidituc`");
}

/* --------------------------------------------------------- a dónde se manda */

/** Las partes de una URL del login: la query real y la del fragmento. */
function partes(armada) {
  const url = new URL(armada);
  const [ruta, query = ""] = url.hash.slice(1).split("?");
  return { real: url.searchParams, ruta, hash: new URLSearchParams(query) };
}

if (login) {
  console.log("\nLas URLs del login de Ciudad Digital\n");

  // Son las funciones de verdad, las mismas que corren en el ingreso y la
  // salida.
  const armar = (f) => {
    try {
      return f();
    } catch {
      return "";
    }
  };
  const ida = armar(() => urlDelLogin(login, clave, "nonce-de-prueba"));
  const reintento = armar(() => urlDelLogin(login, clave, "nonce-de-prueba", true));
  const salida = armar(() => urlDeSalida(login, clave));

  ok("se pueden armar", Boolean(ida && reintento && salida),
    ida ? "" : `${login} no es una URL válida`);
  if (ida && reintento && salida) {
    // Sin el `#` el login no encuentra la ruta: usa HashRouter. Es el error
    // más fácil de cometer y el que menos se parece a su causa.
    const i = partes(ida);
    ok("la ida lleva el fragmento #/login", i.ruta === "/login");
    ok(`la ida identifica al diario como "${clave}"`, i.hash.get("next") === clave);
    ok("la ida manda el state", i.hash.get("state") === "nonce-de-prueba");
    ok("la ida NO borra el token guardado", !i.real.has("logout"));

    // El `logout=1` va en la query real, antes del `#`: ahí lo lee App.jsx.
    // Dentro del fragmento no lo ve nadie y el token vencido vuelve siempre.
    const r = partes(reintento);
    ok("el reintento borra el token (logout=1 antes del #)", r.real.get("logout") === "1");
    ok("el reintento vuelve al login del diario con state",
      r.ruta === "/login" && r.hash.get("next") === clave && r.hash.has("state"));

    const s = partes(salida);
    ok("la salida borra el token (logout=1 antes del #)", s.real.get("logout") === "1");
    ok("la salida pide volver al diario (next y salir=1)",
      s.ruta === "/login" && s.hash.get("next") === clave && s.hash.get("salir") === "1");
  }
}

/* ------------------------------------------------------- el nombre que firma */

{
  console.log("\nCómo queda el nombre que devuelve Cidituc\n");

  // Cidituc los manda en MAYÚSCULAS. Estos casos son los que no se pueden
  // romper: las partículas en minúscula, "San" que NO es partícula, el apóstrofo
  // y el guion adentro del apellido, y los nombres ya bien escritos que no se
  // tocan.
  const casos = [
    ["ALFREDO AGUSTIN BRITO", "Alfredo Agustin Brito"],
    // Las partículas que SÍ bajan, y "los"/"las" sólo detrás de "de".
    ["MARIA DE LOS ANGELES SUAREZ", "Maria de los Angeles Suarez"],
    ["JUAN DE LA VEGA", "Juan de la Vega"],
    ["MARIA DEL VALLE", "Maria del Valle"],
    ["GARCIA Y LOPEZ", "Garcia y Lopez"],
    ["DE LA VEGA", "De la Vega"],
    // Las que NO bajan. Éstas salían mal con la primera lista de partículas y
    // son la razón por la que se recortó: un apellido mal escrito es peor que
    // uno gritado, y los de origen italiano y sirio-libanés son de acá.
    ["JORGE DI STEFANO", "Jorge Di Stefano"],
    ["ANTONIO DA SILVA", "Antonio Da Silva"],
    ["JOSE EL HALABI", "Jose El Halabi"],
    ["ANA LA ROSA", "Ana La Rosa"],
    ["PIETER VAN DER BERG", "Pieter Van Der Berg"],
    ["JUAN E LOPEZ", "Juan E Lopez"],
    ["JOSE SAN MARTIN", "Jose San Martin"],
    // Separadores y acentos.
    ["D'AMICO", "D'Amico"],
    ["SUAREZ-MASON", "Suarez-Mason"],
    ["BRITO,ALFREDO", "Brito,Alfredo"],
    ["MARÍA JOSÉ PEÑA", "María José Peña"],
    ["J. B. ALBERDI", "J. B. Alberdi"],
    // Lo que ya viene escrito no se toca.
    ["de la Vega", "de la Vega"],
    ["McDonald Ana", "McDonald Ana"],
  ];

  for (const [entrada, esperado] of casos) {
    const salida = nombreDeDiario(entrada);
    ok(`${entrada} → ${salida}`, salida === esperado,
      salida === esperado ? "" : `se esperaba ${esperado}`);
  }
}

if (!api) {
  console.log("\nSin CIDITUC_API_URL no hay nada más que probar.\n");
  process.exit(1);
}

const destino = new URL(api);
const esHttps = destino.protocol === "https:";
const puerto = Number(destino.port) || (esHttps ? 443 : 80);

/* --------------------------------------------------------------- la cadena */

function conectar(autoridades) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: destino.hostname, port: puerto, servername: destino.hostname, ca: autoridades },
      () => {
        const cadena = socket.getPeerX509Certificate?.();
        let largo = 0;
        for (let c = cadena; c; c = c.issuerCertificate === c ? null : c.issuerCertificate) largo++;
        socket.end();
        resolve({ ok: true, largo });
      },
    );
    socket.setTimeout(TIMEOUT_MS, () => {
      socket.destroy();
      resolve({ ok: false, code: "ETIMEDOUT" });
    });
    socket.on("error", (e) => resolve({ ok: false, code: e.code ?? e.message }));
  });
}

if (esHttps) {
  console.log("\nLa cadena TLS\n");

  const comoVercel = await conectar(tls.rootCertificates);
  const conNuestroIntermedio = await conectar(AUTORIDADES);

  if (comoVercel.ok) {
    // Puede pasar el día que infraestructura arregle el servidor. Es una buena
    // noticia, no una falla: significa que el parche del intermedio sobra.
    ok("el servidor manda la cadena completa", true,
      "ya no hace falta aportar el intermedio; se puede volver a fetch y borrar transporte.ts");
  } else {
    ok("se reproduce la cadena incompleta (esperado)",
      comoVercel.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      `sólo con las raíces de Node: ${comoVercel.code}`);
  }

  ok(CA_DEL_ENTORNO ? "valida con la CA de CIDITUC_CA_PEM" : "valida aportando el intermedio de Sectigo embebido", conNuestroIntermedio.ok,
    conNuestroIntermedio.ok
      ? `cadena de ${conNuestroIntermedio.largo} certificado(s)`
      : `${conNuestroIntermedio.code} — la CA en uso ya no alcanza: revisá ${CA_DEL_ENTORNO ? "CIDITUC_CA_PEM" : "sectigo-ca.ts"}`);
} else {
  // Saltear en silencio sería peor que no correr: quedaría un "Todo en orden"
  // que justamente no probó lo que más caro sale descubrir tarde.
  console.log("\nLa cadena TLS\n");
  console.log(
    `  --  NO se probó: CIDITUC_API_URL es ${destino.protocol}//, no https.\n` +
      "        Contra el backend de producción ésta es la prueba que importa.",
  );
}

/* ------------------------------------------------------------- el endpoint */

function consultar(authorization) {
  const ruta = `${destino.pathname.replace(/\/+$/, "")}/usuarios/authStatus`;
  const cliente = esHttps ? https : http;
  return new Promise((resolve) => {
    const pedido = cliente.request(
      {
        hostname: destino.hostname,
        port: puerto,
        path: ruta,
        method: "GET",
        headers: { Accept: "application/json", Authorization: authorization },
        // El 401 con token falso se puede comprobar igual sobre http, contra el
        // backend local. Lo unico que no aplica es la cadena de confianza.
        ...(esHttps ? { ca: AUTORIDADES } : {}),
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve({ status: res.statusCode }));
      },
    );
    pedido.setTimeout(TIMEOUT_MS, () => {
      pedido.destroy();
      resolve({ status: 0, code: "ETIMEDOUT" });
    });
    pedido.on("error", (e) => resolve({ status: 0, code: e.code ?? e.message }));
    pedido.end();
  });
}

{
  // Sin `if (esHttps)`: el 401 con token falso se comprueba igual contra el
  // backend local por http. Lo único que no aplica ahí es la cadena de confianza.
  console.log("\nEl backend\n");

  const crudo = await consultar(TOKEN_FALSO);
  const explicacion = {
    401: "rechaza un token inventado: la validación funciona",
    403: "rechaza un token inventado: la validación funciona",
    404: "el host responde pero ahí no está el endpoint — CIDITUC_API_URL apunta a otro lado",
    0: `no hubo respuesta (${crudo.code}) — firewall hacia ese host/puerto, o servidor caído`,
  }[crudo.status];

  ok(`un token falso da 401 (dio ${crudo.status || "nada"})`,
    crudo.status === 401 || crudo.status === 403,
    explicacion ?? "código inesperado: problema propio del backend");

  const conBearer = await consultar(`Bearer ${TOKEN_FALSO}`);
  console.log(
    `\n  nota  con prefijo "Bearer" da ${conBearer.status || "nada"}. Da 401 también con tokens\n` +
      "        buenos: si en producción ves 401 permanente, mirá el header antes que el token.",
  );
}

console.log(
  fallas === 0
    ? "\nTodo en orden.\n"
    : `\n${fallas} problema(s). Ver docs/integracion-cidituc.md.\n`,
);
process.exit(fallas === 0 ? 0 : 1);
