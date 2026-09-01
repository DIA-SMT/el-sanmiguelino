# El Sanmiguelino — Diario digital

Edición digital mensual de la **Municipalidad de San Miguel de Tucumán**,
desarrollada por la **Dirección de IA**. Versión web del impreso, con estética
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

## Accesibilidad

Sitio del Estado argentino → Ley 26.653 / WCAG 2.1 AA. Foco visible, operable
por teclado, `prefers-reduced-motion` y `prefers-color-scheme` respetados,
contraste AA, `eslint-plugin-jsx-a11y` activo. Validar con axe/Lighthouse antes
de cerrar cada pantalla.
