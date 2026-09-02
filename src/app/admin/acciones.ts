"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { COOKIE_EDICION } from "@/lib/auth/vista-previa";
import { desdeHoraTucuman } from "@/lib/fecha-edicion";
import {
  subirImagen,
  urlFirmadaParaPdf,
  verificarPdfSubido,
} from "@/lib/storage";
import {
  guardarPdfDeEdicion,
  quitarPdfDeEdicion,
} from "@/lib/repos/edicion-pdf";
import { borrarEdicion } from "@/lib/repos/edicion-borrar";
import { requerirAdmin } from "@/lib/auth/dal";
import { guardarNota } from "@/lib/repos/edicion";
import { comentariosRepo } from "@/lib/repos/comentarios";
import { cambiarBloqueo, cambiarRol } from "@/lib/repos/usuarios";
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

    const {
      slug,
      slugOriginal,
      seccion,
      titulo,
      bajada,
      cuerpo,
      imagen,
      edicionSlug,
    } = borrador;

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
      // Si no viene, el repo la manda a la edición en foco, como antes. Que
      // exista de verdad lo verifica el repo, que es quien tiene la base.
      ...(textoNoVacio(edicionSlug) ? { edicionSlug } : {}),
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
    const { slug, mes, numero, anio, etiqueta, publicaEn, tema, esNueva } =
      datos;

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
      // El tema del número. Vacío se guarda como null y no como cadena vacía:
      // la barra del diario decide con "hay tema o no", y "" es un tema.
      tema: textoNoVacio(tema) ? tema.trim() : null,
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

/**
 * Sube la foto de una nota y devuelve su dirección.
 *
 * Recibe el archivo por `FormData` y lo manda a Storage **desde el servidor**.
 * El navegador nunca ve la clave: subir directo desde el cliente exigiría
 * dársela, y la `service_role` no es una llave de subida sino una llave
 * maestra de todo el proyecto.
 *
 * No guarda la nota. Devuelve la URL y el editor la pone en el campo del
 * archivo, que se guarda con el resto cuando el redactor aprieta Guardar. Así
 * subir una foto y arrepentirse no deja la nota a medio cambiar.
 */
export async function subirImagenAction(
  datos: FormData,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  await requerirAdmin();

  try {
    const archivo = datos.get("archivo");
    const slug = datos.get("slug");
    if (!(archivo instanceof File)) throw new Error("No llegó ningún archivo.");
    const nombre =
      textoNoVacio(slug) && SLUG_VALIDO.test(slug) ? slug : "nota";

    const { url } = await subirImagen(archivo, nombre);
    return { ok: true, url };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo subir la foto.",
    };
  }
}

/* ------------------------------------------------------------------ usuarios */

/**
 * Cambiar el rol o bloquear a alguien.
 *
 * Las dos acciones **no repiten las reglas** de quién puede quedar sin permiso:
 * eso vive adentro de `repos/usuarios.ts`, en la misma transacción que la
 * escritura. Acá se valida la forma de lo que llega —que es lo que hace toda
 * acción de este archivo— y se traduce el motivo a algo que un administrador
 * entienda.
 *
 * `requerirAdmin()` va primero y por su cuenta, como en todas: una Server Action
 * es un endpoint POST con su propia URL y el layout no corre para ella.
 */

function explicar(motivo: "inexistente" | "es-del-entorno" | "ultimo-admin" | "uno-mismo"): string {
  switch (motivo) {
    case "inexistente":
      return "Esa persona ya no está en la lista.";
    case "es-del-entorno":
      return "Su rol viene de CIDITUC_ADMINS, así que se cambia en las variables de entorno y no acá.";
    case "ultimo-admin":
      return "Es el último administrador: dejarías al diario sin nadie que pueda entrar al panel.";
    case "uno-mismo":
      return "No podés bloquearte a vos mismo.";
  }
}

export async function cambiarRolAction(
  id: unknown,
  rol: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const { usuario } = await requerirAdmin();

  try {
    if (!textoNoVacio(id)) throw new Error("Falta la persona.");
    // Sólo los roles que la pantalla ofrece hoy. "editor" existe en el tipo pero
    // ningún camino del código lo mira todavía, así que aceptarlo acá sería
    // guardar un valor que no hace nada — el defecto que este repo condena por
    // escrito. Cuando `editor` signifique algo, se suma en el mismo commit.
    if (rol !== "lector" && rol !== "admin") throw new Error("Rol desconocido.");

    const resultado = await cambiarRol(id, rol, usuario.id);
    if (!resultado.ok) throw new Error(explicar(resultado.motivo));

    revalidatePath("/admin/usuarios");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo cambiar el rol.",
    };
  }
}

