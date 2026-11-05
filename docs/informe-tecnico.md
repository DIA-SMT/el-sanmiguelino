# Informe técnico — lo que el panel ya no muestra

Escrito el 2026-09-07, cuando se sacaron de `/admin` los carteles que explicaban
con qué está armado el diario.

**Por qué existe este documento.** El panel tenía repartidas explicaciones de la
máquina: con qué modelo contesta Migue, qué variable de entorno le falta a esta
computadora, cuántas consultas van en la hora y cuál es el tope, qué pasa el día
1 de cada mes. Nada de eso es falso; lo que pasa es que quien entra al panel
entra a decidir **qué nota escribir, qué comentario bajar o cuándo sale la
edición**, y para eso el nombre de un modelo no ayuda: obliga a interpretar la
infraestructura para leer un número. Peor, invitaba a leer mal — el cartel del
modelo describía *la computadora donde corre el panel*, así que decía "no hay
modelo" mientras Migue contestaba perfecto en el sitio publicado.

Así que la información no se tiró: se mudó acá, que es donde la busca quien de
verdad la necesita. **Si algo de esto vuelve a aparecer en una pantalla del
panel, es una regresión.**

---

## Migue

**Con qué contesta.** Si hay clave de OpenRouter configurada, Migue arma la
respuesta con un modelo sobre las notas de la edición. Si no la hay, contesta con
el buscador por palabras clave del propio diario. Las dos formas funcionan; la
segunda es peor y no cuesta nada.

| Cosa | Dónde se configura | Valor por defecto |
| --- | --- | --- |
| La clave | `OPENROUTER_API_KEY` | sin default: sin ella, buscador |
| El modelo | `OPENROUTER_MODEL` | `openai/gpt-4o-mini` |
| A dónde se le pregunta | `OPENROUTER_URL` | la API de OpenRouter |
| Tope por persona y hora | `MIGUE_TOPE_PERSONA` | 20 |
| Tope entre todos, por hora | `MIGUE_TOPE_GLOBAL` | 300 |

En desarrollo esas variables van en `.env.local`; en producción se cargan en
Vercel. **Son dos lugares distintos**: que en una máquina falte la clave no dice
nada de lo que está pasando en el sitio publicado, y confundir las dos cosas fue
exactamente el error que motivó sacar el cartel.

**Los topes son un techo de gasto, no un antiabuso.** Cada pregunta que llega al
modelo cuesta plata del municipio. Cuando alguien se pasa, Migue **no se planta**:
sigue contestando con el buscador, que es gratis. El vecino no tiene por qué
enterarse de nuestros costos.

La lectura en voz alta anota su consumo en la misma tabla pero con una clave
propia, así que no le come las llamadas a Migue ni aparece como una persona más
en el tablero.

**Lo que el registro de consultas NO guarda: quién preguntó.** Esto sí sigue
dicho en la pantalla, y tiene que seguir: no es una explicación de la máquina
sino una decisión sobre datos de vecinos. Atar cada pregunta a una persona
identificada convertiría un registro de calidad en el historial de consultas de
un vecino ante el municipio.

## La base de datos

| Cosa | Variable | Puerto |
| --- | --- | --- |
| Runtime (la app) | `DATABASE_URL` — el pooler de Supabase | 6543 |
| Migraciones (la CLI de Prisma) | `DIRECT_URL` — conexión directa | 5432 |

Son dos porque el pooler en modo transacción no soporta el DDL ni los advisory
locks que `prisma migrate` necesita. El tamaño del pool se ajusta con
`DB_POOL_MAX` (por defecto 3).

**Sin `DATABASE_URL`**, el diario sirve el archivo de ejemplo y el panel se
degrada a sólo lectura: se puede mirar, no guardar. En producción eso no es un
modo degradado sino un error — el arranque falla a propósito, porque un
comentario de un vecino que se pierde en cada reinicio es peor que una página
que no carga.

## Quién administra

Tres candados en AND: sesión validada contra el backend municipal, el
`id_persona` en la lista `CIDITUC_ADMINS`, y `ADMIN_HABILITADO=1`.

