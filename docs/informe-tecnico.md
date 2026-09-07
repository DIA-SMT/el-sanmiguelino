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

## Dónde mirar si algo no cierra

- `docs/panel-administracion.md` — el plan y la historia del panel, etapa por
  etapa, con las decisiones y lo que se descartó.
- `docs/integracion-cidituc.md` — el ingreso municipal.
- `prisma/schema.prisma` — cada columna con el porqué de su forma.