export async function cambiarBloqueoAction(
  id: unknown,
  bloqueado: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const { usuario } = await requerirAdmin();

  try {
    if (!textoNoVacio(id)) throw new Error("Falta la persona.");
    if (typeof bloqueado !== "boolean") throw new Error("Falta qué hacer.");

    const resultado = await cambiarBloqueo(id, bloqueado, usuario.id);
    if (!resultado.ok) throw new Error(explicar(resultado.motivo));

    revalidatePath("/admin/usuarios");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo cambiar el acceso.",
    };
  }
}


/* ------------------------------------------------------------------------
 * El PDF del impreso
 *
 * Son tres acciones y no una porque la subida no pasa por el servidor: el
 * archivo va del navegador a Storage, y el servidor sólo firma antes y
 * confirma después. El porqué está en `urlFirmadaParaPdf()`, en
 * src/lib/storage.ts — en resumen, en Vercel un request no puede pesar más de
 * 4,5 MB y el PDF de un diario mensual siempre pesa más.
 * --------------------------------------------------------------------- */

/**
 * Primer paso: pedir permiso para subir.
 *
 * Devuelve una dirección con un token adentro que autoriza escribir **una sola
 * clave**, la que elige el servidor, y por diez minutos. Lo que nunca sale de
 * acá es la `service_role`, que no es una llave de subida sino la llave
 * maestra del proyecto entero.
 */
export async function firmarSubidaPdfAction(edicionSlug: unknown): Promise<{
  ok: boolean;
  destino?: string;
  urlPublica?: string;
  error?: string;
}> {
  await requerirAdmin();

  try {
    if (!textoNoVacio(edicionSlug) || !SLUG_VALIDO.test(edicionSlug)) {
      throw new Error("Falta la edición.");
    }
    const { destino, urlPublica } = await urlFirmadaParaPdf(edicionSlug);
    return { ok: true, destino, urlPublica };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "No se pudo preparar la subida.",
    };
  }
}

/**
 * Tercer paso: el archivo ya está en el bucket, guardarlo en la edición.
 *
 * **Confirma contra el storage antes de guardar nada.** Quien llama es nuestro
 * propio panel, pero lo que dice —"quedó subido acá"— es exactamente lo que no
 * se puede dar por bueno: si la subida falló a mitad de camino, la edición
 * quedaría apuntando a un objeto que no existe y el error aparecería recién
 * cuando un lector abre el diario.
 *
 * El número de páginas sí sale del navegador, que es el único que tiene los
 * bytes. Se valida que sea un entero razonable y nada más: contarlas del lado
 * del servidor significaría bajar y parsear el PDF entero en cada carga. Quien
 * miente ahí es un administrador rompiendo su propio número, no un problema de
 * seguridad — y se ve al toque, porque el diario queda con páginas de más o de
 * menos.
 */
export async function guardarPdfEdicionAction(datos: unknown): Promise<{
  ok: boolean;
  error?: string;
  paginas?: number;
  borradas?: number;
  notasBorradas?: number;
}> {
  await requerirAdmin();

  try {
    if (!esObjeto(datos)) throw new Error("Faltan los datos del PDF.");
    const { slug, url, paginas, reemplazarNotasEscritas } = datos;

    if (!textoNoVacio(slug) || !SLUG_VALIDO.test(slug)) {
      throw new Error("Falta la edición.");
    }
    if (!textoNoVacio(url)) throw new Error("Falta la dirección del archivo.");

    // Que esté, que sea un PDF y que pese lo que tiene que pesar. Tira con un
    // mensaje que dice qué pasó.
    await verificarPdfSubido(url);

    const resultado = await guardarPdfDeEdicion(slug, url, Number(paginas), {
      // `=== true` y no un truthy: esta bandera borra notas escritas, así que
      // un `"false"`, un `1` o un `{}` que llegue por la URL de la acción no
      // puede valer por un sí.
      reemplazarNotasEscritas: reemplazarNotasEscritas === true,
    });

    // El diario entero cambia: la tapa, cada página, el archivo y el índice que
    // el layout baja al mando de paso de página.
    revalidatePath("/diario");
    revalidatePath("/archivo");
    revalidatePath("/buscar");
    revalidatePath("/admin/ediciones");
    revalidatePath("/admin");
    revalidatePath("/", "layout");

    return { ok: true, ...resultado };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo guardar el PDF.",
    };
  }
}

