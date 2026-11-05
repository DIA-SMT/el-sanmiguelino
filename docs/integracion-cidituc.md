# Ingreso con Cidituc

Cidituc (Ciudadano Digital) es la **única** puerta para participar en el diario.
**Leer es libre** (desde 2026-10-05): la tapa, las notas, las ediciones, el
archivo, el buscador y los comentarios se ven sin ingresar. Ingresar se pide para
comentar, votar, preguntarle a Migue, pedir la voz de Migue y anotarse para
recibirlo en papel (`sesionParaParticipar()` en `src/lib/auth/dal.ts`), y el
panel sigue respondiendo 404 a quien no es administrador.

No hay usuario y contraseña propios, no hay invitados con sesión: la única forma
de conseguir una es volver del login de Ciudad Digital con un token que valide
el backend de Cidituc. Cada "Ingresar" lleva a `/login?volverA=<la página>`, y
al volver de Cidituc se cae en esa misma página —con su `?` y su `#`—
(`src/lib/auth/destino.ts`).

## Las tres piezas

| Pieza | Dónde vive |
|---|---|
| Login de Ciudad Digital (la pantalla de ingreso) | `ciudaddigital.smt.gob.ar` — lo sirve el repo `cidituc` |
| Backend de Cidituc | `https://estadisticas.smt.gob.ar:5000` |
| El diario | este repo: botón, callback y sesión propia |

Del login sólo se usa el autenticador: tener una rama en su `PrivateRoute.jsx`
**no** muestra el diario en ningún listado del portal.

## El flujo

```
/login → /auth/cidituc/inicio → ciudaddigital.smt.gob.ar/#/login?next=sanmiguelino&state=…
       → /auth/cidituc/callback?auth=<token>&state=… → valida contra el backend → /diario
```

1. `inicio` guarda un nonce en la cookie `sm_cidituc` (diez minutos) junto con a
   dónde volver, y redirige al login.
2. El login devuelve al callback según la rama de `sanmiguelino` en
   `src/routes/PrivateRoute.jsx` (repo `cidituc`), con `auth` y con el `state`
   que reenvía esa rama.
3. El callback **exige la cookie** —un enlace al callback armado por otro llega
   sin ella y se rechaza— y compara el `state` **sólo si viene**. Después valida
   el token con `GET /usuarios/authStatus` y emite **nuestra** sesión.
4. El token de Cidituc no se guarda: redirige a una URL limpia, así no queda en
   la barra de direcciones, ni en el historial, ni en el `Referer`.

Cidituc dice **quién es** la persona. **Qué puede hacer** lo decide el diario:
el rol sale de la tabla `usuarios` —o de `CIDITUC_ADMINS`, que gana—, nunca del token.

### El token que el login guarda en el navegador

El login de Ciudad Digital guarda el token en `localStorage` y **no lo borra
nunca**: quien ya entró vuelve sin poner la contraseña, y redirige apenas lo ve,
sin confirmar que siga válido. Lo borra `?logout=1` en la query real, **antes
del `#`** (lo lee `App.jsx`). Por eso hay dos direcciones más, en
[`login.ts`](../src/lib/auth/cidituc/login.ts):

- **El reintento.** Si el callback rechaza el token (`token-invalido`,
  `cuenta-inactiva`) o la persona está `bloqueado`, el botón de `/login` va a
  `/auth/cidituc/inicio?limpiar=1`, que agrega el `?logout=1`. Si no, un token
  vencido vuelve una y otra vez.
- **Cerrar sesión.** Además de borrar nuestra cookie, manda a
  `ciudaddigital.smt.gob.ar/?logout=1#/login?next=sanmiguelino&salir=1`, que
  borra el token y vuelve al **inicio del diario** (destino fijo en
  `PrivateRoute.jsx`, nunca sale de un parámetro). Si no, en una computadora
  compartida la próxima persona entra como la anterior.

## Dónde está el código

