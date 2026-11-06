import "server-only";
import { db } from "@/lib/db";
import { imagenDisponible } from "@/lib/data/imagenes";
import {
  esBloque,
  type BloqueDelBoletin,
  type NotaDelBoletin,
} from "@/lib/newsletter/plantilla";

/**
 * Los newsletters que se arman en el panel.
 *
 * Se arman, se guardan como borrador, se ven y se mandan de prueba. Programar
 * y enviar a la lista vive en `newsletter/envios.ts`: desde que se programa,
 * deja de ser borrador y ya no se edita.
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

/** Lo que se guarda en la lista: notas por referencia, bloques copiados. */
export type PiezaElegida = NotaElegida | BloqueDelBoletin;

/** Una pieza lista para el correo: la nota con sus datos, o el bloque. */
export type PiezaResuelta = NotaCandidata | BloqueDelBoletin;

export interface Boletin {
  id: string;
  asunto: string;
  preencabezado: string;
  introduccion: string;
  notas: PiezaElegida[];
  cierre: string;
  estado: string;
  autorNombre: string;
  creadoEn: string;
  actualizadoEn: string;
  /* El envío (etapa 2). Vacíos mientras es borrador. */
  programadoPara: string | null;
  programadoPorNombre: string | null;
  envioIniciadoEn: string | null;
  envioTerminadoEn: string | null;
  canceladoEn: string | null;
  canceladoPorNombre: string | null;
  motivoCancelacion: string | null;
  destinatarios: number | null;
}

export interface BoletinEnLista {
  id: string;
  asunto: string;
  estado: string;
  notas: number;
  autorNombre: string;
  actualizadoEn: string;
  programadoPara: string | null;
  destinatarios: number | null;
}

const iso = (d: Date | null) => d?.toISOString() ?? null;

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

/** Un bloque leído de la columna Json, o null si no tiene forma de bloque. */
function aBloque(v: Record<string, unknown>): BloqueDelBoletin | null {
  if (v.tipo !== "bloque" || typeof v.enlace !== "string") return null;
  if (!/^https:\/\//.test(v.enlace)) return null;
  const t = (x: unknown) => (typeof x === "string" ? x : "");
  const img = v.imagen as { src?: unknown; alt?: unknown } | undefined;
  return {
    tipo: "bloque",
    id: t(v.id) || Math.random().toString(36).slice(2, 10),
    titulo: t(v.titulo),
    texto: t(v.texto),
    enlace: v.enlace,
    boton: t(v.boton),
    ...(img && typeof img.src === "string" && /^https:\/\//.test(img.src)
      ? { imagen: { src: img.src, alt: t(img.alt) } }
      : {}),
  };
}

/** Lee lo que vuelve de la columna Json sin confiar en su forma: notas
 *  (`{ slug, resumen }`) y bloques propios (`{ tipo: "bloque", … }`). */
export function aPiezas(valor: unknown): PiezaElegida[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((v): PiezaElegida[] => {
    if (!v || typeof v !== "object") return [];
    if ((v as { tipo?: unknown }).tipo === "bloque") {
      const b = aBloque(v as Record<string, unknown>);
      return b ? [b] : [];
    }
    return typeof v.slug === "string"
      ? [
          {
            slug: v.slug,
            resumen: typeof v.resumen === "string" ? v.resumen : "",
          },
        ]
      : [];
  });
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
      programadoPara: true,
      destinatarios: true,
    },
  });
  return filas.map((f) => ({
    id: f.id,
    asunto: f.asunto,
    estado: f.estado,
    notas: aPiezas(f.notas).length,
    autorNombre: f.autorNombre,
    actualizadoEn: f.actualizadoEn.toISOString(),
    programadoPara: iso(f.programadoPara),
    destinatarios: f.destinatarios,
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
    notas: aPiezas(f.notas),
    cierre: f.cierre,
    estado: f.estado,
    autorNombre: f.autorNombre,
    creadoEn: f.creadoEn.toISOString(),
    actualizadoEn: f.actualizadoEn.toISOString(),
    programadoPara: iso(f.programadoPara),
    programadoPorNombre: f.programadoPorNombre,
    envioIniciadoEn: iso(f.envioIniciadoEn),
    envioTerminadoEn: iso(f.envioTerminadoEn),
    canceladoEn: iso(f.canceladoEn),
    canceladoPorNombre: f.canceladoPorNombre,
    motivoCancelacion: f.motivoCancelacion,
    destinatarios: f.destinatarios,
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
  notas: PiezaElegida[];
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
export async function resolverNotas(elegidas: PiezaElegida[]): Promise<{
  /** Notas y bloques, en el orden elegido. */
  notas: PiezaResuelta[];
  faltan: string[];
}> {
  if (elegidas.length === 0) return { notas: [], faltan: [] };
  const slugs = elegidas.flatMap((e) => (esBloque(e) ? [] : [e.slug]));
  const filas = slugs.length
    ? await db().nota.findMany({
        where: { slug: { in: slugs } },
        select: SELECCION_NOTA,
      })
    : [];
  const ahora = new Date();
  const porSlug = new Map(filas.map((f) => [f.slug, aCandidata(f, ahora)]));
  const notas: PiezaResuelta[] = [];
  const faltan: string[] = [];
  for (const e of elegidas) {
    // Un bloque propio no depende de nada: va como está.
    if (esBloque(e)) {
      notas.push(e);
      continue;
    }
    const n = porSlug.get(e.slug);
    if (!n) faltan.push(e.slug);
    else notas.push({ ...n, resumen: e.resumen.trim() || n.bajada });
  }
  return { notas, faltan };
}

/** Sólo las notas del diario de una lista resuelta, sin los bloques. */
export function soloNotas(piezas: PiezaResuelta[]): NotaCandidata[] {
  return piezas.filter((p): p is NotaCandidata => !esBloque(p));
}
