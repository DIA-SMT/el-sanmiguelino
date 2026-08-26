# Panel de administración — plan de ejecución

Estado: **las ocho etapas terminadas.** El diario lee de Supabase, y el panel
escribe notas con sus fotos, programa ediciones, modera comentarios y muestra
qué no supo contestar Migue.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Base de datos | Supabase (Postgres) |
| Rol de admin | Viene de Cidituc |
| Deploy | Vercel |
| Imágenes | Supabase Storage (decidido el 2026-08-26) |
| Moderación | Los comentarios publican directo; el admin los da de baja |

## Etapas

| # | Etapa | ¿Supabase? | Estado |
|---|---|---|---|
| 1 | **Cerrar la casa**: sesión, proxy, config de imágenes | no | **hecha** |
| 2 | Frontera de repo: `EdicionRepo` async con motor mock | no | **hecha** |
| 3 | Formas normalizadas + contrato de moderación | no | **hecha** |
| 4 | Persistencia: Prisma + Supabase + seed | **sí** | **hecha** |
| 5 | Imágenes a Storage | sí | **hecha** |
| 6 | `/admin`: shell + editor de notas | sí | **hecha** |
| 7 | Moderación de comentarios | sí | **hecha** |
| 8 | Migue: registro + pantalla "Lo que no supimos contestar" | sí | **hecha** |

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

**Hecho**: el bucket `diario` existe, y `SUPABASE_URL`, `SUPABASE_BUCKET` y
`SUPABASE_SERVICE_ROLE_KEY` están en `.env.local`. Falta cargarlas en Vercel
antes del próximo deploy. La `service_role` **nunca** con prefijo
`NEXT_PUBLIC_`.

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

## Etapa 3 — lo que quedó hecho

**Formas partidas.** `Nota` se abrió en tres, según lo que cada pantalla usa de
verdad:

- `NotaResumen` — slug, sección, título, bajada, imagen, minutos de lectura.
  Lo que necesitan la portada, el índice, las secciones y el foliado.
- `NotaCompleta` — el resumen más el cuerpo.
- `NotaBuscable` — el resumen más el texto plano del cuerpo, para el buscador.

Contra el mock esto no cambia nada. Contra Postgres, `indice()` deja de traer
el cuerpo de ocho notas para dibujar una lista de títulos.

`minutosLectura` y `textoPlano` se calculan **al proyectar**, en el repo, y no
en cada componente que los muestre. Antes cada pantalla llamaba
`minutosDeLectura(nota.cuerpo)`, lo que obligaba a tener el cuerpo a mano para
mostrar un número: la razón real por la que todo cargaba la nota entera.

**Contrato de moderación.** `Comentario` ahora lleva `estado`, y el repo suma
`listarParaModeracion()`, `darDeBaja()` y `restituir()`, según lo acordado: se
publica directo y el administrador baja después. Un comentario dado de baja no
se borra; queda el rastro de quién y cuándo.

El detalle que importa: **`ultimoDeEdicion()` filtra por estado igual que
`listar()`**. Sin ese segundo filtro, un comentario dado de baja seguía siendo
el que la portada destaca — o sea, el admin lo escondía de la nota y quedaba en
la tapa.

### Cómo se verificó

Se capturó la huella de comportamiento con la etapa aplicada, se hizo `git
stash` para volver a HEAD, se capturó la misma huella, y se comparó: **idéntica
byte a byte** (códigos de las seis rutas, "2 notas" en Cultura, "Página 5 de 9"
en la nota del bacheo, "4 resultados" para *tucuman*, y la respuesta completa
de Migue al índice).

Lo nuevo de la etapa no lo cubre esa huella, porque todavía no hay ruta que lo
ejercite: para eso está `npm run verificar:comentarios`, dieciséis aserciones
sobre el contrato de moderación. En la etapa 4 tiene que seguir pasando **sin
tocarle una línea**; si hay que editarlo, la migración cambió el comportamiento
y no sólo el almacenamiento.

### Lo que la etapa 3 NO hizo

No hay `autor` ni `publicadoEn` en las notas. Faltan los datos reales — firmas
y fechas de una publicación oficial del municipio — y no se inventan.

## Etapa 4 — la mitad que no necesita credenciales

Está escrito y verificado todo lo que se puede verificar sin una base:

