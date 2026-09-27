/**
 * El service worker de El Sanmiguelino: lo que hace que el diario instalado
 * abra sin señal.
 *
 * Lo registra `src/components/pwa/registrar-service-worker.tsx`, sólo en
 * producción. Hace tres cosas y nada más:
 *
 * 1. **Páginas del diario, primero la red.** Cada vez que el lector abre la
 *    portada o una nota con conexión, se guarda una copia. Sin conexión se le
 *    sirve la última que vio. Con conexión nunca se sirve una copia: un diario
 *    viejo que parece nuevo es peor que un diario que tarda.
 * 2. **Todo lo demás del diario, primero la caché.** Los chunks de
 *    `/_next/static/` llevan el hash en el nombre y no cambian nunca, y las
 *    fotos casi nunca. Salir a la red por ellos cada vez es pagar datos móviles
 *    por lo que el teléfono ya tiene.
 * 3. **La página `/sin-conexion`** para cualquier navegación que no tenga
 *    copia: lo que se ve en vez del dinosaurio del navegador.
 *
 * Lo que NO toca, a propósito: las API (Migue, comentarios, votos), el panel,
 * el ingreso con Cidituc y los pedidos RSC de la navegación interna. Esos van
 * a la red como si este archivo no existiera. Cuando un pedido RSC falla por
 * falta de red, el router de Next cae a una navegación completa del navegador
 * (`fetch-server-response.js`, "Falling back to browser navigation"), y ESA sí
 * pasa por acá. Así el paso de página sin conexión llega a la copia guardada
 * sin que haya que interceptar el protocolo interno de Next.
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
 * ## Las páginas guardadas son de quien inició sesión
 *
 * El diario es exclusivo para usuarios de Cidituc, y lo guardado para leer sin
 * conexión es lo que vio esa persona, con su nombre en la cabecera. Así que se
 * borra en los dos momentos en que deja de ser suyo: al cerrar sesión (el botón
 * manda el mensaje `olvidar-paginas`, ver `src/lib/pwa.ts`) y cuando /login
 * responde con una página, que es la señal de que la sesión ya no está, por
 * vencimiento o por lo que sea.
 *
 * El borrado lo hace siempre este archivo y no la página, aunque la página
 * también ve las cachés: así los nombres y la regla de qué se conserva viven en
 * un solo lugar.
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

/** Cuántas páginas y fotos se guardan como mucho. Son un techo para que el
 *  teléfono no termine guardando el archivo entero, no una medida de la
 *  edición: si una edición tuviera más páginas, se guardan las últimas leídas.
 *  Al pasarse se va la que se guardó hace más tiempo. */
const TOPE_PAGINAS = 40;
const TOPE_IMAGENES = 150;

/** Los recursos de build que nombra una página. Frena en la barra invertida
 *  porque en el payload RSC que viene adentro del HTML las URL van entre
 *  comillas escapadas (`\"/_next/static/...\"`). */
const RECURSO_DE_BUILD = /\/_next\/static\/[^"'\s\\)]+\.[a-z0-9]+(?:\?[^"'\s\\)]*)?/gi;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // `reload` para que no la traiga de la caché HTTP de un build anterior.
      const respuesta = await fetch(SIN_CONEXION, { cache: "reload" });
      // Si no llega, la instalación falla y se reintenta en la próxima visita.
      // Un service worker sin su página de aviso es peor que ninguno.
      if (!respuesta.ok) throw new Error(`${SIN_CONEXION}: ${respuesta.status}`);
      await guardarPagina(SIN_CONEXION, respuesta);
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
  if (event.data === "olvidar-paginas") event.waitUntil(olvidarPaginas());
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
    // es /login respondiendo con su página: el proxy y la propia página
    // redirigen al diario a quien tiene sesión, así que un 200 acá quiere
    // decir que no la hay.
    if (url.pathname === "/login" && respuesta.ok) {
      event.waitUntil(olvidarPaginas());
    } else if (
      SE_GUARDA.test(url.pathname) &&
      respuesta.status === 200 &&
      respuesta.type === "basic" &&
      !respuesta.redirected
    ) {
      event.waitUntil(guardarPagina(event.request, respuesta.clone()));
    }
    return respuesta;
  } catch {
    const cache = await caches.open(PAGINAS);
    return (
      (SE_GUARDA.test(url.pathname) && (await cache.match(event.request))) ||
      (await cache.match(SIN_CONEXION)) ||
      Response.error()
    );
  }
}

