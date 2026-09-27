/**
 * El service worker de El Sanmiguelino: lo que hace que el diario instalado
 * abra sin señal.
 *
 * Lo registra `src/components/pwa/puente-service-worker.tsx`, sólo en
 * producción. Hace tres cosas y nada más:
 *
 * 1. **Páginas del diario, primero la red.** Cada página del diario que se
 *    muestra con conexión queda guardada, y sin conexión se sirve la última
 *    copia. Con conexión nunca se sirve una copia: un diario viejo que parece
 *    nuevo es peor que un diario que tarda.
 * 2. **Chunks y fotos, primero la caché.** Los chunks de `/_next/static/`
 *    llevan el hash en el nombre y no cambian nunca, y las fotos casi nunca.
 *    Salir a la red por ellos cada vez es pagar datos móviles por lo que el
 *    teléfono ya tiene.
 * 3. **La página `/sin-conexion`** para cualquier navegación que no tenga
 *    copia: lo que se ve en vez del dinosaurio del navegador.
 *
 * ## Cómo se entera de qué página se leyó
 *
 * Por dos caminos, porque en el diario se navega de dos maneras:
 *
 * - **La navegación completa** del navegador (abrir la aplicación, recargar,
 *   entrar por un enlace compartido) pasa por el `fetch` de acá, y la copia se
 *   guarda de la misma respuesta que se le entrega al lector.
 * - **La navegación interna** de Next (tocar una nota, pasar de página) no es
 *   una navegación para el navegador: es un `fetch` con el protocolo RSC, y
 *   este archivo no lo intercepta. Para esas, la página avisa con el mensaje
 *   `mostrando` cada vez que cambia de ruta (`src/lib/pwa.ts`), y el worker
 *   baja por su cuenta el HTML completo de esa ruta. Es un pedido más al
 *   servidor, y por eso se hace sólo si la copia falta o tiene más de
 *   `REFRESCO_MS`.
 *
 * El protocolo RSC no se intercepta a propósito: es interno de Next y cambia
 * entre versiones. La ruta que muestra la página (`usePathname`) es API
 * pública.
 *
 * Sin conexión el paso de página también llega a la copia: cuando un pedido
 * RSC falla por falta de red, el router de Next cae a una navegación completa
 * (`fetch-server-response.js`, "Falling back to browser navigation"), y esa sí
 * pasa por acá.
 *
 * ## Qué pasa por acá y qué no
 *
 * Toda navegación completa pasa por `navegar()`, también las del panel y las
 * del ingreso con Cidituc: a esas sólo les agrega el aviso sin conexión, y no
 * se les guarda nada. Las API (Migue, comentarios, votos), los pedidos RSC y
 * todo lo que no sea página, chunk o foto van a la red sin que el worker los
 * toque.
 *
 * ## Las cachés van atadas a cada build
 *
 * El registro pide `/sw.js?v=<build>` (ver `VERSION_SITIO` en next.config.ts).
 * Un deploy nuevo cambia la URL, el navegador instala este archivo de nuevo, y
 * al activarse borra las cachés de la versión anterior. No es prolijidad: una
 * página guardada nombra los chunks de SU build, y si esos chunks se
 * recortaran por separado la copia abriría sin estilos. Atando las dos cosas a
 * la misma versión, o está todo o no está nada.
 *
 * El costo es que el worker nuevo arranca con las cachés vacías. Por eso,
 * cuando toma el control, la página vuelve a avisar qué está mostrando
 * (`controllerchange` en el puente) y esa página queda guardada en las cachés
 * nuevas. Lo mismo cubre la primera instalación, en la que la página que
 * registró al worker se cargó antes de que existiera.
 *
 * ## Una copia se guarda sólo si la página terminó de dibujarse
 *
 * El 200 llega antes que la página. /diario y las notas tienen `loading.tsx`,
 * así que Next manda el encabezado y el esqueleto primero y la página después,
 * y si la base falla en el medio el error viaja dentro de un documento con 200.
 * Por eso, además del 200, se exige `MARCA`: la pone `HojaDiario`, que es la
 * hoja de todas las páginas del diario, y aparece en el HTML sólo si la hoja
 * se dibujó. Sin marca queda la copia anterior.
 *
 * ## Las páginas guardadas son de quien inició sesión
 *
 * El diario es exclusivo para usuarios de Cidituc, y lo guardado para leer sin
 * conexión es lo que vio esa persona, con su nombre en la cabecera. Así que se
 * borra en los dos momentos en que deja de ser suyo:
 *
 * - Al cerrar sesión: el botón manda `olvidar-paginas` (`src/lib/pwa.ts`).
 * - Cada vez que se muestra /login. El proxy manda al diario a quien tiene
 *   sesión, así que si /login se dibuja es porque no la hay. Es lo que ve quien
 *   tenía la sesión vencida, y se llega de las dos maneras: con la aplicación
 *   abierta, el siguiente toque es un pedido RSC que el proxy redirige y /login
 *   aparece por navegación interna. La página avisa `mostrando` también en ese
 *   caso, y `navegar()` lo ve además cuando es una navegación completa, por si
 *   la página no llega a hidratar.
 *
 * Una copia que se empezó a guardar antes del borrado no se escribe después
 * (ver `generacion`).
 *
 * El borrado lo hace siempre este archivo y no la página, aunque la página
 * también ve las cachés: así los nombres y la regla de qué se conserva viven en
 * un solo lugar.
 *
 * ## Qué se descarta cuando se llena
 *
 * Cada copia lleva en `Guardada-En` la hora en que se guardó o se usó por
 * última vez, y al pasar el tope se va la más vieja. No se usa el orden de
 * `cache.keys()`: en Chrome volver a guardar una URL la manda al final, pero
 * en Safari la deja donde estaba.
 */

