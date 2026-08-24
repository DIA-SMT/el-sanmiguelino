# Fondo de las páginas públicas

`panoramica-tucuman.jpg` — panorámica aérea del centro de San Miguel de Tucumán
con la sierra de fondo. La usan como fondo la landing (`/`) y el login
(`/login`) a través de `src/components/fondo-panorama.tsx`, cubriendo el
bloque entero. Si el archivo no está, el componente no renderiza nada y las
páginas quedan con el escritorio de papel: no se rompe nada.

Si se cambia la foto, hay que volver a medir el contraste del texto que va
encima: el velo (`--velo-panorama` en `globals.css`) está calibrado contra
*esta* imagen. Una foto con más cielo claro o más sombras profundas puede
tirar la microtipografía abajo de 4.5:1.

## Procedencia

- Origen: Wikimedia Commons, `Panorámica del centro tucumano.jpg`
  (https://commons.wikimedia.org/wiki/File:Panorámica_del_centro_tucumano.jpg)
- Medidas: 2048 × 565 px, 448 KB
- Licencia: **CC BY-SA 4.0**
- Autor acreditado en Commons: `aeropuertotucuman.blogspot.com.ar`

La CC BY-SA 4.0 pide atribución visible y que las obras derivadas mantengan la
misma licencia. Hoy el sitio **no** muestra línea de crédito porque la idea es
reemplazar este archivo por una foto propia del municipio. Mientras eso no
pase, conviene o poner el crédito a la vista o cambiar la foto antes de
publicar.
