import type { FiguraPagina, ItemTexto, PaginaDigitalizada } from "./estructura.ts";

/** Formatos habituales del impreso. Las medidas están en puntos PDF. */
export type FormatoPagina = "A4" | "A3" | "carta" | "diario" | "personalizado";

export interface DiagnosticoPagina {
  ancho: number;
  alto: number;
  formato: FormatoPagina;
  orientacion: "vertical" | "horizontal";
  itemsTexto: number;
  caracteresTexto: number;
  figuras: number;
  confianza: "alta" | "media" | "baja";
  motivos: string[];
}

const FORMATOS: { nombre: FormatoPagina; ancho: number; alto: number }[] = [
  { nombre: "A4", ancho: 595.28, alto: 841.89 },
  // El formato de diario no es único. Esta referencia evita llamar "A3" a
  // una página de diario grande y deja el dato visible para ajustar el perfil.
  { nombre: "diario", ancho: 792, alto: 1224 },
  { nombre: "A3", ancho: 841.89, alto: 1190.55 },
  { nombre: "carta", ancho: 612, alto: 792 },
];

function diferenciaRelativa(a: number, b: number): number {
  return Math.abs(a - b) / Math.max(a, b);
}

export function formatoDePagina(ancho: number, alto: number): FormatoPagina {
  const horizontal = ancho > alto;
  const menor = horizontal ? alto : ancho;
  const mayor = horizontal ? ancho : alto;
  const proporcion = mayor / menor;
  const conocido = FORMATOS.map((f) => ({
    ...f,
    distancia:
      diferenciaRelativa(menor, Math.min(f.ancho, f.alto)) +
      diferenciaRelativa(mayor, Math.max(f.ancho, f.alto)) +
      // El aspecto separa A3 de los formatos grandes de diario, que pueden
      // compartir una dimensión aproximada pero tienen columnas distintas.
      diferenciaRelativa(proporcion, Math.max(f.ancho, f.alto) / Math.min(f.ancho, f.alto)) * 2,
  }))
    .sort((a, b) => a.distancia - b.distancia)[0];
  return conocido && conocido.distancia < 0.24 ? conocido.nombre : "personalizado";
}

/**
 * Mide si la salida merece pasar por un recuperador OCR.
 *
 * No intenta decidir si una página está "bien escrita": solo detecta señales
 * objetivas de que el PDF no entregó todo lo que se ve impreso. El dato queda
 * guardado junto a la página para que el editor pueda auditarlo.
 */
export function diagnosticarPagina(opciones: {
  ancho: number;
  alto: number;
  items: ItemTexto[];
  figuras: FiguraPagina[];
  resultado: PaginaDigitalizada;
}): DiagnosticoPagina {
  const { ancho, alto, items, figuras, resultado } = opciones;
  const caracteresTexto = items.reduce((total, item) => total + item.texto.trim().length, 0);
  const motivos: string[] = [];

  if (caracteresTexto < 120) motivos.push("la capa de texto tiene muy poco contenido");
  if (!items.length) motivos.push("el PDF no expone texto seleccionable");
  if (figuras.some((figura) => figura.infografia)) {
    motivos.push("la página contiene arte vectorial que puede tener texto convertido a curvas");
  }
  if (!resultado.titulo && caracteresTexto >= 120) {
    motivos.push("no se reconoció un titular con la geometría del PDF");
  }
  if (resultado.avisos.length > 1) motivos.push("la página requiere más de una revisión estructural");

  const confianza: DiagnosticoPagina["confianza"] =
    !items.length || caracteresTexto < 120
      ? "baja"
      : motivos.length > 0
        ? "media"
        : "alta";

  return {
    ancho: Math.round(ancho * 10) / 10,
    alto: Math.round(alto * 10) / 10,
    formato: formatoDePagina(ancho, alto),
    orientacion: ancho >= alto ? "horizontal" : "vertical",
    itemsTexto: items.length,
    caracteresTexto,
    figuras: figuras.length,
    confianza,
    motivos,
  };
}

/** El OCR solo se dispara ante señales de pérdida, nunca por el tamaño del papel. */
export function necesitaOcr(diagnostico: DiagnosticoPagina): boolean {
  return diagnostico.confianza === "baja" || diagnostico.motivos.some((motivo) =>
    motivo.includes("arte vectorial"),
  );
}
