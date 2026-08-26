"use server";

import { revalidatePath } from "next/cache";
import { requerirAdmin } from "@/lib/auth/dal";
import { guardarNota } from "@/lib/repos/edicion";
import type { BloqueNota, NotaBorrador } from "@/lib/types";

/**
 * Acciones de escritura del panel.
 *
 * Cada una llama a `requerirAdmin()` por su cuenta. **Esto no es redundante
 * con el layout**: una Server Action es un endpoint POST con su propia URL, y
 * el layout no corre para ella. Una acción sin guardia es una ruta de
 * escritura abierta con la apariencia de estar protegida.
 *
 * Y valida la forma de lo que recibe, aunque el llamador sea nuestro propio
 * formulario tipado. Los tipos de TypeScript no existen en tiempo de
 * ejecución: quien conozca la URL puede mandar cualquier JSON. Es el precio de
 * guardar el cuerpo como Json en la base —al leer no se valida, así que lo que
 * entra acá es lo que después se sirve—.
 */

export interface ResultadoGuardar {
  ok: boolean;
  error?: string;
  slug?: string;
}

const TIPOS_CON_TEXTO = ["parrafo", "subtitulo", "destacado"] as const;

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function textoNoVacio(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

/** Valida un bloque y lo devuelve **proyectado**: sólo los campos que el tipo
 *  declara. Nunca el objeto recibido tal cual, para que un campo de más no
 *  llegue a la base ni al índice del buscador. */
function validarBloque(v: unknown, i: number): BloqueNota {
  if (!esObjeto(v)) throw new Error(`El bloque ${i + 1} no es un objeto.`);
  const tipo = v.tipo;

  if (typeof tipo !== "string") {
    throw new Error(`El bloque ${i + 1} no dice de qué tipo es.`);
  }

  if ((TIPOS_CON_TEXTO as readonly string[]).includes(tipo)) {
    if (!textoNoVacio(v.texto)) {
      throw new Error(`El bloque ${i + 1} (${tipo}) está vacío.`);
    }
    return { tipo, texto: v.texto } as BloqueNota;
  }

  if (tipo === "cita") {
    if (!textoNoVacio(v.texto)) {
      throw new Error(`La cita del bloque ${i + 1} está vacía.`);
    }
    if (!textoNoVacio(v.autor)) {
      throw new Error(
        `La cita del bloque ${i + 1} no dice quién la dijo. En una publicación ` +
          `oficial una cita sin autor no se publica.`,
      );
    }
    return {
      tipo: "cita",
      texto: v.texto,
      autor: v.autor,
      ...(textoNoVacio(v.cargo) ? { cargo: v.cargo } : {}),
      ...(textoNoVacio(v.retrato) ? { retrato: v.retrato } : {}),
    };
  }

  if (tipo === "ficha") {
    if (!textoNoVacio(v.titulo)) {
      throw new Error(`La ficha del bloque ${i + 1} no tiene título.`);
    }
    if (!Array.isArray(v.entradas) || v.entradas.length === 0) {
      throw new Error(`La ficha del bloque ${i + 1} no tiene entradas.`);
    }
    const entradas = v.entradas.map((e, j) => {
      if (!esObjeto(e) || !textoNoVacio(e.lead) || !textoNoVacio(e.texto)) {
        throw new Error(
          `La entrada ${j + 1} de la ficha del bloque ${i + 1} está incompleta.`,
        );
      }
      return { lead: e.lead, texto: e.texto };
    });
    return { tipo: "ficha", titulo: v.titulo, entradas };
  }

  throw new Error(`El bloque ${i + 1} es de un tipo desconocido: "${tipo}".`);
}

/** El slug tiene que poder ir en una URL sin escaparse: es la clave de la nota
 *  y de la que cuelgan los comentarios. */
const SLUG_VALIDO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function guardarNotaAction(
  borrador: unknown,
): Promise<ResultadoGuardar> {
  await requerirAdmin();

  try {
    if (!esObjeto(borrador)) throw new Error("Falta la nota.");

    const { slug, slugOriginal, seccion, titulo, bajada, cuerpo, imagen } =
      borrador;

    if (!textoNoVacio(slug) || !SLUG_VALIDO.test(slug)) {
      throw new Error(
        "El slug sólo puede llevar minúsculas, números y guiones (ej.: " +
          "plan-bacheo-integral).",
      );
    }
    if (!textoNoVacio(titulo)) throw new Error("Falta el título.");
    if (!textoNoVacio(bajada)) throw new Error("Falta la bajada.");
    if (!textoNoVacio(seccion)) throw new Error("Falta la sección.");
    if (!Array.isArray(cuerpo) || cuerpo.length === 0) {
      throw new Error("La nota no tiene cuerpo.");
    }

    const limpio: NotaBorrador = {
      slug,
      seccion,
      titulo,
      bajada,
      cuerpo: cuerpo.map(validarBloque),
      ...(textoNoVacio(slugOriginal) ? { slugOriginal } : {}),
      ...(esObjeto(imagen) && textoNoVacio(imagen.alt)
        ? {
            imagen: {
              alt: imagen.alt,
              epigrafe: textoNoVacio(imagen.epigrafe) ? imagen.epigrafe : "",
              ...(textoNoVacio(imagen.src) ? { src: imagen.src } : {}),
            },
          }
        : {}),
    };

    const guardada = await guardarNota(limpio);

    // Todo lo que muestra esta nota o el índice: la tapa, la nota, su sección,
    // el buscador y el panel. Es más barato invalidar de más que dejar una
    // pantalla mostrando la versión anterior.
    revalidatePath("/diario");
    revalidatePath(`/nota/${guardada.slug}`);
    if (typeof slugOriginal === "string" && slugOriginal !== guardada.slug) {
      revalidatePath(`/nota/${slugOriginal}`);
    }
    revalidatePath("/buscar");
    revalidatePath("/admin");
    revalidatePath("/", "layout");

    return { ok: true, slug: guardada.slug };
  } catch (e) {
    // El mensaje va al editor, así que tiene que decir qué arreglar. Un
    // "algo salió mal" obliga a adivinar cuál de veinte campos era.
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo guardar la nota.",
    };
  }
}