async function primeroLaCache(event, nombre, tope) {
  const cache = await caches.open(nombre);
  const guardada = await cache.match(event.request);
  if (guardada) return guardada;

  let respuesta;
  try {
    respuesta = await fetch(event.request);
  } catch (error) {
    const otra = await otraMedida(cache, event.request.url);
    if (otra) return otra;
    throw error;
  }
  if (respuesta.ok) {
    const copia = respuesta.clone();
    event.waitUntil(
      cache.put(event.request, copia).then(() => tope && recortar(nombre, tope)),
    );
  }
  return respuesta;
}

/**
 * Guarda una página junto con los chunks y estilos que nombra.
 *
 * Los recursos van primero y la página después: si algo se corta en el medio,
 * lo que puede quedar es un chunk suelto, nunca una página sin sus estilos.
 *
 * Se guarda con un encabezado nuevo, sólo `Content-Type`, y no con los que
 * trajo. Next manda `Vary: RSC, Next-Router-State-Tree, ...`, y la Cache API
 * respeta `Vary` al buscar: con esos encabezados una copia podía no aparecer
 * justo cuando se la busca sin conexión.
 */
async function guardarPagina(clave, respuesta) {
  const html = await respuesta.text();

  const estaticos = await caches.open(ESTATICOS);
  const recursos = [...new Set(html.match(RECURSO_DE_BUILD) ?? [])];
  await Promise.all(
    recursos.map(async (ruta) => {
      if (await estaticos.match(ruta)) return;
      try {
        const r = await fetch(ruta);
        if (r.ok) await estaticos.put(ruta, r);
      } catch {
        // Uno que falte no invalida el resto: la página se ve igual, a lo
        // sumo sin lo que haga ese chunk.
      }
    }),
  );

  const paginas = await caches.open(PAGINAS);
  await paginas.put(
    clave,
    new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }),
  );
  await recortar(PAGINAS, TOPE_PAGINAS, SIN_CONEXION);
}

/** Saca las entradas más viejas hasta dejar `tope`. `cache.keys()` devuelve en
 *  orden de escritura, y volver a guardar una URL la manda al final, así que
 *  lo primero de la lista es lo que hace más tiempo que no se ve. */
async function recortar(nombre, tope, conservar) {
  const cache = await caches.open(nombre);
  const claves = await cache.keys();
  const sobran = claves.length - tope;
  if (sobran <= 0) return;
  const candidatas = claves.filter(
    (c) => new URL(c.url).pathname !== conservar,
  );
  await Promise.all(candidatas.slice(0, sobran).map((c) => cache.delete(c)));
}

/**
 * La misma foto guardada en otra medida, para cuando no hay red.
 *
 * El optimizador de Next sirve cada foto en varios anchos (`?url=...&w=...`) y
 * el navegador elige según el ancho de la pantalla. Rotar el teléfono o abrir
 * la nota en la tablet cambia la elección, y sin esto la foto que el lector ya
 * vio aparecía rota sólo porque se pedía en otra medida. Se devuelve la más
 * grande que haya: achicarla se ve bien, agrandar una chica no.
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

/** Borra las páginas guardadas pero deja la de aviso, que no es de nadie. */
async function olvidarPaginas() {
  const cache = await caches.open(PAGINAS);
  const claves = await cache.keys();
  await Promise.all(
    claves
      .filter((c) => new URL(c.url).pathname !== SIN_CONEXION)
      .map((c) => cache.delete(c)),
  );
}

function esImagen(url) {
  return (
    url.pathname === "/_next/image" ||
    /\.(?:png|jpe?g|webp|avif|gif|svg|ico)$/i.test(url.pathname)
  );
}
