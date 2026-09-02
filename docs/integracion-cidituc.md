# Ingreso con Cidituc

Cidituc (Ciudadano Digital) es la **única** puerta al diario completo. No hay
usuario y contraseña propios, no hay invitados con sesión: `/` y `/login` son
públicas y todo lo demás pide sesión, y la única forma de conseguir una es volver
del derivador municipal con un token que valide el backend de Cidituc.

## Las tres piezas

| Pieza | Dónde vive |
|---|---|
| Derivador (la pantalla de ingreso) | `cidituc.smt.gob.ar` — lo sirve el repo `derivador` |
| Backend de Cidituc | `https://estadisticas.smt.gob.ar:5000` |
| El diario | este repo: botón, callback y sesión propia |

Los nombres de los repos están cruzados: el repo llamado `cidituc` sirve
`ciudaddigital.smt.gob.ar`, que **no** es a donde se manda a la gente.

## El flujo

```
/login → /auth/cidituc/inicio → cidituc.smt.gob.ar/#/login?next=sanmiguelino
       → /auth/cidituc/callback?auth=<token> → valida contra el backend → /diario
```

1. `inicio` guarda un nonce en la cookie `sm_cidituc` (diez minutos) junto con a
   dónde volver, y redirige al derivador.
2. El callback compara el `state` devuelto contra el nonce, valida el token con
   `GET /usuarios/authStatus`, y emite **nuestra** sesión.
3. El token de Cidituc no se guarda: redirige a una URL limpia, así no queda en
   la barra de direcciones, ni en el historial, ni en el `Referer`.

Cidituc dice **quién es** la persona. **Qué puede hacer** lo decide el diario:
el rol sale de la tabla `usuarios` —o de `CIDITUC_ADMINS`, que gana—, nunca del token.

## Dónde está el código

| Qué | Archivo |
|---|---|
| Inicio y callback | [`src/lib/auth/cidituc/flujo.ts`](../src/lib/auth/cidituc/flujo.ts) |
| Validación del token y lectura de la persona | [`src/lib/auth/cidituc/persona.ts`](../src/lib/auth/cidituc/persona.ts) |
| Transporte HTTPS con la CA | [`src/lib/auth/cidituc/transporte.ts`](../src/lib/auth/cidituc/transporte.ts) |
| El intermedio de Sectigo | [`src/lib/auth/cidituc/sectigo-ca.ts`](../src/lib/auth/cidituc/sectigo-ca.ts) |
| Códigos de error y sus textos | [`src/lib/auth/cidituc/errores.ts`](../src/lib/auth/cidituc/errores.ts) |
| Las rutas | `src/app/auth/cidituc/{inicio,callback}/route.ts` |
| Configuración | [`src/lib/auth/config.ts`](../src/lib/auth/config.ts) |

## Variables

| Variable | Para qué |
|---|---|
| `CIDITUC_HABILITADO` | `"1"` prende el ingreso. Cualquier otro valor lo deja apagado |
| `CIDITUC_DERIVADOR_URL` | el **origen solo**; el `#/login` lo agrega `urlDelDerivador()` |
| `CIDITUC_API_URL` | contra qué se valida el token |
| `CIDITUC_CALLBACK_URL` | la URL de retorno, idéntica a la registrada en el derivador |
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
funcionando. Comprueba las variables, reproduce el runtime de Vercel para el
certificado, y consulta el backend.

Corrido el 2026-09-01 contra producción: la cadena sigue incompleta
(`UNABLE_TO_VERIFY_LEAF_SIGNATURE` con las raíces de Node), el intermedio
embebido la completa, y el backend responde 401 al token falso.

Lo que el script **no** puede probar es que el derivador tenga registrado al
diario. Eso vive en otro repositorio: ver más abajo.

## Lo que falta del lado del municipio

1. **Registrar el diario en el repo `derivador`**, en
   `src/components/Login/Login.jsx`. Son dos mapas y se tocan los dos:

   ```js
   const APPS_EXTERNAS = new Map([
     ["sanmiguelino", { nombre: "El Sanmiguelino", callbackUrl: import.meta.env.VITE_APP_SANMIGUELINO_CALLBACK_URL }],
   ]);

   const RESPALDO_CALLBACK = new Map([
     ["sanmiguelino", "https://el-sanmiguelino.vercel.app/auth/cidituc/callback"],
   ]);
   ```

   El respaldo **no es opcional**: Vite hornea las `VITE_*` al compilar y el
   `.env.production` del derivador no las define, así que el bundle desplegado
   sale con `callbackUrl: void 0` para todas las apps y quien gobierna de verdad
   es `RESPALDO_CALLBACK`.

   Después de mergear, comprobar el bundle **desplegado**, no el repo:

   ```bash
   curl -s https://cidituc.smt.gob.ar/ | grep -oE '/assets/index-[^"]+\.js'
   ```

   y buscar `sanmiguelino` adentro de ese `.js`.

2. **Cargar las variables** en `.env.local` y en Vercel. Ver `.env.example`.

## Las trampas que ya costaron horas

- **El certificado.** El backend manda un solo certificado (la hoja
  `*.smt.gob.ar`) y omite el intermedio "Sectigo Public Server Authentication CA
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
- **El `#` del derivador es obligatorio** (HashRouter). Sin él te expulsa a
  `ciudaddigital`. Acá lo agrega `urlDelDerivador()`, así que
  `CIDITUC_DERIVADOR_URL` va con el **origen solo**.
- **No pedir la clave de firma.** Es HS256: tenerla permite fabricar tokens
  válidos para cualquier persona de cualquier app del municipio. La consulta a
  `authStatus` ya es la validación.
- **El callback tiene que ser idéntico al registrado.** Si no, el síntoma engaña:
  el primer intento falla con "la solicitud venció" —la cookie del `state` la
  puso un dominio y el retorno cae en otro— y el segundo entra bien, en el sitio
  equivocado.

## Desarrollo local

El derivador desplegado devuelve `null` para `localhost`, así que **el flujo
completo no se puede reproducir contra producción**. Hay que correr el repo
`derivador` en local con:

```
VITE_APP_SANMIGUELINO_CALLBACK_URL=http://localhost:3000/auth/cidituc/callback
```

Vite incrusta las variables al servir: si la pestaña ya estaba abierta,
`Ctrl+Shift+R`.

Para leer el diario sin ingresar mientras se trabaja en otra cosa, `AUTH_CIDITUC=0`
apaga el gate. Eso deja pasar **sin sesión**, o sea también sin usuario: no es una
forma de entrar al panel.

## Códigos de error

Vuelven como `/login?error=<código>` y se traducen en `errores.ts`.

| Código | Dónde mirar |
|---|---|
| `sin-configurar` | faltan variables en el entorno |
| `sin-token` | el derivador volvió sin `?auth=` |
| `state-ausente` | el derivador no devolvió el `state` (lado de ellos) |
| `state-vencido` | pasaron los diez minutos, o el navegador no mandó la cookie |
| `state-distinto` | dos ingresos pisándose (dos pestañas) |
| `token-invalido` | el backend contestó 401/403 |
| `cuenta-inactiva` | la persona figura dada de baja en Cidituc |
| `no-disponible` | no se llegó al backend, o contestó algo raro — mirar los logs |
| `sesion-fallida` | Cidituc validó pero no pudimos firmar la sesión: falta `SESSION_SECRET` o es corto |
| `bloqueado` | la persona está bloqueada en la tabla `usuarios`. Es nuestra decisión, no de Cidituc |

Que un intento dé `token-invalido` es, en una prueba con un token basura, el
**resultado bueno**: distingue "no llegué al backend" de "el backend contestó".