const VERSION =
  new URL(self.location.href).searchParams.get("v") || "sin-version";

const PREFIJO = "sanmiguelino-";
const PAGINAS = `${PREFIJO}paginas-${VERSION}`;
const ESTATICOS = `${PREFIJO}estaticos-${VERSION}`;
const IMAGENES = `${PREFIJO}imagenes-${VERSION}`;
const PROPIAS = [PAGINAS, ESTATICOS, IMAGENES];

const SIN_CONEXION = "/sin-conexion";

/** Las rutas del diario que se guardan para leer sin conexión. No entran
 *  /buscar (cada búsqueda es otra URL y ninguna se vuelve a pedir igual), ni
 *  la landing, ni /login, ni el panel. */
const SE_GUARDA = /^\/(?:diario$|archivo$|nota\/|edicion\/|seccion\/)/;

/** Lo que tiene que traer el HTML para que valga la pena guardarlo. La pone
 *  `src/components/hoja-diario.tsx` y también la página de aviso. Así, con
 *  `="` literal, sólo aparece en el HTML dibujado: en el payload RSC la misma
 *  propiedad viaja como JSON y se escribe distinto. */
const MARCA = 'data-sin-conexion="guardable"';

/** Cuántas páginas y fotos se guardan como mucho. Son un techo para que el
 *  teléfono no termine guardando el archivo entero, no una medida de la
 *  edición: si una edición tuviera más páginas, quedan las últimas leídas. */
const TOPE_PAGINAS = 40;
const TOPE_IMAGENES = 150;

/** Cada cuánto se vuelve a bajar una página que ya está guardada cuando se la
 *  muestra por navegación interna. Sin esto, la copia de /diario podía quedar
 *  en la edición anterior si el lector nunca volvía a abrir la aplicación de
 *  cero, y una nota corregida desde el panel se leería sin conexión con el
 *  error. Seis horas es una bajada por página y por turno de lectura. */