| Qué | Archivo |
|---|---|
| Inicio y callback | [`src/lib/auth/cidituc/flujo.ts`](../src/lib/auth/cidituc/flujo.ts) |
| Las URLs del login (ida, reintento y salida) | [`src/lib/auth/cidituc/login.ts`](../src/lib/auth/cidituc/login.ts) |
| Validación del token y lectura de la persona | [`src/lib/auth/cidituc/persona.ts`](../src/lib/auth/cidituc/persona.ts) |
| Transporte HTTPS con la CA | [`src/lib/auth/cidituc/transporte.ts`](../src/lib/auth/cidituc/transporte.ts) |
| El intermedio de Sectigo | [`src/lib/auth/cidituc/sectigo-ca.ts`](../src/lib/auth/cidituc/sectigo-ca.ts) |
| Códigos de error y sus textos | [`src/lib/auth/cidituc/errores.ts`](../src/lib/auth/cidituc/errores.ts) |
| Las rutas | `src/app/auth/cidituc/{inicio,callback}/route.ts`, `src/app/api/auth/logout/route.ts` |
| Configuración | [`src/lib/auth/config.ts`](../src/lib/auth/config.ts) |

## Variables

| Variable | Para qué |
|---|---|
| `CIDITUC_HABILITADO` | `"1"` prende el ingreso. Cualquier otro valor lo deja apagado |
| `CIDITUC_LOGIN_URL` | el **origen solo** (`https://ciudaddigital.smt.gob.ar`); el `#/login` lo agrega `login.ts` |
| `CIDITUC_API_URL` | contra qué se valida el token |
| `CIDITUC_CALLBACK_URL` | la URL de retorno, idéntica a la escrita en `PrivateRoute.jsx` |
| `CIDITUC_CLAVE_APP` | la clave del `?next=`; por defecto `sanmiguelino` |
| `CIDITUC_CA_PEM` | **la válvula de escape del certificado** — ver abajo |
| `CIDITUC_ADMINS` | red anti-lockout: los `id_persona` que administran pase lo que pase, separados por coma |
| `SESSION_SECRET` | firma nuestra sesión. Sin él, el callback corta con `sesion-fallida` |

Detalle completo en `.env.example`.

### Si el backend cambia el certificado y el ingreso se cae

Ese es el momento para el que existe `CIDITUC_CA_PEM`: se le carga el intermedio
nuevo en PEM y **reemplaza al embebido sin necesidad de un deploy**. La app lo
prefiere sobre el de `sectigo-ca.ts` cuando está cargada, y
`npm run verificar:cidituc` prueba exactamente la CA que va a usar la app, así
que se puede confirmar el arreglo antes de tocar producción.

Es la única variable que sirve bajo presión y nadie recuerda que existe. Está acá
para que aparezca en una búsqueda.

## Verificar

```bash
npm run verificar:cidituc
```

Toca la red de verdad y no necesita que nadie preste su cuenta: se apoya en que
un token inventado tiene que dar **401**, y ese 401 *es* la validación
funcionando. Comprueba las variables, arma las tres URLs del login con las
funciones de verdad, reproduce el runtime de Vercel para el certificado, y
consulta el backend.

Corrido el 2026-09-01 contra producción: la cadena seguía incompleta
(`UNABLE_TO_VERIFY_LEAF_SIGNATURE` con las raíces de Node), el intermedio
embebido la completaba, y el backend respondía 401 al token falso. El
2026-11-04 el servidor ya mandaba la cadena completa; el intermedio se deja
igual, porque no estorba y la cadena ya se rompió una vez.

Lo que el script **no** puede probar es que el login publicado tenga la rama del
diario. Eso vive en otro repositorio: ver más abajo.

## Del lado del login de Ciudad Digital

La rama del diario vive en el repo `cidituc`, `src/routes/PrivateRoute.jsx`: una
constante `CALLBACK_SANMIGUELINO` (en local la pisa
`VITE_APP_SANMIGUELINO_CALLBACK_URL`) y dos ramas antes del `else if` final, una
para `salir=1` y otra que devuelve el token con el `state`.

El deploy lo hace el equipo de Cidituc. Después, comprobar el bundle
**publicado**, no el repo:

```bash
curl -s https://ciudaddigital.smt.gob.ar/ | grep -oE '/assets/index-[^"]+\.js'
```

y buscar `sanmiguelino` adentro de ese `.js`. **`CIDITUC_HABILITADO` se prende
recién cuando el bundle publicado lo tenga**: antes, el botón manda a una
pantalla que no sabe volver.

## Las trampas que ya costaron horas