- **`CIDITUC_ADMINS` es la red anti-lockout permanente.** Gana antes de tocar la
  base y también sobre el bloqueo. Las dos cosas son deliberadas: una red que
  necesita que la base responda no es una red, y si ganara sólo sobre el rol, a
  alguien de la lista lo podrían bloquear desde la pantalla y no tendría cómo
  entrar a desbloquearse.
- Consecuencia visible en el panel: a quien esté en esa lista, la pantalla de
  Usuarios **no le ofrece cambiar el rol**, porque la escritura no tendría
  ningún efecto. El mensaje que se muestra dice que el rol viene "de la
  configuración del sistema" y no nombra la variable.
- **El rol no viaja dentro del token de sesión.** Un permiso dentro de un token
  firmado es permanente, no revocable y no auditable: bajar a alguien de admin
  no haría nada hasta rotar `SESSION_SECRET`, y rotarlo desloguea a todos los
  lectores.
- Cidituc devuelve **identidad y nada más**. No hay roles ni grupos del lado del
  municipio; qué puede hacer cada uno lo decide este diario.

Para trabajar en el panel en local hay que poner el `id_persona` propio en
`CIDITUC_ADMINS` de `.env.local`. Si `/admin` da 404 en desarrollo, es eso.

## Cuándo sale una edición

El diario sirve **la edición más reciente cuya fecha de publicación ya pasó**, y
eso se calcula en cada request. No hay ningún trabajo programado que pueda no
correr el día 1, ni bandera que alguien tenga que dar vuelta: si el sitio está en
pie, sirve la edición correcta. Volver atrás es cambiar la fecha.

Las fechas se escriben y se muestran en hora de Tucumán y se guardan en UTC. Con
tres horas de por medio, una edición mal cargada saldría la noche anterior.

El número del ejemplar se puede editar desde la ficha de cada edición. No puede
repetirse dentro del mismo año: lo impide una restricción de la base, y el panel
lo comprueba antes para poder explicarlo con el mes que ya lo tiene.

## Comentarios

Tres estados: **publicado** (nace así, se publican directo como se acordó con el
municipio), **en revisión** (fuera del diario mientras se decide) y **de baja**
(fuera del diario, con motivo y con quién lo decidió).

Los motivos de baja están tipificados: insulto o agresión, datos personales, spam
o publicidad, fuera de tema, otro. Van con un detalle libre opcional y se guardan
como una sola cadena, `"Motivo · detalle"`.

**Borrar existe y borra de verdad**, con los votos del comentario. Sólo se puede
borrar lo que ya está de baja: primero queda escrito por qué se lo sacó y recién
después se decide que el diario no tiene por qué conservar eso. Lo comprueba el
repositorio, no la pantalla.

Nada de esto le corta la lectura a nadie: el bloqueo de una cuenta impide
comentar, votar y abrir sesión nueva, pero quien ya tenga una sesión abierta
puede seguir leyendo el diario hasta que se le venza (8 horas). Chequearlo en
cada vista de página costaría una consulta por cada lector y por cada página.

## El registro de auditoría

Desde el 2026-09-07, **toda escritura del panel deja un renglón** en
`registro_panel`, y se lee en `/admin/auditoria`. También lo deja la descarga del
padrón de suscripciones, que es una lectura pero saca datos personales del
sistema.

Lo que hay que saber para usarlo:

- Guarda quién, qué y cuándo. **No guarda el contenido de lo moderado**: de un
  comentario borrado quedan la nota, quién lo escribió, sus votos y el motivo de
  la baja, nunca el texto.
- No se limpia, y no tiene por qué: son unos pocos renglones por día.
- No ve lo que pasa fuera del panel. Una fila borrada con acceso directo a la
  base no deja rastro acá; eso sólo lo tiene el registro de Supabase.
- Si se agrega una Server Action y no llama a `anotar()`, queda un hueco
  silencioso. La regla está escrita en `src/lib/repos/auditoria.ts`.