const REFRESCO_MS = 6 * 60 * 60 * 1000;

/** Cada cuánto se actualiza la hora de uso de una copia que se sirve de la
 *  caché. Reescribirla en cada vista sería copiar la foto entera cada vez; para
 *  decidir qué se descarta alcanza con saberlo a la hora. */
const TOQUE_MS = 60 * 60 * 1000;

/** Los recursos de build que nombra una página. Frena en la barra invertida
 *  porque en el payload RSC que viene adentro del HTML las URL van entre
 *  comillas escapadas (`\"/_next/static/...\"`). */
const RECURSO_DE_BUILD = /\/_next\/static\/[^"'\s\\)]+\.[a-z0-9]+(?:\?[^"'\s\\)]*)?/gi;

/** Las páginas que se están guardando ahora mismo. Al abrir la aplicación
 *  llegan casi juntos la navegación completa y el aviso de la página, y sin
 *  esto la misma página se bajaba dos veces. */
const enCurso = new Set();

/** Sube cada vez que se borran las páginas. Una copia que se empezó a guardar
 *  antes del borrado ya no se escribe: sería de quien acaba de salir. */
let generacion = 0;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // `reload` para que no la traiga de la caché HTTP de un build anterior.
      const respuesta = await fetch(SIN_CONEXION, { cache: "reload" });
      // Si no llega, la instalación falla y se reintenta en la próxima visita.
      // Un service worker sin su página de aviso es peor que ninguno.
      if (!respuesta.ok) throw new Error(`${SIN_CONEXION}: ${respuesta.status}`);
      if (!(await guardarPagina(SIN_CONEXION, respuesta))) {
        throw new Error(`${SIN_CONEXION}: no se pudo guardar`);
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Arranca el pedido de la página en paralelo con el arranque de este
      // worker, en vez de esperar a que levante. En un teléfono de gama baja
      // son cientos de milisegundos en cada navegación completa.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      const nombres = await caches.keys();
      await Promise.all(
        nombres
          .filter((n) => n.startsWith(PREFIJO) && !PROPIAS.includes(n))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const { tipo, ruta } = event.data ?? {};
  if (tipo === "olvidar-paginas") {
    event.waitUntil(olvidarPaginas());
  } else if (tipo === "mostrando" && typeof ruta === "string") {
    event.waitUntil(mostrando(ruta));
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(navegar(event, url));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(primeroLaCache(event, ESTATICOS));
  } else if (esImagen(url)) {
    event.respondWith(primeroLaCache(event, IMAGENES, TOPE_IMAGENES));
  }
});

async function navegar(event, url) {
  try {
    const respuesta =
      (await event.preloadResponse) || (await fetch(event.request));

    // Una navegación sigue las redirecciones del lado del navegador, así que
    // acá una redirección llega opaca y no dice a dónde va. Lo que sí se ve
    // es /login respondiendo con su página, y eso sólo pasa sin sesión: a
    // quien la tiene, el proxy lo manda al diario antes de llegar a la página.
    if (url.pathname === "/login" && respuesta.ok) {
      event.waitUntil(olvidarPaginas());
    } else if (SE_GUARDA.test(url.pathname) && esGuardable(respuesta)) {
      const copia = respuesta.clone();
      event.waitUntil(guardarUnaVez(clavePagina(url), async () => copia));
    }
    return respuesta;
  } catch {
    const cache = await caches.open(PAGINAS);
    const clave = clavePagina(url);
    const guardada = SE_GUARDA.test(url.pathname) && (await cache.match(clave));
    if (guardada) {
      event.waitUntil(tocar(cache, clave, guardada.clone()));
      return guardada;
    }
    return (await cache.match(SIN_CONEXION)) || Response.error();
  }
}

/** La página avisó qué ruta está mostrando: la que se abrió por navegación
 *  interna, o la que ya estaba en pantalla cuando este worker tomó el
 *  control. */
async function mostrando(ruta) {
  const url = new URL(ruta, self.location.origin);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/login") return olvidarPaginas();
  if (!SE_GUARDA.test(url.pathname)) return;

  const clave = clavePagina(url);
  const cache = await caches.open(PAGINAS);
  const guardada = await cache.match(clave);
  if (guardada && Date.now() - sello(guardada) < REFRESCO_MS) {
    await tocar(cache, clave, guardada);
    return;
  }
  // Sin encabezados RSC, el servidor contesta el documento completo. Si la
  // sesión venció, el proxy redirige a /login y `esGuardable` lo descarta.
  await guardarUnaVez(clave, () => fetch(clave, { credentials: "same-origin" }));
}

async function primeroLaCache(event, nombre, tope) {
  const cache = await caches.open(nombre);
  const guardada = await cache.match(event.request);
  if (guardada) {
    // Sólo en las que tienen tope importa cuándo se usó por última vez.
    if (tope) event.waitUntil(tocar(cache, event.request, guardada.clone()));
    return guardada;
  }

  let respuesta;
  try {
    respuesta = await fetch(event.request);
  } catch (error) {
    const otra = await otraMedida(cache, event.request.url);
    if (otra) return otra;
    throw error;
  }
  if (respuesta.ok) {
    const copia = tope ? sellada(respuesta.clone()) : respuesta.clone();
    event.waitUntil(
      cache.put(event.request, copia).then(() => tope && recortar(nombre, tope)),
    );
  }
  return respuesta;
}

/** Guarda la página `clave` con la respuesta que traiga `obtener()`, salvo que
 *  ya se esté guardando. Si no hay red o la respuesta no sirve, queda la copia
 *  que había. */
async function guardarUnaVez(clave, obtener) {
  if (enCurso.has(clave)) return;
  enCurso.add(clave);
  try {
    const respuesta = await obtener();
    if (esGuardable(respuesta)) await guardarPagina(clave, respuesta);
  } catch {
    // Sin red, o el servidor no contestó: no hay nada nuevo que guardar.
  } finally {
    enCurso.delete(clave);
  }
}

/**
 * Guarda una página junto con los chunks y estilos que nombra. Devuelve si la
 * guardó.
 *
 * Los recursos van primero y la página después, y si falta una hoja de estilos
 * la página no se guarda: una copia sin estilos es ilegible, y es mejor que
 * quede la anterior. Un chunk de JavaScript que falte, en cambio, a lo sumo
 * deja algo sin hidratar y la nota se lee igual.
 *
 * Se guarda en una respuesta nueva y no en la que llegó, porque el cuerpo ya
 * se leyó para buscar la marca y los recursos, y para sellarla con la hora.
 */
async function guardarPagina(clave, respuesta) {
  const inicio = generacion;
  const html = await respuesta.text();
  if (!html.includes(MARCA)) return false;

  const estaticos = await caches.open(ESTATICOS);
  const recursos = [...new Set(html.match(RECURSO_DE_BUILD) ?? [])];
  const faltantes = await Promise.all(
    recursos.map(async (ruta) => {
      if (await estaticos.match(ruta)) return null;
      try {
        const r = await fetch(ruta);
        if (r.ok) {
          await estaticos.put(ruta, r);
          return null;
        }
      } catch {
        // Se cuenta como faltante, abajo.
      }
      return ruta;
    }),
  );
  if (faltantes.some((r) => r && /\.css(?:\?|$)/.test(r))) return false;

  const paginas = await caches.open(PAGINAS);
  if (generacion !== inicio) return false;
  await paginas.put(
    clave,
    new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Guardada-En": String(Date.now()),
      },
    }),
  );
  await recortar(PAGINAS, TOPE_PAGINAS, SIN_CONEXION);
  return true;
}

