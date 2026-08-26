"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { COOKIE_EDICION } from "@/lib/auth/vista-previa";
import { desdeHoraTucuman } from "@/lib/fecha-edicion";
import { requerirAdmin } from "@/lib/auth/dal";
import { guardarNota } from "@/lib/repos/edicion";
import { comentariosRepo } from "@/lib/repos/comentarios";
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


/**
 * Moderación de un comentario.
 *
 * El moderador sale de la sesión, nunca del formulario: quien dio de baja algo
 * es un dato de auditoría, y un campo que manda el cliente no lo es.
 *
 * No hay acción de borrar, y no es un olvido. Un comentario dado de baja se
 * oculta y conserva su texto, sus votos y el rastro de quién lo bajó. Una
 * publicación oficial que esconde la palabra de un vecino tiene que poder
 * decir quién lo decidió, y eso es imposible sobre una fila borrada.
 */
export async function moderarComentarioAction(
  comentarioId: unknown,
  accion: unknown,
  motivo?: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const { usuario } = await requerirAdmin();

  try {
    if (!textoNoVacio(comentarioId)) throw new Error("Falta el comentario.");
    if (accion !== "bajar" && accion !== "restituir") {
      throw new Error("Acción desconocida.");
    }

    const resultado =
      accion === "bajar"
        ? await comentariosRepo.darDeBaja(
            comentarioId,
            usuario.id,
            textoNoVacio(motivo) ? motivo : undefined,
          )
        : await comentariosRepo.restituir(comentarioId, usuario.id);

    if (!resultado) throw new Error("Ese comentario ya no existe.");

    // La tapa destaca el último comentario visible, así que bajar uno la
    // cambia. Y la nota muestra su columna del lector.
    revalidatePath("/admin/comentarios");
    revalidatePath("/diario");
    revalidatePath(`/nota/${resultado.notaSlug}`);

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo moderar.",
    };
  }
}

/**
 * Crea o actualiza una edición, con su fecha de publicación.
 *
 * La fecha llega como la escribió el panel —hora de Tucumán— y se convierte
 * acá. Dejarla pasar tal cual guardaría el instante equivocado por tres horas,
 * que es justo lo que hace salir una edición la noche anterior.
 */
export async function guardarEdicionAction(datos: unknown): Promise<{
  ok: boolean;
  error?: string;
}> {
  await requerirAdmin();

  try {
    if (!esObjeto(datos)) throw new Error("Faltan los datos de la edición.");
    const { slug, mes, numero, anio, etiqueta, publicaEn, esNueva } = datos;

    if (!textoNoVacio(slug) || !SLUG_VALIDO.test(slug)) {
      throw new Error(
        "El slug de la edición sólo puede llevar minúsculas, números y " +
          "guiones (ej.: septiembre-2026).",
      );
    }
    if (!textoNoVacio(mes)) throw new Error("Falta el mes (ej.: Septiembre de 2026).");
    const n = Number(numero);
    const a = Number(anio);
    if (!Number.isInteger(n) || n < 1) throw new Error("El número de edición tiene que ser un entero.");
    if (!Number.isInteger(a) || a < 2000) throw new Error("El año no parece un año.");

    // Sin fecha se puede guardar: es una edición en preparación, y no salir
    // sola es exactamente lo que se quiere de ella.
    let instante: Date | null = null;
    if (textoNoVacio(publicaEn)) {
      instante = desdeHoraTucuman(publicaEn);
      if (!instante) throw new Error("La fecha de publicación no se entiende.");
    }

    const campos = {
      mes,
      numero: n,
      anio: a,
      etiqueta: textoNoVacio(etiqueta) ? etiqueta : null,
      publicaEn: instante,
    };

    const existente = await db().edicion.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (esNueva === true) {
      if (existente) {
        throw new Error(`Ya hay una edición con el slug "${slug}".`);
      }
      await db().edicion.create({ data: { slug, ...campos } });
    } else {
      if (!existente) throw new Error("Esa edición ya no existe.");
      await db().edicion.update({ where: { slug }, data: campos });
    }

    revalidatePath("/admin/ediciones");
    revalidatePath("/admin");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo guardar la edición.",
    };
  }
}

/**
 * Pone una edición "en foco", o vuelve a la publicada.
 *
 * La cookie sola no da acceso: `edicionEnFoco()` vuelve a verificar que quien
 * pide sea administrador en cada request. Acá se exige de nuevo porque una
 * Server Action es su propio endpoint.
 */
export async function enfocarEdicionAction(
  slug: unknown,
): Promise<{ ok: boolean }> {
  await requerirAdmin();
  const jar = await cookies();

  if (typeof slug === "string" && slug.trim()) {
    jar.set(COOKIE_EDICION, slug.trim(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      // Corta al cerrar el navegador: mirar una edición futura es algo que se
      // hace un rato, no un modo en el que uno se queda a vivir sin darse
      // cuenta de que está viendo otra cosa.
    });
  } else {
    jar.delete(COOKIE_EDICION);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