- `prisma/schema.prisma` — `Edicion`, `Nota`, `Comentario`, `Voto`.
- `prisma/migrations/20260824000000_inicial/` — el SQL, generado con
  `migrate diff` contra el esquema, no improvisado en la máquina de nadie.
- `prisma/seed.mts` — idempotente y transaccional.
- `src/lib/db.ts` — el cliente, perezoso y singleton.
- `prisma.config.ts` — Prisma 7 sacó las URLs del esquema; van acá.

**Lo que NO está**: el motor Postgres de `EdicionRepo`. Es a propósito. Sin una
base contra la cual correrlo, sería código que no se puede ejecutar ni una vez
antes de commitearlo, y ya hay bastante en este proyecto que no se pudo ver
funcionar.

### Decisiones que quedaron en el esquema

**El cuerpo es `Json`, no una tabla de bloques.** Se lee y se escribe siempre
entero, nunca se consulta por bloque, y el historial de versiones está fuera de
alcance.

**`minutosLectura` y `textoPlano` son columnas.** Es lo que hace que un listado
no traiga ocho cuerpos para mostrar títulos — el punto entero de la etapa 3.
Las calcula `src/lib/derivar.ts`, que es el **mismo** módulo que usa el repo
mock. Si cada uno tuviera su copia, la migración cambiaría los datos sin que
nadie lo note: mismos textos, distintos minutos.

`textoPlano` tiene que seguir siendo exactamente
`cuerpo.map(textoDeBloque).join(" ")` — con la función de `src/lib/derivar`,
no con `b.texto`, porque una ficha no tiene ese campo. El resaltado de resultados corta el fragmento con índices sobre
esa cadena; cambiar el separador corre todos los índices.

**Los comentarios cuelgan del slug, no del id.** Toda la API del repo pide por
slug, así que el listado de una nota es una consulta sola. El admin va a poder
editar el slug, y para eso está el `ON UPDATE CASCADE`.

**No hay tabla de usuarios.** Cidituc es la fuente. El nombre del autor se
guarda desnormalizado en el comentario: es con el que esa persona firmó ese
día, y no debería cambiar retroactivamente en comentarios ya publicados.

**El foliado necesita la columna `orden`.** El orden de un array no sobrevive a
una base; sin ella el número de página cambiaría solo entre requests.

### Enchufada el 2026-08-24

La base está creada en Supabase (`sa-east-1`), migrada y sembrada. Ambas
cadenas van por el **pooler**: 6543 para runtime, 5432 para migraciones. La
"Direct connection" que Supabase ofrece para `DIRECT_URL` es la que NO hay que
usar: quedó sólo por IPv6.

Para reproducirlo en otra máquina: completar `.env.local` desde
`.env.example` y correr `npm run db:deploy` y después `npm run db:seed`.

**Verificado contra la base real**: las ocho notas coinciden campo por campo
con lo que proyecta el mock — títulos, secciones, cuerpo, `minutosLectura` y
`textoPlano`. Sembrar dos veces deja lo mismo que sembrar una (1 edición, 8
notas), que es lo que se afirmaba del `upsert`.

Una trampa que apareció al verificar: comparar los cuerpos con
`JSON.stringify` daba cinco diferencias falsas. Postgres guarda `cuerpo` como
JSONB y **reordena las claves** de cada objeto; un bloque de cita vuelve como
`tipo, autor, cargo, texto`. El orden del array y los valores están intactos,
y el acceso por propiedad en JS no depende del orden, así que a la aplicación
le da igual. Hay que compararlos normalizando las claves.

Otra corrección: `connection_limit=1` en la URL **no hace nada** con el modelo
de driver adapters de Prisma 7 — `pg-pool` lee `max`, y ese `max: 1` está en
`src/lib/db.ts`. La guía anterior de este documento decía lo contrario.

Lo que sigue es el motor Postgres del repo. La prueba de que
quedó bien es que `npm run verificar:comentarios` pase contra él **sin tocarle
una línea**: si hay que editarlo, la migración cambió el comportamiento y no
sólo el almacenamiento.

### Un aviso de `npm audit`

