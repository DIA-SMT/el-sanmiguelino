import { SITIO_URL } from "@/lib/compartir";
import { tramosConFormato } from "@/lib/formato-en-linea";

/**
 * Cómo se ve un correo de El Sanmiguelino: el newsletter y el pedido de
 * confirmación.
 *
 * **Es una sola función para la vista previa y para el envío.** El editor del
 * panel la llama en el navegador para dibujar la vista previa al instante, y el
 * servidor la llama para armar el correo que sale. Así lo que se ve en el
 * panel es exactamente lo que llega. Por eso este archivo no importa nada del
 * servidor.
 *
 * El HTML está hecho para programas de correo, no para navegadores: tablas,
 * estilos en línea, 600 px de ancho y fuentes del sistema. Gmail borra los
 * `<style>` en muchos casos y Outlook dibuja con el motor de Word, así que lo
 * que no va en línea no existe. Tampoco hay SVG (Gmail no los muestra): la
 * cabecera es texto con tipografía de diario.
 *
 * Todo lo que viene de afuera pasa por `escapar()`. Un título con `<` o `"` no
 * puede romper el correo ni meter nada en él.
 */

export interface NotaDelBoletin {
  slug: string;
  seccion: string;
  titulo: string;
  /** La bajada de la nota, o el texto propio que haya puesto el editor. */
  resumen: string;
  imagen?: { src: string; alt: string };
}

/**
 * Un bloque propio del newsletter, que no es una nota del diario: un título,
 * un texto, una imagen opcional y un enlace a cualquier lado. Nació para
 * avisar de las «Entrevistas con El Sanmiguelino» de YouTube, pero sirve para
 * cualquier cosa que viva fuera del diario.
 *
 * Lo escribe una persona en el panel, no la IA, y se guarda copiado (no por
 * referencia, como las notas): no hay otro lugar de donde leerlo.
 */
export interface BloqueDelBoletin {
  tipo: "bloque";
  /** Para distinguirlo en el editor; no sale en el correo. */
  id: string;
  titulo: string;
  texto: string;
  /** Siempre https. */
  enlace: string;
  /** El texto del botón: «Ver la entrevista». */
  boton: string;
  imagen?: { src: string; alt: string };
}

/** Lo que va en el cuerpo, en orden: notas del diario y bloques propios. */
export type PiezaDelBoletin = NotaDelBoletin | BloqueDelBoletin;

export function esBloque(p: object): p is BloqueDelBoletin {
  return (p as { tipo?: unknown }).tipo === "bloque";
}

export interface DatosDelBoletin {
  asunto: string;
  preencabezado: string;
  introduccion: string;
  notas: PiezaDelBoletin[];
  cierre: string;
}

/**
 * La miniatura de un video de YouTube, a partir de su dirección. null si no es
 * un video de YouTube. Así un bloque que lleva a una entrevista tiene foto sin
 * que nadie tenga que subirla.
 *
 * Es la ancha (`hq720`, 16:9): la común (`hqdefault`) es 4:3 y trae franjas
 * negras arriba y abajo. No todos los videos tienen la ancha; el editor lo
 * nota al mostrarla y cae a la común (ver `FilaBloque`).
 */
export function miniaturaDeYoutube(enlace: string): string | null {
  let u: URL;
  try {
    u = new URL(enlace);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0] || null;
  else if (host === "youtube.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(shorts|live|embed)\/([^/?#]+)/);
      id = m?.[2] ?? null;
    }
  }
  return id && /^[\w-]{6,20}$/.test(id)
    ? `https://i.ytimg.com/vi/${id}/hq720.jpg`
    : null;
}

export interface CorreoArmado {
  asunto: string;
  html: string;
  texto: string;
}

const COLOR = {
  fondo: "#f4efe3",
  hoja: "#fcfaf4",
  tinta: "#17140e",
  tinta2: "#4a4337",
  tinta3: "#756c5d",
  filete: "#d9d0bd",
  acento: "#075cf1",
};

const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "Arial, Helvetica, sans-serif";

const SITIO = SITIO_URL.origin;

