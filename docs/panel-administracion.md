# Panel de administración — plan de ejecución

Estado: **etapas 1 y 2 terminadas**. Las etapas 3 en adelante están pendientes.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Base de datos | Supabase (Postgres) |
| Rol de admin | Viene de Cidituc |
| Deploy / imágenes | Vercel + blob storage |
| Moderación | Los comentarios publican directo; el admin los da de baja |

## Etapas

| # | Etapa | ¿Supabase? | Estado |
|---|---|---|---|
| 1 | **Cerrar la casa**: sesión, proxy, config de imágenes | no | **hecha** |
| 2 | Frontera de repo: `EdicionRepo` async con motor mock | no | **hecha** |
| 3 | Formas normalizadas + contrato de moderación | no | pendiente |
| 4 | Persistencia: Prisma + Supabase + seed | **sí** | pendiente |
| 5 | Imágenes a Storage | sí | pendiente |
| 6 | `/admin`: shell + editor de notas | sí | pendiente |
| 7 | Moderación de comentarios | sí | pendiente |
| 8 | Migue: registro + pantalla "Lo que no supimos contestar" | sí | pendiente |

Las etapas 2 y 3 son la mayor parte del trabajo mecánico y se hacen **sin
credenciales**: convertir a async los consumidores de `edicionActual` contra
datos que ya funcionan, para que cuando llegue la etapa 4 el único cambio sea
el motor.

## Postura de seguridad del admin

Tres llaves independientes, todas cerradas por default, en AND:

| Llave | Default | Efecto si falta |
|---|---|---|
| `SESSION_SECRET` | ninguno | en producción la app **tira**: nada se firma |
| `AUTH_CIDITUC_MODO` | mock | `rolDe()` devuelve `"lector"` sin mirar nada más |
| `ADMIN_HABILITADO` | sin setear | `/admin/**` responde 404, no redirect |

Desplegar el repo tal cual, sin tocar variables: `/admin` es 404 para todos.
**Ninguna combinación de variables abre el panel mientras el login sea el mock**,
porque `AUTH_CIDITUC_MODO=sso` exige además un `CIDITUC_CLIENT_SECRET` real que
sólo emite el equipo de Cidituc. Un interruptor que cualquiera puede prender no
es un control de seguridad; una credencial que no se tiene, sí.

Además: **`/admin` no se despliega a producción en esta primera vuelta**, ni con
feature flag. Y conviene Vercel Deployment Protection con contraseña sobre
Preview hasta el lanzamiento — es el único control que no depende de que nadie
se olvide de una variable.

El día que exista el SSO, `POST /api/auth/login` **se borra**, no se deja "por
las dudas".

### Por qué el rol NO va adentro del token

Un permiso guardado en un token firmado es permanente, no revocable y no
auditable: bajar a alguien de admin en Cidituc no haría nada hasta rotar
`SESSION_SECRET`, y rotarlo desloguea a todos los lectores. El token lleva
identidad y vencimiento; la autorización se resuelve por consulta del lado
servidor en cada request, memoizada con `cache()`.

## Lo que hay que hacer del lado del usuario

**Antes de la etapa 4**: crear el proyecto en Supabase y poner en `.env.local`
`DATABASE_URL` (pooler, 6543, con `?pgbouncer=true&connection_limit=1`) y
`DIRECT_URL` (mismo host del pooler, 5432). Ver `.env.example`.

**Antes de la etapa 5**: crear el bucket y poner `SUPABASE_URL` y
`SUPABASE_SERVICE_ROLE_KEY`. Esta última **nunca** con prefijo `NEXT_PUBLIC_`.

**Bloqueante externo**: la spec del SSO de Cidituc. Sin ella no se sabe si el rol
viene como claim, como grupo, o si hay que consultarlo aparte — y de eso depende
si "el rol viene de Cidituc" es cumplible tal cual.

## Fuera de alcance en esta primera vuelta