`npm audit` marca 3 vulnerabilidades altas en `deepmerge-ts`. Cuelgan de
`prisma` → `@prisma/config`, y `prisma` es una devDependency: es la CLI, no
llega a `@prisma/client` ni se despliega. El único "arreglo" que ofrece npm es
bajar a Prisma 6, que revierte todo el modelo de configuración de la 7. Se deja
como está, sabiendo por qué.


## Cómo se entra al panel (decidido el 2026-08-26)

**En desarrollo el panel está abierto**: cualquier sesión válida entra a
`/admin`, sin roles. **En producción el panel no existe**: responde 404 y
ninguna variable lo abre mientras el login siga siendo el mock.

Las dos mitades son la misma decisión, y reemplazan al plan anterior de exigir
rol de administrador desde el principio. El motivo: el login de hoy es un POST
sin credenciales que devuelve la misma identidad a todo el que aprieta el
botón, así que pedir un rol sería teatro —la única forma de tener uno sería
inventárselo, y un rol inventado no distingue a nadie de nadie—. Mientras la
identidad no se pueda verificar, o el panel es local o no es.

La excepción vive en **un solo lugar**, `requerirAdmin()` en
`src/lib/auth/dal.ts`, y se borra de un renglón el día que haya SSO real.
`rolDe()` no se tocó: sigue devolviendo siempre "lector", que es la verdad. No
se le enseñó a mentir.

### Dos cosas que aparecieron al verificar

**El orden de las guardias cambia si la ruta es estática.** Con el interruptor
antes de leer la cookie, `requerirAdmin()` cortaba sin tocar APIs dinámicas y
Next horneaba `/admin` como un **404 estático** al compilar: prenderlo después
en runtime no habría servido de nada sin volver a desplegar. Leer la sesión
primero lo vuelve dinámico. En el build se ve como `ƒ /admin` en vez de
`○ /admin`.

**El bloqueo en producción está probado, no deducido.** Se compiló, se levantó
`next start` y con una sesión válida `/admin` devolvió **404** mientras
`/diario` devolvía **200** en la misma corrida. Ese control es lo que hace que
la prueba no sea vacía: sin él, el 404 podría ser una sesión rota.

### Lo que el shell hace y lo que no

Muestra el listado real de la edición —folio, título, sección, minutos y
slug—. Es de **sólo lectura**, y lo dice en pantalla: un botón de "nueva nota"
que no hace nada es peor que no tenerlo. Tampoco tiene barra de secciones,
porque sería un menú de un ítem o links a pantallas que no existen.

El layout llama a `requerirAdmin()` **y la página también**. No es
redundancia: un layout no es un límite de seguridad, y ya nos costó una fuga.


## Etapa 6 — el editor de notas

### Por qué obligó a terminar la etapa 4

El editor no podía existir sobre el motor mock: su almacén es un archivo del
repositorio, así que todo lo que se guardara se perdía al recargar. Enchufar
Postgres dejó de ser una tarea aparte y pasó a ser un requisito.

El cambio de motor se verificó comparando la huella de comportamiento contra
los dos: **idéntica**. Y para que esa prueba no fuera vacía —"idéntico" también
es el resultado de no haber cambiado nada— se cambió un título **sólo en
Postgres**, sin tocar el archivo semilla, y la nota lo mostró.

### El cuerpo se edita como bloques, no como texto rico

El diario tiene cinco formas —párrafo, subtítulo, cita, destacado y ficha— y
cada una se maqueta distinto en la hoja. Un editor de texto libre obligaría a
adivinar cuál es cuál al renderizar, y a la primera nota pegada desde Word el
diario se llena de negritas y tamaños que no existen en el sistema.

Los bloques se mueven con botones y no arrastrando: la WCAG 2.2 (SC 2.5.7)
exige que todo lo que se hace arrastrando se pueda hacer con un solo puntero,
así que el arrastre sería trabajo **encima** de esto, no en lugar de esto.

### Dónde está el límite de confianza

En la Server Action, no en el layout. Una Server Action es un endpoint POST con
su propia URL y **el layout no corre para ella**: una acción sin guardia es una
ruta de escritura abierta con apariencia de protegida. Por eso
`guardarNotaAction` llama a `requerirAdmin()` por su cuenta.

Y valida la forma de lo que recibe aunque el llamador sea nuestro propio
formulario tipado: los tipos de TypeScript no existen en runtime, y el cuerpo
se guarda como Json sin validarse al leer, así que lo que entra por acá es lo
que después se sirve. Cada bloque se devuelve **proyectado** —sólo los campos
que su tipo declara— para que un campo de más no llegue a la base.

