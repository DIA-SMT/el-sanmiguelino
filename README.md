# El Sanmiguelino — Diario digital

Edición digital mensual de la **Municipalidad de San Miguel de Tucumán**,
desarrollada por la **Subsecretaría de Gestión Estratégica y Documentación**. Versión web del impreso, con estética
de diario: masthead serif, cuerpo a columnas, letra capitular, filetes y modo
claro/oscuro.

## Correr en desarrollo

```bash
npm install
npm run dev
```

Abrir http://localhost:3000.

## Stack

Next.js (App Router) + TypeScript · Tailwind CSS v4 con design tokens en
`src/app/globals.css` · Radix Primitives · Motion · Lucide · Playfair Display /
Source Serif 4 / Inter.

## Estado de integraciones (mocks detrás de adapters)

| Pieza | Estado | Dónde se conecta lo real |
| --- | --- | --- |
| **Ingreso con Cidituc** | **Real, sin mock.** Botón → derivador → callback → validación contra `estadisticas.smt.gob.ar` → sesión propia. Verificar con `npm run verificar:cidituc` | Falta registrar el diario en el repo `derivador` y cargar las variables. Ver [docs/integracion-cidituc.md](docs/integracion-cidituc.md) |
| **Chatbot Migue** | Mock (retrieval naive sobre la edición) | `src/app/api/migue/route.ts` — proxyear el motor Migue existente o instancia con RAG |
| **Comentarios y votos** | In-memory con seed | `src/lib/repos/comentarios.ts` — reemplazar por Postgres + Prisma; definir política de moderación con el municipio |
| **Contenido de la edición** | Mock en `src/lib/data/edicion-actual.ts` | Repo de ediciones cuando haya persistencia |

## Aplicación instalable (PWA)

El diario se puede instalar en el teléfono o la computadora. Las páginas del
diario que se abren con conexión quedan guardadas (hasta 40, se van las usadas
hace más tiempo) y se pueden volver a abrir sin señal.

| Pieza | Dónde |
| --- | --- |
| Manifest (nombre, colores, arranque en `/diario`) | `src/app/manifest.ts` |
| Iconos de la app (192, 512 y "maskable" para Android) | `public/iconos/`, generados con `npm run marca:iconos` |
| Service worker: páginas primero la red, chunks y fotos primero la caché | `public/sw.js` |
| Aviso sin conexión | `src/app/sin-conexion/` |
| Registro, y aviso al worker de qué ruta se muestra | `src/components/pwa/puente-service-worker.tsx` |
| Marca de "la página se dibujó entera, se puede guardar" | `data-sin-conexion` en `src/components/hoja-diario.tsx` |

Las cachés van atadas a cada build (`VERSION_SITIO` en `next.config.ts`): un
deploy nuevo borra lo guardado por el anterior. Las páginas guardadas se borran
al cerrar sesión y cada vez que se muestra /login, que es lo que ve quien tiene
la sesión vencida. El manifest, `/sw.js` y `/sin-conexion` quedan fuera del
gate de Cidituc en `src/proxy.ts`. Sin eso el sitio deja de ser instalable y no
aparece ningún error.

**Probarlo:** con `npm run build && npm run start`, o con `next dev` poniendo
`NEXT_PUBLIC_PWA_EN_DESARROLLO=1`. Para simular la falta de señal, usar
DevTools → Network → Offline, o apagar el servidor. Con `next dev` y sin
servidor las páginas guardadas se ven pero no hidratan, así que el botón
Reintentar sólo se puede probar con un build (la documentación de Next también
avisa que dev no es referencia para el comportamiento sin conexión).

## Accesibilidad

Sitio del Estado argentino → Ley 26.653 / WCAG 2.1 AA. Foco visible, operable
por teclado, `prefers-reduced-motion` y `prefers-color-scheme` respetados,
contraste AA, `eslint-plugin-jsx-a11y` activo. Validar con axe/Lighthouse antes
de cerrar cada pantalla.