/** Saca las entradas usadas hace más tiempo hasta dejar `tope`. Nunca saca
 *  `conservar`. */
async function recortar(nombre, tope, conservar) {
  const cache = await caches.open(nombre);
  const claves = await cache.keys();
  const sobran = claves.length - tope;
  if (sobran <= 0) return;
  const candidatas = await Promise.all(
    claves
      .filter((c) => new URL(c.url).pathname !== conservar)
      .map(async (c) => ({ clave: c, sello: sello(await cache.match(c)) })),
  );
  candidatas.sort((a, b) => a.sello - b.sello);
  await Promise.all(
    candidatas.slice(0, sobran).map(({ clave }) => cache.delete(clave)),
  );
}

/** Borra las páginas guardadas pero deja la de aviso, que no es de nadie. */
async function olvidarPaginas() {
  generacion++;
  const cache = await caches.open(PAGINAS);
  const claves = await cache.keys();
  await Promise.all(
    claves
      .filter((c) => new URL(c.url).pathname !== SIN_CONEXION)
      .map((c) => cache.delete(c)),
  );
}

/**
 * La misma foto guardada en otra medida, para cuando no hay red.
 *
 * El optimizador de Next sirve cada foto en varios anchos (`?url=...&w=...`) y
 * el navegador elige según el ancho de la pantalla. Rotar el teléfono o
 * cambiar el tamaño de la ventana cambia la elección, y sin esto la foto que el
 * lector ya vio aparecía rota sólo porque se pedía en otra medida. Se devuelve
 * la más grande que haya: achicarla se ve bien, agrandar una chica no.
 */