Verificado por la interfaz, con control: título vacío, slug con mayúsculas y
cita sin autor se **rechazan** con un mensaje que dice qué arreglar; guardar sin
tocar nada **guarda**. Sin ese último caso, un validador que rechaza todo daría
el mismo resultado.

### Lo que el editor todavía no hace

No hay **borradores**: lo que se guarda sale publicado. No hay **historial de
versiones**. No se **reordena** el foliado ni se **borran** notas —una nota nueva
va al final—. Y la foto se carga por ruta de archivo, no por subida: eso es la
etapa 5.


## Etapa 7 — moderación de comentarios

### El contrato se cobró la deuda de la etapa 3

Las dieciséis aserciones de `scripts/contrato-comentarios.mjs` se escribieron
contra el motor en memoria y **pasan contra Postgres sin cambiar una sola**. Se
corren con dos comandos:

```
npm run verificar:comentarios      # motor en memoria
npm run verificar:comentarios:pg   # Postgres
```

Eso era el punto de haber puesto la frontera del repo en la etapa 2: si para
hacerlo pasar hubiera que editar una aserción, la migración habría cambiado el
comportamiento y no sólo el almacenamiento.

El runner de Postgres **limpia lo que crea**, en un `finally`. No es prolijidad:
la base de desarrollo y la de producción son la misma, así que un comentario de
prueba olvidado aparece publicado en el diario firmado por "Vecino de prueba".

### Por qué el motor recibe el cliente en vez de importarlo

`crearComentariosPostgresRepo(db)` es una fábrica. Si importara `@/lib/db`, ese
import **de valor** no se podría resolver desde Node suelto, y el contrato sólo
se podría verificar contra el mock —justo el motor que no importa—. Los únicos
imports del archivo son de tipo, y esos se borran al quitar los tipos.

### La moderación

Muestra todo, publicado y de baja, ordenado por fecha y no por estado: la
política acordada es que los comentarios se publican directo, así que no hay
cola de aprobación que revisar.

Dar de baja **pide un motivo antes de ejecutar**. Se puede dejar vacío, pero hay
que pasar por el paso: es lo que convierte la baja en una decisión y no en un
reflejo, y el motivo queda guardado junto a quién lo bajó y cuándo. Es lo único
que después permite explicarle a un vecino por qué su comentario no está.

**No hay acción de borrar, y no es un olvido.** Un comentario de baja conserva
su texto y sus votos. Una publicación oficial que esconde la palabra de un
vecino tiene que poder decir quién lo decidió, y eso es imposible sobre una
fila borrada.

El moderador sale de la sesión, nunca del formulario: quién dio de baja algo es
un dato de auditoría, y un campo que manda el cliente no lo es.

### Verificado de punta a punta

Manejando la interfaz: un lector comenta por la API, el comentario aparece en la
nota, el admin lo da de baja desde el panel con un motivo, **desaparece de la
nota**, queda el rastro con quién y por qué, se restituye y **vuelve**.

### Dos cosas que quedaron

La base **no tiene comentarios sembrados**, a propósito: son de personas reales.
Los tres de muestra eran del motor en memoria y no están más.

El rastro muestra el **id** del moderador (`cidituc-demo-001`) y no su nombre,
porque es lo único que se guarda. Para una auditoría el id es lo correcto —los
nombres cambian—, pero cuando exista el SSO conviene resolverlo a nombre al
mostrarlo.


## Etapa 8 — el tablero de Migue

La pantalla que importa es **"Lo que no supimos contestar"**. Cada pregunta sin
respuesta es un tema que los vecinos buscan y el diario no cubre —o que cubre
con palabras que nadie usa—. Es la lista de temas del mes siguiente, escrita por
los lectores. El resto de los números son contexto para leerla: sin saber
cuántas preguntas hubo, quince sin respuesta puede ser un desastre o ser nada.

### El registro no guarda quién preguntó

Decisión deliberada, y está en el esquema. Atar cada consulta a un vecino
identificado convertiría un registro de calidad en un **historial de consultas
de una persona ante el municipio**, que es otra cosa y necesitaría otro
permiso. Para saber qué falta cubrir alcanza con el texto y el resultado.