## Newsletter

**Cómo sale el correo.** Por el SMTP de Google (`smtp.gmail.com:465`) con la
cuenta `sanmiguelino@smt.gob.ar` y una contraseña de aplicación
(`CORREO_SMTP_USUARIO`, `CORREO_SMTP_CLAVE`). smt.gob.ar está en Google
Workspace y su SPF ya incluye `_spf.google.com`: no hace falta tocar el DNS.

**Tres llaves, en este orden** (`src/lib/correo/enviar.ts`):

| Situación | Pruebas del panel | Confirmaciones y newsletter a la lista |
| --- | --- | --- |
| Sin `CORREO_SMTP_*` | Simuladas | Simuladas |
| Con `CORREO_SMTP_*` | Salen | Simuladas ("de práctica") |
| Con `CORREO_SMTP_*` y `NEWSLETTER_ENVIO_REAL=1` | Salen | Salen |

`NEWSLETTER_ENVIO_REAL=1` es la autorización explícita del municipio para
escribirles a los vecinos. En modo de práctica la cola recorre la lista entera
y anota a cada destinatario como "simulado": se prueba todo el circuito sin
mandar nada.

### La cola

Programar no manda nada: deja el newsletter en `programado` con su hora
(«Enviar ahora» es programar para este momento). Lo manda la cola,
`procesarCola()` en `src/lib/newsletter/envios.ts`, que corre una vez por
minuto desde `POST /api/newsletter/procesar`:

1. Los destinatarios que quedaron "enviando" más de 5 minutos (una vuelta que
   se murió) pasan a fallido **sin reintentar**: no se sabe si salieron, y
   repetir sería mandar dos veces el mismo correo.
2. Los programados cuya hora llegó pasan a `enviando`: se **congela** el
   contenido (`boletines.contenido`) y se anota a cada suscripción activa en
   `boletin_envios`.
3. Si el envío real está autorizado, salen hasta 5 correos para confirmar que
   estaban esperando (gente que se anotó antes de la autorización).
4. Se reserva una tanda de 12 destinatarios y se les manda, hasta los 6,5 s.
   Lo que no llegó a salir vuelve a la fila sin gastar intentos.
5. Los newsletters sin nadie esperando pasan a `enviado`.

Detalles que importan:

- **Sin duplicados:** la clave de `boletin_envios` es (newsletter, suscripción),
  y la tanda se reserva con un único `UPDATE … FOR UPDATE SKIP LOCKED`.
- **Reintentos:** un error pasajero (conexión, 4xx) se reintenta a los 5, 30 y
  120 minutos; al cuarto intento queda fallido. Un rechazo de la dirección
  (5xx) no se reintenta. Si Google rechaza **la cuenta** (contraseña, tope), no
  se le gasta el intento a nadie: la cola espera 15 minutos.
- **Tope diario:** `NEWSLETTER_TOPE_DIARIO` (1800 por defecto) contando todo lo
  que salió en 24 horas. Google deja unos 2000 por cuenta.
- **Velocidad:** 12 por minuto, unos 720 por hora.
- **Baja:** cada correo lleva el enlace de baja firmado de esa persona y las
  cabeceras `List-Unsubscribe` / `List-Unsubscribe-Post` (baja de un clic, RFC
  8058), que Gmail y Yahoo exigen.
- **Antes de salir** cada correo vuelve a mirar la suscripción: quien se dio de
  baja después de que arrancó el envío queda "omitido".
- **Lo que no se sabe:** "enviado" quiere decir que Google aceptó el correo. Si
  después rebotó en el buzón de la persona, el rebote llega como correo a
  `sanmiguelino@smt.gob.ar` y el sistema no lo lee. Tampoco se miden aperturas
  ni clics (decisión del 2026-11-05).

### Borrador con IA

«Armar con IA» (en el editor) usa la misma clave de OpenRouter que Migue y su
modelo, salvo que se cargue `NEWSLETTER_IA_MODELO`
(`src/lib/newsletter/borrador-ia.ts`). Son dos pedidos desde el navegador,
para que cada uno entre en los 10 s de Vercel:

