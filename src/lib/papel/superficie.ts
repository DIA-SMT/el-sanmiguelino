/** Papel flexible: una malla que se enrolla alrededor de un cilindro móvil.
 * Sólo existe mientras se pasa de página; el lector sigue siendo HTML. */
export interface CapturaPapel {
  imagen: HTMLCanvasElement;
  izquierda: number;
  arriba: number;
  ancho: number;
  alto: number;
  color: [number, number, number];
}

const VERTICE = `
attribute vec2 uv;
uniform vec2 pantalla;
uniform vec4 hoja;
uniform float progreso;
uniform float sentido;
varying vec2 textura;
varying float angulo;
void main() {
  float w = hoja.z;
  float fuerza = sin(progreso * 3.14159265);
  float radio = max(w * 0.105 * pow(max(fuerza, 0.0), 0.7), 0.5);
  float s = (sentido > 0.0 ? uv.x : 1.0 - uv.x) * w;
  // El extremo inferior arranca antes; el pliegue nunca es una bisagra recta.
  float eje = w * (1.0 - 1.42 * progreso)
    + w * fuerza * (0.055 * (0.5 - uv.y) + 0.025 * sin(uv.y * 3.14159265));
  float arco = clamp((s - eje) / radio, 0.0, 3.14159265);
  float x = s;
  float z = 0.0;
  if (s > eje) {
    x = eje + radio * sin(arco) - max(0.0, s - eje - radio * 3.14159265);
    z = radio * (1.0 - cos(arco));
  }
  x = sentido > 0.0 ? x : w - x;
  vec2 posicion = vec2(hoja.x + x, hoja.y + uv.y * hoja.w);
  vec2 centro = vec2(hoja.x + w * 0.5, pantalla.y * 0.5);
  posicion = centro + (posicion - centro) / (1.0 - z / (w * 3.8));
  gl_Position = vec4(posicion.x / pantalla.x * 2.0 - 1.0,
    1.0 - posicion.y / pantalla.y * 2.0, -z / w, 1.0);
  textura = uv;
  angulo = arco;
}`;

const FRAGMENTO = `
precision mediump float;
uniform sampler2D imagen;
uniform vec3 papel;
varying vec2 textura;
varying float angulo;
void main() {
  vec4 tinta = texture2D(imagen, textura);
  float normal = cos(angulo);
  // El dorso conserva una insinuación de la tinta que transparenta el papel.
  vec3 color = normal >= 0.0 ? tinta.rgb : mix(papel, tinta.rgb, 0.065);
  float luz = 0.80 + 0.20 * abs(normal) - 0.13 * sin(angulo);
  float reflejo = 0.11 * pow(max(sin(angulo - 0.35), 0.0), 12.0);
  gl_FragColor = vec4(color * luz + reflejo, tinta.a);
}`;

export function crearSuperficie(captura: CapturaPapel, adelante: boolean) {
  const contenedor = document.createElement("div");
  contenedor.className = "papel-en-movimiento";
  contenedor.setAttribute("aria-hidden", "true");
  const sombra = document.createElement("div");
  sombra.className = "papel-sombra-pliegue";
  const canvas = document.createElement("canvas");
  contenedor.append(sombra, canvas);
  const gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false });
  if (!gl) return null;

  const recursos: (() => void)[] = [];
  let destruida = false;
  const destruir = () => {
    if (destruida) return;
    destruida = true;
    contenedor.remove();
    recursos.reverse().forEach((liberar) => liberar());
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };

  try {
    const compilar = (tipo: number, fuente: string) => {
      const shader = gl.createShader(tipo);
      if (!shader) throw new Error("No se pudo crear el shader de papel");
      recursos.push(() => gl.deleteShader(shader));
      gl.shaderSource(shader, fuente);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error("Shader de papel no compatible");
      return shader;
    };
    const programa = gl.createProgram();
    if (!programa) throw new Error("WebGL no disponible");
    recursos.push(() => gl.deleteProgram(programa));
    gl.attachShader(programa, compilar(gl.VERTEX_SHADER, VERTICE));
    gl.attachShader(programa, compilar(gl.FRAGMENT_SHADER, FRAGMENTO));
    gl.linkProgram(programa);
    if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) throw new Error("Programa de papel no compatible");
    gl.useProgram(programa);

    const puntos: number[] = [];
    const indices: number[] = [];
    const columnas = 96;
    const filas = 12;
    for (let y = 0; y <= filas; y++) {
      for (let x = 0; x <= columnas; x++) puntos.push(x / columnas, y / filas);
    }
    for (let y = 0; y < filas; y++) {
      for (let x = 0; x < columnas; x++) {
        const a = y * (columnas + 1) + x;
        indices.push(a, a + 1, a + columnas + 1, a + 1, a + columnas + 2, a + columnas + 1);
      }
    }
    const vertices = gl.createBuffer();
    const triangulos = gl.createBuffer();
    recursos.push(() => gl.deleteBuffer(vertices), () => gl.deleteBuffer(triangulos));
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(puntos), gl.STATIC_DRAW);
    const uv = gl.getAttribLocation(programa, "uv");
    gl.enableVertexAttribArray(uv);
    gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangulos);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    const textura = gl.createTexture();
    recursos.push(() => gl.deleteTexture(textura));
    gl.bindTexture(gl.TEXTURE_2D, textura);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, captura.imagen);
    if (gl.getError() !== gl.NO_ERROR) throw new Error("La captura no cabe en la textura");

    const ancho = window.innerWidth;
    const alto = window.innerHeight;
    const densidad = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(ancho * densidad);
    canvas.height = Math.round(alto * densidad);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(gl.getUniformLocation(programa, "pantalla"), ancho, alto);
    gl.uniform4f(gl.getUniformLocation(programa, "hoja"), captura.izquierda, captura.arriba, captura.ancho, captura.alto);
    gl.uniform3fv(gl.getUniformLocation(programa, "papel"), captura.color);
    gl.uniform1f(gl.getUniformLocation(programa, "sentido"), adelante ? 1 : -1);
    const progresoUniforme = gl.getUniformLocation(programa, "progreso");
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);

    const dibujar = (progreso: number) => {
      if (destruida || gl.isContextLost()) return;
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform1f(progresoUniforme, progreso);
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
      const fuerza = Math.sin(progreso * Math.PI);
      const radio = captura.ancho * 0.105 * Math.pow(Math.max(0, fuerza), 0.7);
      const eje = captura.ancho * (1 - 1.42 * progreso);
      const centro = adelante ? eje + radio * 0.5 : captura.ancho - eje - radio * 0.5;
      Object.assign(sombra.style, {
        left: `${captura.izquierda + centro - radio}px`,
        top: `${captura.arriba}px`,
        width: `${radio * 3}px`,
        height: `${captura.alto}px`,
        opacity: `${fuerza * 0.32}`,
      });
    };
    dibujar(0);
    document.body.append(contenedor);
    return { dibujar, destruir, contenedor };
  } catch {
    destruir();
    return null;
  }
}