SSO real · `/admin` en producción · multi-edición y archivo histórico ·
búsqueda con `tsvector` (el resaltado actual depende de índices carácter a
carácter y habría que rehacerlo) · agrupación semántica de preguntas de Migue ·
drag & drop para reordenar (WCAG 2.2 SC 2.5.7 exige igual la alternativa de un
solo puntero) · autoguardado en el editor · historial de versiones de notas ·
👍/👎 en Migue · recorte con punto focal · rate limit y antispam ·
`cacheComponents` / `use cache` (toca de lleno el paso de página con view
transitions) · contadores de votos desnormalizados.

## Etapa 1 — lo que quedó hecho

- `src/lib/auth/cookie.ts` (nuevo): nombre de cookie, versión de token, TTL y
  `cookieMuerta()` — chequeo **estructural**, sin HMAC, para que el proxy no
  arrastre `node:crypto`.
- `session.ts`: secreto obligatorio en producción (antes había un fallback
  escrito en el repo), token con `v` + `exp`, TTL de 8 h, proyección explícita.
- `proxy.ts`: `/api/*` ya no está fuera del gate; borra la cookie muerta para
  romper el bucle `/login` ⇄ `/diario`; matcher con `$` para cerrar el bypass
  de `/admin/x.png/borrar`.
- `login/route.ts`: chequeo de `Origin`, y un solo número de vencimiento.
- `config.ts`: `ES_SSO_REAL` y `ADMIN_HABILITADO`.
- `roles.ts` (nuevo): `rolDe()` memoizado, devuelve `"lector"` mientras no haya SSO.
- `dal.ts` (nuevo): `usuarioActual`, `sesionActual`, `requerirAdmin`, `conAdmin`.
- `(diario)/layout.tsx`: **verifica sesión por su cuenta**. Ver abajo.
- `next.config.ts`: `images.qualities` (lista blanca obligatoria en v16).
- `imagenes.ts`: acepta URLs remotas sin cambiar firma ni llamadores.
- `.env.example` commiteado, con `!.env.example` en `.gitignore`.

### La fuga que apareció al verificar

Con una cookie de firma inválida pero bien formada —que cualquiera puede
fabricar, porque el proxy sólo mira la estructura— `/diario` devolvía **200 con
el índice completo de la edición**: los títulos viajan en los `aria-label` de
las flechas y en las props serializadas de `MandoPaginas`, que vive en el
layout. El layout se renderiza y se transmite **antes** que la página, así que
el `redirect()` de la página no lo cubría.

**Regla que queda**: el componente que tiene los datos es el que tiene que pedir
permiso. Un layout no es un límite de seguridad — no se re-ejecuta en las
navegaciones del cliente y no corre para Server Actions ni route handlers.

## Etapa 2 — lo que quedó hecho

`src/lib/repos/edicion.ts` define `EdicionRepo` con firmas **async desde el
primer día**, aunque el motor de hoy responda al instante. Ese es el punto: el
costo caro de esta migración no es leer de Postgres, es volver asíncronos los
componentes que eran síncronos y arrastrar el `await` por el árbol. Se paga
contra datos que ya funcionan, no en el mismo commit en que se estrena la base.

`getEdicion()` y `getNota()` van envueltas en `cache()` de React: una página del
diario las pide desde el layout, el masthead, la página y dos o tres
componentes, y sin eso serían cinco viajes a la base por request.

`src/lib/repos/edicion-mock.ts` es el único archivo que puede importar
`edicionActual`. **Ese es el portón**: mientras `git grep edicionActual` no
devuelva nada fuera de ahí, cambiar de motor es cambiar una línea.

Pasaron a async: `HojaDiario`, `NotasRelacionadas`, los tres componentes de
`landing/` y la landing. `Masthead` no hizo falta: ya recibía la edición por
prop.

Verificado que el comportamiento no cambió: mismos conteos por sección, mismo
foliado, mismos resultados de búsqueda, Migue responde igual.

### Lo que la etapa 2 NO hizo

Sigue existiendo una sola forma `Nota`, con el cuerpo entero, aunque las páginas
de listado no lo necesiten. Separar `NotaResumen` de `NotaCompleta` es la etapa
3, y recién ahí importa: con el mock, traer el cuerpo de más es gratis.
