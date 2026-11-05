import "server-only";
import { db } from "@/lib/db";
import { imagenDisponible } from "@/lib/data/imagenes";
import type { NotaDelBoletin } from "@/lib/newsletter/plantilla";

/**
 * Los newsletters que se arman en el panel.
 *
 * Etapa 1: se arman, se guardan como borrador, se ven y se mandan de prueba.
 * Programar y enviar a la lista llegan con el proveedor de correo.
 *
 * Las notas se guardan por slug, no copiadas: el correo se arma con la nota tal
 * como esté al momento de mandarlo. Si en el medio alguien corrige un título,
 * sale corregido; si alguien borra la nota, se cae del newsletter y el editor
 * lo avisa (ver `resolverNotas`).
 */

/** Lo que se guarda por nota. `resumen` vacío = la bajada de la nota. */
export interface NotaElegida {
  slug: string;
  resumen: string;
}

export interface Boletin {
  id: string;
  asunto: string;
  preencabezado: string;
  introduccion: string;
  notas: NotaElegida[];
  cierre: string;
  estado: string;
  autorNombre: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface BoletinEnLista {
  id: string;
  asunto: string;
  estado: string;
  notas: number;
  autorNombre: string;
  actualizadoEn: string;
}

/** Lo que ofrece el buscador del editor. */
export interface NotaCandidata extends NotaDelBoletin {
  bajada: string;
  edicion: string;
  /** La edición ya salió. Si no, el enlace del correo todavía no abre. */
  publicada: boolean;
}

export const TOPES = {
  asunto: 150,
  preencabezado: 200,
  texto: 4000,
  resumen: 600,
  notas: 12,
};

/** Lee lo que vuelve de la columna Json sin confiar en su forma. */
function aNotas(valor: unknown): NotaElegida[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((v) =>
    v && typeof v === "object" && typeof v.slug === "string"
      ? [
          {
            slug: v.slug,
            resumen: typeof v.resumen === "string" ? v.resumen : "",
          },
        ]
      : [],
  );
}

export async function listarBoletines(): Promise<BoletinEnLista[]> {
  const filas = await db().boletin.findMany({
    orderBy: { actualizadoEn: "desc" },
    select: {
      id: true,
      asunto: true,
      estado: true,
      notas: true,
      autorNombre: true,
      actualizadoEn: true,
    },
  });
  return filas.map((f) => ({
    id: f.id,
    asunto: f.asunto,
    estado: f.estado,
    notas: aNotas(f.notas).length,
    autorNombre: f.autorNombre,
    actualizadoEn: f.actualizadoEn.toISOString(),
  }));
}

export async function obtenerBoletin(id: string): Promise<Boletin | null> {
  const f = await db().boletin.findUnique({ where: { id } });
  if (!f) return null;
  return {
    id: f.id,
    asunto: f.asunto,
    preencabezado: f.preencabezado,
    introduccion: f.introduccion,
    notas: aNotas(f.notas),
    cierre: f.cierre,
    estado: f.estado,
    autorNombre: f.autorNombre,
    creadoEn: f.creadoEn.toISOString(),
    actualizadoEn: f.actualizadoEn.toISOString(),
  };
}

export async function crearBoletin(
  autor: { id: string; nombre: string },
  asunto: string,
): Promise<string> {
  const fila = await db().boletin.create({
    data: {
      asunto,
      notas: [],
      autorId: autor.id,
      autorNombre: autor.nombre,
    },
    select: { id: true },
  });
  return fila.id;
}

export interface CambiosDelBoletin {
  asunto: string;
  preencabezado: string;
  introduccion: string;
  notas: NotaElegida[];
  cierre: string;
}

/** Guarda un borrador. Sólo un borrador se puede tocar: devuelve false si el
 *  newsletter no existe o ya no es borrador. */
export async function guardarBoletin(
  id: string,
  cambios: CambiosDelBoletin,
): Promise<boolean> {
  const r = await db().boletin.updateMany({
    where: { id, estado: "borrador" },
    data: { ...cambios, notas: cambios.notas.map((n) => ({ ...n })) },
  });
  return r.count > 0;
}

export async function borrarBoletin(id: string): Promise<boolean> {
  const r = await db().boletin.deleteMany({
    where: { id, estado: "borrador" },
  });
  return r.count > 0;
}

const SELECCION_NOTA = {
  slug: true,
  seccion: true,
  titulo: true,
  bajada: true,
  imagenSrc: true,
  imagenAlt: true,
  edicion: {
    select: { mes: true, anio: true, numero: true, publicaEn: true },
  },
} as const;

type FilaNota = {
  slug: string;
  seccion: string;
  titulo: string;
  bajada: string;
  imagenSrc: string | null;
  imagenAlt: string | null;
  edicion: {
    mes: string;
    anio: number;
    numero: number;
    publicaEn: Date | null;
  };
};

function aCandidata(f: FilaNota, ahora: Date): NotaCandidata {
  return {
    slug: f.slug,
    seccion: f.seccion,
    titulo: f.titulo,
    bajada: f.bajada,
    resumen: f.bajada,
    ...(f.imagenSrc && imagenDisponible(f.imagenSrc)
      ? { imagen: { src: f.imagenSrc, alt: f.imagenAlt ?? "" } }
      : {}),
    // `mes` a veces ya trae el año ("Noviembre de 2026"): no se repite.
    edicion: `N.º ${f.edicion.numero} · ${
      f.edicion.mes.includes(String(f.edicion.anio))
        ? f.edicion.mes
        : `${f.edicion.mes} ${f.edicion.anio}`
    }`,
    publicada: Boolean(
      f.edicion.publicaEn && f.edicion.publicaEn.getTime() <= ahora.getTime(),
    ),
  };
}

/**
 * Las notas que se pueden poner en un newsletter: las de las últimas ediciones,
 * también las que todavía no salieron (para armarlo antes).
 *
 * Quedan afuera las páginas de un PDF sin digitalizar: no tienen texto propio
 * —su título es "Página 3"— y en un correo no dicen nada.
 */
export async function notasCandidatas(ediciones = 6): Promise<NotaCandidata[]> {
  const ultimas = await db().edicion.findMany({
    orderBy: [{ anio: "desc" }, { numero: "desc" }],
    take: ediciones,
    select: { id: true },
  });
  const filas = await db().nota.findMany({
    where: {
      edicionId: { in: ultimas.map((e) => e.id) },
      textoPlano: { not: "" },
    },
    orderBy: [
      { edicion: { anio: "desc" } },
      { edicion: { numero: "desc" } },
      { orden: "asc" },
    ],
    select: SELECCION_NOTA,
  });
  const ahora = new Date();
  return filas.map((f) => aCandidata(f, ahora));
}

/**
 * Las notas elegidas, listas para el correo y en el orden elegido.
 *
 * Las que ya no existen se caen, y vuelven en `faltan` para que el panel
 * avise: mandar un newsletter con un enlace a una nota borrada es mandar a la
 * gente a un 404.
 */
export async function resolverNotas(elegidas: NotaElegida[]): Promise<{
  notas: NotaCandidata[];
  faltan: string[];
}> {
  if (elegidas.length === 0) return { notas: [], faltan: [] };
  const filas = await db().nota.findMany({
    where: { slug: { in: elegidas.map((e) => e.slug) } },
    select: SELECCION_NOTA,
  });
  const ahora = new Date();
  const porSlug = new Map(filas.map((f) => [f.slug, aCandidata(f, ahora)]));
  const notas: NotaCandidata[] = [];
  const faltan: string[] = [];
  for (const e of elegidas) {
    const n = porSlug.get(e.slug);
    if (!n) faltan.push(e.slug);
    else notas.push({ ...n, resumen: e.resumen.trim() || n.bajada });
  }
  return { notas, faltan };
}