export function escapar(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** La dirección pública de una nota. */
export function enlaceDeNota(slug: string): string {
  return `${SITIO}/nota/${encodeURIComponent(slug)}`;
}

/**
 * La foto, pasada por el optimizador de imágenes del sitio y con dirección
 * completa (un correo no tiene "sitio actual" contra el cual resolver `/fotos`).
 *
 * El optimizador hace dos cosas que un correo agradece: la achica a 1200 px
 * —el doble de 600, para pantallas densas— en vez de mandar el original de
 * 8 MB, y elige el formato según lo que acepta quien la pide, así que a un
 * programa que no entiende WebP le llega JPG.
 */
export function imagenParaCorreo(src: string): string {
  // Las fotos del diario (las del bucket y las de /public) pasan por el
  // optimizador. Una imagen de afuera —la miniatura de YouTube de un bloque—
  // va directa: el optimizador sólo acepta las del bucket, y la de YouTube ya
  // viene del tamaño justo.
  const delDiario =
    src.startsWith("/") || src.includes("/storage/v1/object/public/");
  return delDiario
    ? `${SITIO}/_next/image?url=${encodeURIComponent(src)}&w=1200&q=75`
    : src;
}

/** El logo, en PNG: Gmail no muestra SVG. Se genera desde
 *  `scripts/marca/logo-sanmiguelino-color.svg` con `npm run marca:iconos`. */
export const LOGO_DEL_CORREO = {
  src: `${SITIO}/correo/logo-sanmiguelino.png`,
  /** Ancho al que se muestra; el archivo tiene el doble, para pantallas
   *  densas. */
  ancho: 360,
  alto: 37,
};

/** Párrafos separados por una línea en blanco, con la negrita y la cursiva del
 *  editor de notas (`**así**` y `*así*`). */
function parrafos(texto: string): string[] {
  return texto
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function enLinea(texto: string): string {
  return tramosConFormato(texto.replace(/\s*\n\s*/g, " "))
    .map((t) => {
      let html = escapar(t.texto);
      if (t.cursiva) html = `<em>${html}</em>`;
      if (t.negrita) html = `<strong>${html}</strong>`;
      return html;
    })
    .join("");
}

function textoPlano(texto: string): string {
  return tramosConFormato(texto)
    .map((t) => t.texto)
    .join("");
}

function bloqueDeParrafos(texto: string, tamano = 17): string {
  return parrafos(texto)
    .map(
      (p) =>
        `<p style="margin:0 0 16px 0;font-family:${SERIF};font-size:${tamano}px;line-height:1.6;color:${COLOR.tinta};">${enLinea(p)}</p>`,
    )
    .join("");
}

function fila(contenido: string, relleno = "0 24px"): string {
  return `<tr><td style="padding:${relleno};">${contenido}</td></tr>`;
}

const FILETE = `<div style="border-top:1px solid ${COLOR.filete};font-size:0;line-height:0;height:0;">&nbsp;</div>`;

function cabecera(): string {
  return fila(
    // El logo es una imagen: si el programa de correo bloquea las imágenes,
    // queda su texto alternativo con la tipografía más parecida que hay.
    `<a href="${SITIO}" style="text-decoration:none;color:${COLOR.acento};"><div style="text-align:center;">` +
      `<img src="${LOGO_DEL_CORREO.src}" width="${LOGO_DEL_CORREO.ancho}" height="${LOGO_DEL_CORREO.alto}" alt="EL SANMIGUELINO" style="display:inline-block;width:${LOGO_DEL_CORREO.ancho}px;max-width:100%;height:auto;border:0;font-family:${SANS};font-size:28px;font-weight:bold;letter-spacing:0.5px;color:${COLOR.acento};">` +
      `</div></a>` +
      `<div style="margin-top:14px;border-top:3px solid ${COLOR.tinta};border-bottom:1px solid ${COLOR.tinta};height:2px;font-size:0;line-height:0;">&nbsp;</div>` +
      `<div style="margin-top:8px;font-family:${SANS};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${COLOR.tinta3};text-align:center;">Novedades del suplemento mensual de la Municipalidad de San Miguel de Tucumán</div>`,
    "28px 24px 24px 24px",
  );
}

function pie(enlaceBaja: string, motivo: string): string {
  return fila(
    FILETE +
      `<p style="margin:16px 0 8px 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${COLOR.tinta3};">${escapar(motivo)}</p>` +
      `<p style="margin:0 0 8px 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${COLOR.tinta3};">` +
      `<a href="${escapar(enlaceBaja)}" style="color:${COLOR.tinta2};text-decoration:underline;">Darme de baja</a>` +
      ` · <a href="${SITIO}" style="color:${COLOR.tinta2};text-decoration:underline;">sanmiguelino.smt.gob.ar</a></p>` +
      `<p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:${COLOR.tinta3};">Municipalidad de San Miguel de Tucumán</p>`,
    "8px 24px 28px 24px",
  );
}

/** El esqueleto común: fondo, hoja centrada de 600 px y el preencabezado
 *  escondido, que es lo que muestra la bandeja de entrada junto al asunto. */
function documento(
  asunto: string,
  preencabezado: string,
  filas: string,
): string {
  const pre = preencabezado
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapar(preencabezado)}${"&#847; &zwnj; &nbsp; ".repeat(30)}</div>`
    : "";
  return (
    `<!doctype html><html lang="es"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">` +
    `<title>${escapar(asunto)}</title></head>` +
    `<body style="margin:0;padding:0;background:${COLOR.fondo};">${pre}` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.fondo};"><tr><td align="center" style="padding:24px 8px;">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${COLOR.hoja};border:1px solid ${COLOR.filete};">` +
    filas +
    `</table></td></tr></table></body></html>`
  );
}

function bloqueDeNota(nota: NotaDelBoletin, primera: boolean): string {
  const url = enlaceDeNota(nota.slug);
  const foto = nota.imagen
    ? `<a href="${url}" style="text-decoration:none;"><img src="${escapar(imagenParaCorreo(nota.imagen.src))}" alt="${escapar(nota.imagen.alt)}" width="552" style="display:block;width:100%;max-width:552px;height:auto;border:0;margin:0 0 14px 0;"></a>`
    : "";
  return fila(
    (primera ? "" : FILETE + `<div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>`) +
      foto +
      `<div style="font-family:${SANS};font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:${COLOR.acento};">${escapar(nota.seccion)}</div>` +
      `<h2 style="margin:6px 0 8px 0;font-family:${SERIF};font-size:23px;line-height:1.2;font-weight:bold;color:${COLOR.tinta};"><a href="${url}" style="color:${COLOR.tinta};text-decoration:none;">${escapar(nota.titulo)}</a></h2>` +
      (nota.resumen
        ? `<p style="margin:0 0 10px 0;font-family:${SERIF};font-size:16px;line-height:1.55;color:${COLOR.tinta2};">${enLinea(nota.resumen)}</p>`
        : "") +
      `<p style="margin:0 0 22px 0;font-family:${SANS};font-size:13px;font-weight:bold;"><a href="${url}" style="color:${COLOR.acento};text-decoration:none;">Leer la nota &rarr;</a></p>`,
  );
}

function bloquePropio(b: BloqueDelBoletin, primera: boolean): string {
  const url = escapar(b.enlace);
  const foto = b.imagen
    ? `<a href="${url}" style="text-decoration:none;"><img src="${escapar(imagenParaCorreo(b.imagen.src))}" alt="${escapar(b.imagen.alt)}" width="552" style="display:block;width:100%;max-width:552px;height:auto;border:0;margin:0 0 14px 0;"></a>`
    : "";
  const boton =
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 22px 0;"><tr>` +
    `<td style="background:${COLOR.acento};"><a href="${url}" style="display:inline-block;padding:11px 18px;font-family:${SANS};font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">${escapar(b.boton || "Ver más")} &rarr;</a></td>` +
    `</tr></table>`;
  return fila(
    (primera ? "" : FILETE + `<div style="height:22px;line-height:22px;font-size:0;">&nbsp;</div>`) +
      foto +
      (b.titulo
        ? `<h2 style="margin:0 0 8px 0;font-family:${SERIF};font-size:23px;line-height:1.2;font-weight:bold;color:${COLOR.tinta};"><a href="${url}" style="color:${COLOR.tinta};text-decoration:none;">${escapar(b.titulo)}</a></h2>`
        : "") +
      (b.texto
        ? `<p style="margin:0 0 12px 0;font-family:${SERIF};font-size:16px;line-height:1.55;color:${COLOR.tinta2};">${enLinea(b.texto)}</p>`
        : "") +
      boton,
  );
}