### El agrupado es por texto, no por significado

"Cuándo abre el registro civil" y "horario del registro civil" aparecen como dos
filas, y la pantalla lo dice. La agrupación semántica está fuera de alcance a
propósito: mal hecha esconde temas, que es exactamente lo contrario de para lo
que existe el tablero.

### Anotar nunca puede tumbar el chat

`registrarConsulta()` se traga sus errores: que el vecino reciba su respuesta
vale más que que nosotros tengamos la estadística.

Pero en **desarrollo** avisa por consola, y eso salió de tropezar: la primera
prueba no registró nada y el `catch` mudo lo escondió —el servidor tenía el
cliente de Prisma de antes de la migración—. Un registro que puede estar roto
semanas sin que nadie se entere no sirve.

Se **espera** el insert en vez de dispararlo y seguir: en serverless la función
puede terminar apenas manda la respuesta, y una promesa suelta se cancela a
mitad de camino.

### Las cuatro salidas pasan por un solo lugar

Antes había cuatro `return NextResponse.json(...)` sueltos en la ruta. Con el
registro serían cuatro oportunidades de olvidarse de anotar una, y la que se
olvidaría es justo la que importa: el caso "no supe contestar" es el último y el
más fácil de pasar por alto.

## El cambio de edición: una fecha, no un trabajo programado

El diario sale una vez por mes. La edición que se sirve es **la más reciente
cuya fecha de publicación ya pasó**, calculado en cada request.

### Por qué no un cron

Lo obvio sería un trabajo que el día 1 dé vuelta una bandera. Es la opción
frágil: si ese día el trabajo no corre —falla el deploy, se cae el proveedor,
alguien renombró algo— el diario se queda en el mes pasado y **nadie se entera
hasta que un vecino lo dice**. Es un estado que se puede trabar, y que también
puede dispararse dos veces.

Una fecha no necesita que corra nada. Si el sitio está en pie, sirve la edición
correcta. Volver atrás es cambiar la fecha. Y como todas las páginas del diario
son dinámicas (`ƒ` en el build), el cambio se ve en el mismo minuto sin caché
que romper.

### La hora es de Tucumán

"El 1 de septiembre" son las 00:00 **en Tucumán**, no en UTC. Con tres horas de
por medio, una edición cargada sin cuidado sale el 31 de agosto a las 21.

`src/lib/fecha-edicion.ts` le pregunta el desfase al sistema **para esa fecha**,
en vez de restar tres horas a mano: Argentina hoy no cambia la hora pero ya lo
hizo y podría volver a hacerlo por decreto, y una constante quedaría muda
mientras las ediciones empiezan a salir corridas.

### La vista previa es el diario, no una pantalla aparte

"Verla en el diario" pone una edición en foco y el **diario entero** se la
muestra: tapa, notas, buscador, Migue. Con el mismo código que ve el lector.

Una vista previa dibujada con su propio código te muestra que todo está bien y
el día que sale aparece el problema igual, porque lo que probaste no era lo que
el lector iba a ver.

La cookie sola no da acceso: `edicionEnFoco()` verifica que quien pide sea
administrador **en cada request**. Y arriba va una barra de aviso con el color
de acento, no discreta: el riesgo de una vista previa idéntica al diario real
es creer que uno está mirando lo publicado cuando no.

### Dos cosas que aparecieron al probar

**Las notas de una edición futura se leían por su dirección.** `nota()` buscaba
por slug global mientras que `indice()` filtraba por edición, así que la nota de
septiembre no aparecía en ningún lado pero se abría entrando a su URL. Todo el
sentido de preparar la edición con anticipación era que no se filtrara. Ahora
las dos consultas se acotan a la edición servida.

**Una edición vacía que llega a su fecha rompía la tapa.** Se programa
septiembre, no se alcanzan a cargar las notas, llega el día 1 y `/diario`
explota. Ahora la elección automática exige que la edición tenga al menos una
nota: si septiembre está vacío, el diario sigue mostrando agosto. Ningún diario
saca un número en blanco porque se le venció la fecha. No esconde el error —el
panel sigue marcando "En la calle" sobre agosto, que es donde tiene que verse—.

### Verificado

