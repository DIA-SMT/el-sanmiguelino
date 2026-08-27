# Migue

El personaje del asistente del diario. Lo aportó el municipio el 2026-08-26; el
original es `MiguePeriodista.jpg`, 2048×2048, sobre fondo blanco. No está en el
repositorio: estos dos archivos sí.

Se derivan con `scripts/migue-imagenes.mjs`, que se corre a mano. Antes ese
script vivía en una carpeta temporal, y por eso arreglar el hueco entre las
piernas hubo que reconstruirlo entero —incluido el rectángulo del retrato, que
se recuperó buscando cuál reproduce la silueta del archivo ya publicado—.

- **`retrato.webp`** (320×320) — la cabeza, para el avatar del chat y del botón
  flotante. Un cuerpo entero dentro de un círculo de 44 px no se lee.
- **`cuerpo.webp`** (388×900) — la figura completa, para la bienvenida del chat.
  El ancho sale del recorte, no de un número redondo, y tiene que coincidir con
  el `width` del componente.

## Por qué el fondo se saca así

Con un **relleno desde los bordes** y no con un umbral: sólo se vuelve
transparente lo claro que está *conectado al borde*. Con un umbral simple se
borrarían también la camisa clara y la cara de la credencial, que son
interiores.

El umbral es 214 y no 235 porque el fondo del original no es blanco puro —mide
247— y la figura trae un contorno blanco de calcomanía todavía más claro.

### Los huecos encerrados

Entrar sólo por los bordes deja opaco cualquier bolsón de fondo que la figura
rodee por completo, y hay dos: **entre las piernas** —grande, del cinturón a los
zapatos— y la ranura **entre el brazo derecho y el torso**. En el tema claro no
se notaban. En el oscuro, el de las piernas era una columna blanca que partía a
Migue al medio.

Se sacan por punto semilla, no por una regla automática, porque ninguna regla
los separa de la credencial: el hueco del brazo tiene 1.465 px y la cara de la
credencial 5.489, así que por tamaño se salvaría el hueco y se borraría la
credencial; por color tampoco, los tres son gris casi blanco.

El precio de ser explícito es que las semillas valen para *este* original. Por
eso cada una lleva el tamaño que tiene que dar, y hay un tope para la isla clara
más grande que puede quedar: si el municipio manda una ilustración nueva, el
script se planta en vez de agujerear a Migue en silencio.

### La sombra del piso

Migue está parado sobre una sombra gris degradada. El umbral se lleva la parte
clara y deja la oscura, así que quedaba un contorno pálido abrazando las suelas.
Se desvanece siguiendo por **conexión** hacia lo claro y neutro —que es lo que
la sombra es—, con una rampa para que no quede un borde nuevo donde estaba el
viejo. La camisa también es gris claro, pero está encerrada por la campera y a
ella no se llega nunca.

## Si al cambiar la imagen seguís viendo la vieja

Es la caché del optimizador de Next, que en desarrollo vive **dentro de
`.next`** y no en `.next/cache/images`. Borrar `.next` y levantar de nuevo.
Cuesta un rato encontrarlo: el archivo en disco y el que sirve `/migue/...`
están bien, y lo que llega mal es sólo lo que pasa por `/_next/image`.

## Pendiente

El grabador y la credencial dicen **"DIARIO DIGITAL"**, que es el nombre del
repositorio y no el del diario. En el avatar no se lee, pero en `cuerpo.webp` sí.
Si el municipio rehace la ilustración, ahí debería decir *El Sanmiguelino*.