const MOTIVO_BOLETIN =
  "Recibís este correo porque te anotaste para recibir las novedades de El Sanmiguelino.";

export function armarBoletin(
  datos: DatosDelBoletin,
  enlaceBaja: string,
): CorreoArmado {
  const filas =
    cabecera() +
    (datos.introduccion.trim() ? fila(bloqueDeParrafos(datos.introduccion), "0 24px 8px 24px") : "") +
    datos.notas
      .map((n, i) => (esBloque(n) ? bloquePropio(n, i === 0) : bloqueDeNota(n, i === 0)))
      .join("") +
    (datos.cierre.trim() ? fila(FILETE + `<div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div>` + bloqueDeParrafos(datos.cierre, 16)) : "") +
    pie(enlaceBaja, MOTIVO_BOLETIN);

  const texto = [
    "EL SANMIGUELINO",
    "Novedades del suplemento mensual de la Municipalidad de San Miguel de Tucumán",
    "",
    ...parrafos(datos.introduccion).map(textoPlano).flatMap((p) => [p, ""]),
    ...datos.notas.flatMap((n) =>
      esBloque(n)
        ? [
            ...(n.titulo ? [n.titulo] : []),
            ...(n.texto ? [textoPlano(n.texto)] : []),
            `${n.boton || "Ver más"}: ${n.enlace}`,
            "",
          ]
        : [
            `${n.seccion.toUpperCase()}`,
            n.titulo,
            ...(n.resumen ? [textoPlano(n.resumen)] : []),
            `Leer la nota: ${enlaceDeNota(n.slug)}`,
            "",
          ],
    ),
    ...parrafos(datos.cierre).map(textoPlano).flatMap((p) => [p, ""]),
    "--",
    MOTIVO_BOLETIN,
    `Darme de baja: ${enlaceBaja}`,
    "Municipalidad de San Miguel de Tucumán",
  ].join("\n");

  return {
    asunto: datos.asunto,
    html: documento(datos.asunto, datos.preencabezado, filas),
    texto,
  };
}