Se creó septiembre con fecha 1/9, se comprobó que el lector seguía viendo
agosto, se movió la fecha al pasado y el lector pasó a ver septiembre **sin que
corriera ningún trabajo**, y se volvió atrás cambiando la fecha. La vista previa
se probó manejando la interfaz: enfocar, ver la edición futura con su barra,
abrir una de sus notas y salir.

### El archivo

Los números anteriores quedan accesibles. `/archivo` los lista y
`/edicion/<slug>` muestra el sumario de cada uno; la edición en la calle
redirige a `/diario`, que es el diario de verdad con su paso de página.

Los sumarios no replican la tapa a propósito. Un archivo es una tabla de
contenidos: quien entra viene a buscar una nota que recuerda, no a leer la tapa
de nuevo — y replicarla sería una segunda tapa que mantener al día.

**La regla de visibilidad cambió, y es la que hace posible el archivo.** Una
nota es leíble si **su edición está publicada**, no si pertenece a la que se
está sirviendo. Con la regla anterior —acotar a la edición servida, que fue el
primer arreglo de la fuga— agosto se volvía ilegible en cuanto salía
septiembre. Con la nueva, agosto sigue vivo y septiembre sigue oculto hasta el
día 1.

**El foliado se cuenta sobre la edición de la nota.** Verificado con las dos
conviviendo: la nota de agosto dice "Página 5 de 9" —sobre las 8 notas de
agosto— mientras la de septiembre dice "Página 2 de 2", con septiembre en la
calle.

El lector que está leyendo justo cuando cambia el mes ya no pierde nada: su
nota sigue en su dirección y el pie del pliego sigue contando sobre su edición.
Lo único que se apaga son las flechas del mando, porque esa nota ya no está en
el índice de la edición en curso —y apagarlas es correcto: llevarían a otro
mes—.


## Etapa 5 — las fotos

Se sube desde el editor de la nota. La foto va a Supabase Storage y en el campo
del archivo queda su dirección; la nota se guarda después, con el botón. Las dos
cosas están separadas a propósito: subir una foto y arrepentirse no deja la nota
a medio cambiar.

### Por qué no el SDK de Supabase

`src/lib/storage.ts` habla la API REST con `fetch`. Son treinta líneas contra
un paquete entero, y sobre todo: el SDK está pensado para correr también en el
navegador, así que alguna vez alguien lo importa desde un componente cliente y
se lleva la `service_role` al bundle. **Lo que no está instalado no se importa
por accidente.** El módulo además tiene `import "server-only"`, que convierte
ese error en un error de compilación.

Verificado después de compilar: la clave aparece en **0** archivos de
`.next/static`.

### La subida pasa por el servidor

El navegador nunca ve la clave. Subir directo desde el cliente exigiría dársela,
y la `service_role` no es una llave de subida: es una llave maestra del
proyecto entero, base incluida.

### El tipo se valida por los bytes, no por lo que diga el archivo

El `type` que manda el navegador lo pone quien sube y puede decir cualquier
cosa. Se miran las firmas reales de JPG, PNG y WebP. Verificado con un archivo
de texto renombrado a `.jpg`: **rechazado**.

El nombre del archivo también lo elegimos nosotros —slug de la nota más un
sufijo al azar—: un nombre que el usuario controla dentro de una ruta es la
forma clásica de escribir donde no corresponde. El sufijo además evita pisar la
foto anterior al cambiarla.

### El bucket

`diario`, público de lectura, con tope de 8 MB y sólo JPG/PNG/WebP **en el
propio bucket**, además de lo que valida el código. Público porque las fotos de
un diario se ven sin iniciar sesión y porque el optimizador de imágenes de Next
las busca sin credenciales.

`next.config.ts` acota `remotePatterns` al **bucket**, no al host: sin el
`pathname`, cualquier archivo de cualquier bucket del proyecto pasaría por el
optimizador, que es un proxy público. Un comodín ahí convierte al sitio en un
servidor de imágenes ajeno.

### Verificado

Subida real desde la interfaz: el archivo mentiroso se rechaza, la foto de
verdad sube, la nota se guarda y la imagen se sirve **a través del optimizador
de Next** (`/_next/image?url=…`) con las dimensiones correctas — que es la
prueba de que el patrón remoto está bien puesto. Después se restauró la nota y
se vació el bucket.


## Migue con modelo (OpenRouter)