async function otraMedida(cache, direccion) {
  const pedida = new URL(direccion);
  if (pedida.pathname !== "/_next/image") return undefined;
  const foto = pedida.searchParams.get("url");

  let mejor;
  let ancho = -1;
  for (const clave of await cache.keys()) {
    const u = new URL(clave.url);
    if (u.pathname !== "/_next/image" || u.searchParams.get("url") !== foto) {
      continue;
    }
    const w = Number(u.searchParams.get("w")) || 0;
    if (w > ancho) {
      mejor = clave;
      ancho = w;
    }
  }
  return mejor && cache.match(mejor);
}

/** Vuelve a sellar una copia con la hora de ahora, si la que tiene es de hace
 *  más de `TOQUE_MS`. Recibe una respuesta que puede consumir. */
async function tocar(cache, clave, respuesta) {
  if (Date.now() - sello(respuesta) < TOQUE_MS) return;
  await cache.put(clave, sellada(respuesta));
}

/** La misma respuesta con `Guardada-En` en la hora de ahora. */
function sellada(respuesta) {
  const encabezados = new Headers(respuesta.headers);
  encabezados.set("Guardada-En", String(Date.now()));
  return new Response(respuesta.body, {
    status: respuesta.status,
    statusText: respuesta.statusText,
    headers: encabezados,
  });
}

/** Cuándo se guardó o se usó por última vez. Lo que no tiene sello —o ya no
 *  está— cuenta como lo más viejo. */
function sello(respuesta) {
  return Number(respuesta?.headers.get("Guardada-En")) || 0;
}

/** Una copia se guarda sólo de una respuesta entera y propia: ni una
 *  redirección (la de una sesión vencida lleva a /login) ni un error. */
function esGuardable(respuesta) {
  return (
    respuesta.status === 200 &&
    respuesta.type === "basic" &&
    !respuesta.redirected
  );
}

/** Las páginas del diario no leen la query, así que se guardan por ruta: una
 *  nota abierta desde un enlace compartido con `?utm_source=...` se encuentra
 *  después sin conexión como `/nota/<slug>` a secas. */
function clavePagina(url) {
  return url.origin + url.pathname;
}

function esImagen(url) {
  return (
    url.pathname === "/_next/image" ||
    /\.(?:png|jpe?g|webp|avif|gif|svg|ico)$/i.test(url.pathname)
  );
}