const ASUNTO_CONFIRMACION = "Confirmá tu suscripción a El Sanmiguelino";

/** El correo de la doble confirmación. Sin confirmar, no se le escribe más. */
export function armarConfirmacion(datos: {
  nombre: string;
  enlace: string;
}): CorreoArmado {
  const saludo = datos.nombre.trim()
    ? `Hola, ${datos.nombre.trim().split(/\s+/)[0]}:`
    : "Hola:";
  const boton =
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px 0;"><tr>` +
    `<td style="background:${COLOR.acento};"><a href="${escapar(datos.enlace)}" style="display:inline-block;padding:13px 22px;font-family:${SANS};font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">Confirmar mi suscripción</a></td>` +
    `</tr></table>`;
  const filas =
    cabecera() +
    fila(
      `<p style="margin:0 0 16px 0;font-family:${SERIF};font-size:17px;line-height:1.6;color:${COLOR.tinta};">${escapar(saludo)}</p>` +
        `<p style="margin:0 0 16px 0;font-family:${SERIF};font-size:17px;line-height:1.6;color:${COLOR.tinta};">Pediste recibir por correo las novedades de El Sanmiguelino, el suplemento mensual de la Municipalidad. Para empezar a recibirlas, confirmá que este correo es tuyo:</p>` +
        boton +
        `<p style="margin:0 0 24px 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${COLOR.tinta3};">Si no fuiste vos, ignorá este mensaje: sin tu confirmación no te vamos a escribir. El enlace vence en 30 días.</p>`,
    ) +
    fila(
      FILETE +
        `<p style="margin:16px 0 28px 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${COLOR.tinta3};">Municipalidad de San Miguel de Tucumán · <a href="${SITIO}" style="color:${COLOR.tinta2};">sanmiguelino.smt.gob.ar</a></p>`,
    );
  const texto = [
    saludo,
    "",
    "Pediste recibir por correo las novedades de El Sanmiguelino, el suplemento mensual de la Municipalidad. Para empezar a recibirlas, confirmá que este correo es tuyo:",
    "",
    datos.enlace,
    "",
    "Si no fuiste vos, ignorá este mensaje: sin tu confirmación no te vamos a escribir. El enlace vence en 30 días.",
    "",
    "Municipalidad de San Miguel de Tucumán",
  ].join("\n");
  return {
    asunto: ASUNTO_CONFIRMACION,
    html: documento(ASUNTO_CONFIRMACION, "Un paso más para recibir las novedades del diario.", filas),
    texto,
  };
}