Migue responde con `openai/gpt-4o-mini` vía OpenRouter, y **sólo sobre las
notas de la edición**. Las notas van en el prompt y se le prohíbe salir de ahí.

No es una preferencia de estilo. Es una publicación oficial de un municipio: un
modelo que improvisa un horario de atención o un teléfono está poniendo
información falsa en boca del Estado. Cuando algo no está en la edición, la
respuesta correcta es decir que no está.

### Tres caminos, en orden

1. **Saludo e índice** se responden sin modelo. Son deterministas —la lista de
   notas es exacta— y así no se paga una llamada por cada "hola".
2. **Todo lo demás va al modelo**, con las notas en el contexto.
3. **Si el modelo no está** —sin clave, caído, lento— se cae al buscador por
   palabras clave de siempre. Que Migue conteste peor es mejor que no conteste.

### Cómo sabe el tablero que no supo contestar

Se le pide al modelo una **marca literal** (`[SIN_RESPUESTA]`) en vez de
adivinar por frases. Interpretar "no encontré" o "no tengo información" es
frágil, y de ese dato depende toda la pantalla de "Lo que no supimos contestar".
La marca se saca antes de mostrar el texto.

Lo mismo con la fuente: el modelo termina con `FUENTE: <slug>` y **ese slug se
verifica contra la edición**. Si se lo inventó o citó uno viejo, se descarta —un
enlace a una nota que no existe es peor que no enlazar—.

### Contexto y costo

Se mandan las notas ordenadas por puntaje hasta 24.000 caracteres. Con ocho
notas entran todas (unos 15.000) y Migue puede contestar sobre cualquiera. El
tope existe para cuando la edición crezca: lo que se recorta es siempre lo menos
relacionado con la pregunta.

`max_tokens` 400 y `temperature` 0.2: no se le pide creatividad, se le pide
que no se aparte de las notas. Y hay un timeout de 12 segundos — un chat que
tarda quince ya perdió a quien preguntó.

### Verificado contra un OpenRouter de mentira

La URL es configurable (`OPENROUTER_URL`), lo que sirve para poner un proxy
del municipio delante y además permitió probar el camino entero sin gastar en
llamadas. Los cuatro casos:

| Caso | Resultado |
|---|---|
| El modelo contesta y cita una nota | Responde y enlaza, registrado como `nota` |
| El modelo declara que no sabe | La marca se saca del texto, registrado como `sin_respuesta` |
| El modelo cita un slug inventado | Se descarta el enlace |
| OpenRouter devuelve 500 | Cae al buscador por palabras clave |

Y sin clave, el comportamiento de Migue es **exactamente el de antes**.

### Falta

Cargar `OPENROUTER_API_KEY` en `.env.local` y en Vercel. Sin ella no se rompe
nada: Migue sigue con el buscador, y el tablero lo dice en pantalla.

### El tope de consultas

Hay dos topes por hora: **20 por persona** y **300 entre todos**. El global es
el techo de gasto de verdad: si mil vecinos preguntan veinte veces cada uno, el
tope individual no protege nada.

**Pasarse no rompe a Migue.** Quien llega al tope sigue recibiendo respuesta,
con el buscador por palabras clave, que no cuesta nada. Un asistente que se
planta y dice "no puedo atenderte" es peor experiencia que uno que contesta un
poco peor, y además el vecino no tiene por qué enterarse de nuestros costos.

**El contador incrementa primero y pregunta después**, en una sola sentencia
atómica. Al revés —leer, decidir, escribir— dos pedidos simultáneos leen el
mismo número y los dos pasan: con veinte pestañas abiertas el tope no existiría.

**La tabla no guarda quién preguntó**: guarda un hash del id salado con
`SESSION_SECRET`. El registro de preguntas es anónimo a propósito, y meter acá
el id lo volvería identificable por cruce de horarios. La sal importa porque los
ids de Cidituc son un espacio chico: un hash pelado se revierte probando. Las
filas se limpian solas.

Si la base no responde, deja pasar: el tope protege el presupuesto, no la
seguridad, y no vale que una caída de Postgres apague a Migue.

Verificado con el tope en 3: las tres primeras fueron al modelo y de ahí en más
al buscador, sin cortar. Y se comprobó que en la tabla figura el hash y no el
id.