1. **Elegir notas:** el modelo ve título, sección y bajada de las notas de la
   edición y devuelve de 4 a 6 slugs. Sólo se aceptan slugs de esa edición.
2. **Escribir:** en paralelo, un pedido por nota (que ve sólo esa nota, hasta
   3500 caracteres) y uno para asunto, línea de vista previa, introducción y
   cierre (que ve títulos y bajadas). Se pide sin "razonamiento" previo: los
   modelos que razonan gastaban en eso parte del tope de tokens y el JSON
   llegaba cortado.

**Control contra datos inventados** (`src/lib/newsletter/verificar-ia.ts`):
cada número y cada palabra con mayúscula que no abre oración tiene que
aparecer en las notas (el texto de una nota, sólo en *esa* nota). Lo que no
pasa se descarta —la nota vuelve a su bajada, la introducción queda vacía— y
el editor dice qué se descartó y por qué. No reemplaza la lectura humana: una
frase puede ser falsa con palabras que sí están en la nota.

No guarda ni manda: el resultado queda en pantalla hasta que alguien toca
«Guardar borrador». Cada pedido cuenta para el tope por hora de Migue
(`MIGUE_TOPE_PERSONA`, `MIGUE_TOPE_GLOBAL`) y se anota en la auditoría como
`newsletter.ia`.

Medido el 2026-11-05 con `anthropic/claude-sonnet-5` y la edición N.º 5 (8
notas): elegir, 2,1 s; escribir 5 notas, 4,1 s; ningún descarte.

### Estadísticas

«Cómo viene», en la pantalla del newsletter
(`src/lib/newsletter/estadisticas.ts`), muestra sólo lo que se sabe: altas,
confirmaciones y bajas de los últimos 30 días (de `suscripcion_eventos`) y, de
cada envío, a cuántos les salió, a cuántos no, cuántos se habían dado de baja
antes y cuántas bajas por el enlace del correo hubo en los 7 días siguientes.
No hay aperturas ni clics (decisión del 2026-11-05) ni rebotes posteriores.
Donde no hay datos, la pantalla lo dice con palabras en vez de mostrar un 0 %.

### Instalar el cron en Supabase (una sola vez)

Vercel Hobby corre un cron por día, así que el reloj lo pone Supabase. Hay que
cargar `NEWSLETTER_CRON_SECRET` en Vercel (32 caracteres o más) y después, en
Supabase:

1. **Database → Extensions:** prender `pg_cron` y `pg_net`.
2. **SQL Editor**, con el mismo secreto que se cargó en Vercel:

```sql
-- El secreto queda cifrado en el Vault, no escrito en el cron.
select vault.create_secret('<el NEWSLETTER_CRON_SECRET>', 'newsletter_cron_secret');

select cron.schedule(
  'newsletter-cola',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://sanmiguelino.smt.gob.ar/api/newsletter/procesar',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'newsletter_cron_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);
```

Para ver que anda: `select * from cron.job_run_details order by start_time desc
limit 5;` y `select status_code, content from net._http_response order by
created desc limit 5;`. Una respuesta 200 trae las cuentas de la vuelta. Un 503
es que falta `NEWSLETTER_CRON_SECRET` en Vercel; un 401, que el secreto del Vault
no coincide.

Para sacarlo: `select cron.unschedule('newsletter-cola');`.

**Orden del despliegue:** primero la migración
(`20261105120000_newsletter_envios`, sólo agrega), después el código, después
el cron. Si el cron se instala antes que el código, cada minuto recibe un 401
(el proxy viejo no conoce la ruta) y no pasa nada.

## Dónde mirar si algo no cierra

- `docs/panel-administracion.md` — el plan y la historia del panel, etapa por
  etapa, con las decisiones y lo que se descartó.
- `docs/integracion-cidituc.md` — el ingreso municipal.
- `prisma/schema.prisma` — cada columna con el porqué de su forma.
