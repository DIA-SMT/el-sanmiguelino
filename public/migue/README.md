# Migue

El personaje del asistente del diario. Lo aportó el municipio el 2026-08-26; el
original es `MiguePeriodista.jpg`, 2048×2048, sobre fondo blanco.

## Cómo se derivaron estos archivos

- **`retrato.webp`** (320×320) — la cabeza, para el avatar del chat y del botón
  flotante. Un cuerpo entero dentro de un círculo de 44 px no se lee.
- **`cuerpo.webp`** (387×900) — la figura completa, para la bienvenida del chat.

Al fondo blanco se le sacó el alfa con un **relleno desde los bordes**, no con
un umbral: sólo se vuelve transparente el blanco *conectado al borde*. Con un
umbral simple se habrían borrado también la camisa clara y la credencial, que
son interiores.

El umbral es 214 y no 235 porque la sombra bajo los zapatos es un gris claro
degradado: con el valor alto quedaba un charco blanco flotando bajo los pies en
el tema oscuro.

La transparencia no es opcional. Sin ella, el avatar sería un cuadrado blanco
sobre el fondo oscuro del chat.

## Pendiente

El grabador y la credencial dicen **"DIARIO DIGITAL"**, que es el nombre del
repositorio y no el del diario. En el avatar no se lee, pero en `cuerpo.webp` sí.
Si el municipio rehace la ilustración, ahí debería decir *El Sanmiguelino*.