- **El certificado.** El backend mandaba un solo certificado (la hoja
  `*.smt.gob.ar`) y omitía el intermedio "Sectigo Public Server Authentication CA
  DV R36". Windows completa la cadena con su store, así que **desde una máquina
  de desarrollo todo da verde**; el runtime Linux de Vercel muere con
  `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Probar desde la laptop no prueba nada, y
  `curl -k` lo tapa por completo. Por eso el transporte usa `node:https` con
  `ca: [...tls.rootCertificates, intermedio]` y no `fetch`. **Nunca**
  `rejectUnauthorized: false`.
- **El header va sin `Bearer`.** Con prefijo da 401 siempre, también con un token
  bueno. Un 401 permanente casi nunca es el token.
- **Los tipos llegan de MySQL crudo.** El backend hace `SELECT p.*`: un campo con
  columna numérica llega como número y una columna vacía como `null`. Exigir
  `string` descarta personas válidas en silencio.
- **Cada endpoint envuelve distinto.** `/usuarios/authStatus` (ciudadanos)
  devuelve `{ usuarioSinContraseña: {...} }`; `/usuarios/authStatusIA`
  (empleados municipales) devuelve `{ user: {...} }`. Se aceptan las dos y la
  plana.
- **El `#` del login es obligatorio** (HashRouter). Acá lo agrega `login.ts`,
  así que `CIDITUC_LOGIN_URL` va con el **origen solo**. Y el `?logout=1` va
  **antes** del `#`: adentro del fragmento no lo lee nadie.
- **No pedir la clave de firma.** Es HS256: tenerla permite fabricar tokens
  válidos para cualquier persona de cualquier app del municipio. La consulta a
  `authStatus` ya es la validación.
- **El callback tiene que ser idéntico al escrito en `PrivateRoute.jsx`.** Si
  no, el síntoma engaña: el primer intento falla con "la solicitud venció" —la
  cookie del flujo la puso un dominio y el retorno cae en otro— y el segundo
  entra bien, en el sitio equivocado.

## Desarrollo local

El login publicado devuelve al callback de producción, así que **el flujo
completo no se puede reproducir contra él**. Hay que correr el repo `cidituc` en
local (configuración `cidituc` de `.claude/launch.json`, puerto 5175) con:

```
VITE_APP_RUTA_BACK=https://estadisticas.smt.gob.ar:5000
VITE_APP_SANMIGUELINO_CALLBACK_URL=http://localhost:3000/auth/cidituc/callback
```

y el diario con `CIDITUC_LOGIN_URL=http://localhost:5175`. Vite incrusta las
variables al servir: si la pestaña ya estaba abierta, `Ctrl+Shift+R`.

Para probar un token vencido sin cuenta: en `localhost:5175`, poner a mano un
`localStorage.token` falso y apretar "Ingresar". Tiene que volver
`token-invalido`, y el reintento tiene que borrarlo.

El interruptor `AUTH_CIDITUC=0` ya no existe. Servía para leer sin ingresar en
desarrollo, y desde que leer es libre no hace falta; lo único que le quedaba era
inventar un usuario "Desarrollo local" que podía comentar y anotarse en papel
contra la base de producción.

## Códigos de error

Vuelven como `/login?error=<código>` y se traducen en `errores.ts`.

| Código | Dónde mirar |
|---|---|
| `sin-configurar` | faltan variables en el entorno |
| `sin-token` | el login volvió sin `?auth=` |
| `state-vencido` | pasaron los diez minutos, el navegador no mandó la cookie, o el enlace al callback no salió de este navegador |
| `state-distinto` | dos ingresos pisándose (dos pestañas) |
| `token-invalido` | el backend contestó 401/403. El reintento borra el token guardado |
| `cuenta-inactiva` | la persona figura dada de baja en Cidituc. El reintento borra el token guardado |
| `no-disponible` | no se llegó al backend, o contestó algo raro — mirar los logs |
| `sesion-fallida` | Cidituc validó pero no pudimos firmar la sesión: falta `SESSION_SECRET` o es corto |
| `bloqueado` | la persona está bloqueada en la tabla `usuarios`. Es nuestra decisión, no de Cidituc. El reintento borra el token guardado |

Que un intento dé `token-invalido` es, en una prueba con un token basura, el
**resultado bueno**: distingue "no llegué al backend" de "el backend contestó".