/** Saca el PDF de la edición. Borra las páginas y sus comentarios; el objeto
 *  del bucket queda donde está (ver `quitarPdfDeEdicion`). */
export async function quitarPdfEdicionAction(datos: unknown): Promise<{
  ok: boolean;
  error?: string;
  borradas?: number;
  comentariosBorrados?: number;
}> {
  await requerirAdmin();

  try {
    // Antes recibía el slug pelado. Pasa a recibir un objeto porque ahora hay
    // una confirmación que viaja con él, y porque las otras tres acciones del
    // PDF ya son así.
    if (!esObjeto(datos)) throw new Error("Faltan los datos del PDF.");
    const { slug, confirmarComentarios } = datos;

    if (!textoNoVacio(slug) || !SLUG_VALIDO.test(slug)) {
      throw new Error("Falta la edición.");
    }
    const { borradas, comentariosBorrados } = await quitarPdfDeEdicion(slug, {
      // `=== true` y no un truthy, igual que `reemplazarNotasEscritas`: esta
      // bandera borra comentarios de vecinos, así que un `"false"` o un `1`
      // que llegue por la URL de la acción no puede valer por un sí.
      confirmarComentarios: confirmarComentarios === true,
    });

    revalidatePath("/diario");
    revalidatePath("/archivo");
    revalidatePath("/buscar");
    revalidatePath("/admin/ediciones");
    revalidatePath("/admin");
    revalidatePath("/", "layout");

    return { ok: true, borradas, comentariosBorrados };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo quitar el PDF.",
    };
  }
}


/**
 * Borra una edición, con todo lo que tenga adentro.
 *
 * La única acción del panel que pierde datos de un vecino: la cascada del
 * esquema se lleva las notas —o las páginas del facsímil—, sus comentarios y sus
 * votos. Las comprobaciones viven en `borrarEdicion()`, del lado del servidor, y
 * son las que mandan: lo que dibuja la pantalla es una cortesía.
 *
 * Devuelve qué se llevó puesto, para que el panel pueda decirlo en lugar de un
 * "listo" que no deja rastro de lo que pasó.
 */
export async function borrarEdicionAction(datos: unknown): Promise<{
  ok: boolean;
  error?: string;
  borrado?: { mes: string; notas: number; paginas: number; comentarios: number };
}> {
  await requerirAdmin();

  try {
    if (!esObjeto(datos)) throw new Error("Faltan los datos de la edición.");
    const { slug, confirmacion } = datos;

    if (!textoNoVacio(slug) || !SLUG_VALIDO.test(slug)) {
      throw new Error("Falta la edición.");
    }

    const perdido = await borrarEdicion(
      slug,
      textoNoVacio(confirmacion) ? confirmacion.trim() : undefined,
    );

    /*
     * Si el administrador estaba PREVISUALIZANDO justo esta, la cookie queda
     * apuntando a una edición que ya no existe.
     *
     * El diario no se rompe —`edicionActualFila()` se cae a la publicada cuando
     * el slug de la cookie no está— pero la barra de vista previa seguiría
     * diciendo que está mirando un número que borró. Se limpia acá.
     */
    const jar = await cookies();
    if (jar.get(COOKIE_EDICION)?.value === slug) {
      jar.delete(COOKIE_EDICION);
    }

    // El diario entero puede haber cambiado de número: si la borrada era la que
    // estaba en la calle, ahora sirve la anterior.
    revalidatePath("/diario");
    revalidatePath("/archivo");
    revalidatePath("/buscar");
    revalidatePath("/admin/ediciones");
    revalidatePath("/admin");
    revalidatePath("/", "layout");

    return {
      ok: true,
      borrado: {
        mes: perdido.mes,
        notas: perdido.notas,
        paginas: perdido.paginas,
        comentarios: perdido.comentarios,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo borrar la edición.",
    };
  }
}
