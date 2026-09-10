import type { ItemTexto } from "./estructura.ts";

/**
 * Recuperación OCR para PDF escaneado o con texto convertido a curvas.
 *
 * El modelo recibe una imagen de la página y devuelve solo renglones que se
 * puedan leer. No se le pide que reescriba ni resuma: el digitalizador conserva
 * esas mismas palabras y las vuelve a pasar por su clasificador de columnas.
 */

const MODELO_POR_DEFECTO = "google/gemini-2.5-flash";
const TIMEOUT_MS = 45_000;

export interface LineaOcr {
  texto: string;
  /** Coordenadas normalizadas en un cuadrado de 1.000 × 1.000. */
  x: number;
  y: number;
  ancho: number;
  alto: number;
  estilo?: "titulo" | "bajada" | "cuerpo" | "subtitulo" | "rotulo";
  confianza?: number;
}

interface RespuestaOcr {
  lineas?: unknown;
}

export function ocrHabilitado(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY) && process.env.OCR_DIGITALIZADOR !== "0";
}

function modeloOcr(): string {
  return process.env.OCR_MODELO || process.env.MAQUETADOR_MODELO || MODELO_POR_DEFECTO;
}

function jsonDeRespuesta(texto: string): RespuestaOcr {
  const limpio = texto
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const abre = limpio.indexOf("{");
  const cierra = limpio.lastIndexOf("}");
  if (abre < 0 || cierra <= abre) throw new Error("el OCR no devolvió JSON");
  return JSON.parse(limpio.slice(abre, cierra + 1)) as RespuestaOcr;
}

function numero(valor: unknown): number | null {
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) ? Math.max(0, Math.min(1000, n)) : null;
}

function confianzaDe(valor: unknown): number | null {
  const n = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1000, n <= 1 ? n * 1000 : n));
}

function textoNormalizado(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function limpiarLineas(valor: unknown): LineaOcr[] {
  if (!Array.isArray(valor)) return [];
  const vistas = new Set<string>();
  const lineas: LineaOcr[] = [];
  for (const entrada of valor) {
    if (!entrada || typeof entrada !== "object") continue;
    const fila = entrada as Record<string, unknown>;
    const texto = typeof fila.texto === "string" ? fila.texto.trim() : "";
    if (texto.length < 2) continue;
    const x = numero(fila.x);
    const y = numero(fila.y);
    const ancho = numero(fila.ancho);
    const alto = numero(fila.alto);
    if (x === null || y === null || ancho === null || alto === null || ancho < 2 || alto < 2) continue;
    const confianza = confianzaDe(fila.confianza);
    if (confianza !== null && confianza < 500) continue;
    const clave = textoNormalizado(texto);
    if (!clave || vistas.has(clave)) continue;
    vistas.add(clave);
    const estilos = new Set(["titulo", "bajada", "cuerpo", "subtitulo", "rotulo"]);
    const estilo = typeof fila.estilo === "string" && estilos.has(fila.estilo)
      ? (fila.estilo as LineaOcr["estilo"])
      : "cuerpo";
    lineas.push({ texto, x, y, ancho, alto, estilo, confianza: confianza ?? undefined });
  }
  return lineas.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Consulta OCR y devuelve null cuando no hay servicio configurado o falló. */
export async function extraerTextoConOcr(opciones: {
  imagenBase64: string;
  pagina: number;
  formato: string;
}): Promise<{ ok: true; lineas: LineaOcr[] } | { ok: false; motivo: string }> {
  const clave = process.env.OPENROUTER_API_KEY;
  if (!clave) return { ok: false, motivo: "falta OPENROUTER_API_KEY" };

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    const respuesta = await fetch(
      process.env.OPENROUTER_URL ?? "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        signal: control.signal,
        headers: {
          Authorization: `Bearer ${clave}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.SITIO_URL ?? "https://sanmiguelino.smt.gob.ar",
          "X-Title": "El Sanmiguelino OCR",
        },
        body: JSON.stringify({
          model: modeloOcr(),
          max_tokens: 12_000,
          temperature: 0,
          messages: [
            {
              role: "system",
              content: `Sos un OCR editorial. Leé la imagen completa de una página de diario en español.
Transcribí TODO texto visible y legible, incluyendo títulos, bajadas, párrafos, listas,
epígrafes y texto dentro de infografías. No inventes, completes ni corrijas palabras.
Si algo no se puede leer, omitilo. Devolvé SOLO JSON válido con esta forma:
{"lineas":[{"texto":"...","x":0,"y":0,"ancho":0,"alto":0,"estilo":"cuerpo","confianza":900}]}
Las coordenadas son enteros de 0 a 1000 relativos a la imagen: x/y es la esquina
superior izquierda y ancho/alto el rectángulo del renglón. Una entrada por renglón.
Usá estilo titulo, bajada, cuerpo, subtitulo o rotulo. La confianza va de 0 a 1000.
No incluy nombres de botones, marcas del visor ni texto agregado por la interfaz.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: `data:image/png;base64,${opciones.imagenBase64}` },
                },
                {
                  type: "text",
                  text: `Página ${opciones.pagina}. Formato detectado: ${opciones.formato}. La salida debe ser texto visible de la página, sin comentarios.`,
                },
              ],
            },
          ],
        }),
      },
    );
    if (!respuesta.ok) {
      return { ok: false, motivo: `OpenRouter respondió ${respuesta.status}` };
    }
    const datos = (await respuesta.json()) as {
      choices?: { message?: { content?: string | { text?: string }[] } }[];
    };
    const contenido = datos.choices?.[0]?.message?.content;
    const texto = typeof contenido === "string"
      ? contenido
      : Array.isArray(contenido)
        ? contenido.map((parte) => parte.text ?? "").join("\n")
        : "";
    const lineas = limpiarLineas(jsonDeRespuesta(texto).lineas);
    return lineas.length > 0
      ? { ok: true, lineas }
      : { ok: false, motivo: "el OCR no encontró renglones legibles" };
  } catch (error) {
    return {
      ok: false,
      motivo: error instanceof Error ? error.message : "falló la consulta OCR",
    };
  } finally {
    clearTimeout(reloj);
  }
}

/** Convierte las cajas normalizadas del OCR al mismo sistema de puntos del PDF. */
export function itemsDesdeOcr(lineas: LineaOcr[], ancho: number, alto: number): ItemTexto[] {
  return lineas.map((linea) => ({
    x: (linea.x / 1000) * ancho,
    y: (linea.y / 1000) * alto,
    ancho: Math.max(2, (linea.ancho / 1000) * ancho),
    // La altura de una caja OCR no es una medida tipográfica confiable: cambia
    // según el render y el modelo. El rol sí es estable y permite que la
    // heurística agrupe los renglones de cuerpo sin convertir cada uno en un
    // estilo distinto.
    tam:
      linea.estilo === "titulo"
        ? 28
        : linea.estilo === "bajada"
          ? 15
          : linea.estilo === "subtitulo"
            ? 13
            : linea.estilo === "rotulo"
              ? 8
              : 10,
    fuente: linea.estilo === "titulo" || linea.estilo === "subtitulo" ? "OCR-Bold" : "OCR-Regular",
    texto: linea.texto,
    rotado: false,
  }));
}
