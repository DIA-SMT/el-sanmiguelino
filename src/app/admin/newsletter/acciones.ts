"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requerirAdmin } from "@/lib/auth/dal";
import { anotar } from "@/lib/repos/auditoria";
import {
  TOPES,
  borrarBoletin,
  crearBoletin,
  guardarBoletin,
  obtenerBoletin,
  resolverNotas,
  type CambiosDelBoletin,
} from "@/lib/repos/boletines";
import {
  contarPorEstado,
  darDeBaja,
  nombreDeSuscripcion,
} from "@/lib/repos/suscripciones";
import {
  enviarCorreo,
  pruebasRecientes,
  saleDeVerdad,
} from "@/lib/correo/enviar";
import { armarBoletin } from "@/lib/newsletter/plantilla";
import {
  cancelarProgramacion,
  detenerEnvio,
  programarEnvio,
} from "@/lib/newsletter/envios";
import { fechaLegible, horaDeTucuman, revisarHora } from "@/lib/newsletter/cola";
import { SITIO_URL } from "@/lib/compartir";

/**
 * Las acciones del newsletter en el panel.
 *
 * Mismas reglas que `admin/acciones.ts`: cada una pide permiso por su cuenta
 * (una Server Action es un POST con URL propia y el layout no corre para ella),
 * valida lo que recibe aunque venga de nuestro propio formulario, y anota en
 * la auditoría lo que hizo.
 *
 * **Ninguna le escribe directamente a un suscriptor.** «Enviar prueba» sale de
 * verdad, a la dirección que se escribe, cuando la cuenta del diario está
 * conectada (ver `correo/enviar.ts`); si no, queda en la bandeja del panel.
 * «Enviar a la lista» sólo lo programa: lo manda la cola (`newsletter/envios.ts`),
 * y les llega a los vecinos sólo si el municipio autorizó el envío real.
 */

/** El enlace de baja de un correo de prueba: no da de baja a nadie, y la
 *  página lo explica. */
const BAJA_DE_PRUEBA = `${SITIO_URL.origin}/newsletter/baja?prueba=1`;

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Pruebas por hora y por persona. Con proveedor, cada una es un correo. */
const TOPE_PRUEBAS_HORA = 10;

function texto(v: unknown, tope: number, campo: string): string {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") throw new Error(`${campo}: no es texto.`);
  const t = v.trim();
  if (t.length > tope) {
    throw new Error(`${campo} supera los ${tope} caracteres.`);
  }
  return t;
}

function validar(datos: unknown): { id: string; cambios: CambiosDelBoletin } {
  if (typeof datos !== "object" || datos === null) {
    throw new Error("Datos inválidos.");
  }
  const d = datos as Record<string, unknown>;
  if (typeof d.id !== "string" || !d.id) throw new Error("Falta el newsletter.");
  const asunto = texto(d.asunto, TOPES.asunto, "El asunto");
  if (!asunto) throw new Error("Falta el asunto: es lo primero que se lee.");
  if (!Array.isArray(d.notas)) throw new Error("Las notas no vinieron bien.");
  if (d.notas.length > TOPES.notas) {
    throw new Error(`Son muchas notas: el tope es ${TOPES.notas}.`);
  }
  const vistas = new Set<string>();
  const notas = d.notas.map((n, i) => {
    if (typeof n !== "object" || n === null) {
      throw new Error(`La nota ${i + 1} no vino bien.`);
    }
    const { slug, resumen } = n as Record<string, unknown>;
    if (typeof slug !== "string" || !slug || slug.length > 200) {
      throw new Error(`La nota ${i + 1} no vino bien.`);
    }
    if (vistas.has(slug)) throw new Error("Hay una nota repetida.");
    vistas.add(slug);
    return {
      slug,
      resumen: texto(resumen, TOPES.resumen, `El texto de la nota ${i + 1}`),
    };
  });
  return {
    id: d.id,
    cambios: {
      asunto,
      preencabezado: texto(
        d.preencabezado,
        TOPES.preencabezado,
        "La línea de vista previa",
      ),
      introduccion: texto(d.introduccion, TOPES.texto, "La introducción"),
      notas,
      cierre: texto(d.cierre, TOPES.texto, "El cierre"),
    },
  };
}

function mensaje(error: unknown): string {
  return error instanceof Error ? error.message : "No se pudo guardar.";
}

/** Desde el botón «Nuevo newsletter»: crea el borrador y abre el editor. */
export async function crearBoletinAction(): Promise<void> {
  const { usuario } = await requerirAdmin();
  const id = await crearBoletin(usuario, "Novedades de El Sanmiguelino");
  await anotar(usuario, {
    accion: "newsletter.creado",
    objetoId: id,
    resumen: "Empezó un newsletter nuevo",
  });
  revalidatePath("/admin/newsletter");
  redirect(`/admin/newsletter/${id}`);
}

export async function guardarBoletinAction(
  datos: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const { usuario } = await requerirAdmin();
  let validado: ReturnType<typeof validar>;
  try {
    validado = validar(datos);
  } catch (error) {
    return { ok: false, error: mensaje(error) };
  }
  const guardado = await guardarBoletin(validado.id, validado.cambios);
  if (!guardado) {
    return {
      ok: false,
      error: "Este newsletter ya no existe o ya no es un borrador.",
    };
  }
  await anotar(usuario, {
    accion: "newsletter.guardado",
    objetoId: validado.id,
    resumen: `Guardó el newsletter «${validado.cambios.asunto}»`,
    detalle: { notas: validado.cambios.notas.length },
  });
  revalidatePath("/admin/newsletter");
  revalidatePath(`/admin/newsletter/${validado.id}`);
  return { ok: true };
}

/**
 * Manda el newsletter **guardado** a una dirección, de prueba.
 *
 * Lo guardado y no lo que está en pantalla: así la prueba es exactamente lo
 * que saldría. El editor guarda antes de llamar a esto.
 *
 * Sin la cuenta conectada no sale: queda en la bandeja del panel.
 */
export async function enviarPruebaAction(datos: unknown): Promise<{
  ok: boolean;
  error?: string;
  correoId?: string;
  /** Salió de verdad (true) o quedó simulado en la bandeja (false). */
  enviado?: boolean;
}> {
  const { usuario } = await requerirAdmin();
  const d = (typeof datos === "object" && datos !== null ? datos : {}) as {
    id?: unknown;
    para?: unknown;
  };
  const para = typeof d.para === "string" ? d.para.trim().toLowerCase() : "";
  if (!CORREO.test(para) || para.length > 160) {
    return { ok: false, error: "Esa dirección no parece un correo." };
  }
  if (typeof d.id !== "string") return { ok: false, error: "Falta el newsletter." };

  const boletin = await obtenerBoletin(d.id);
  if (!boletin) return { ok: false, error: "Este newsletter ya no existe." };
  const { notas, faltan } = await resolverNotas(boletin.notas);
  if (notas.length === 0) {
    return { ok: false, error: "Agregá al menos una nota antes de probar." };
  }
  if ((await pruebasRecientes(usuario.id)) >= TOPE_PRUEBAS_HORA) {
    return {
      ok: false,
      error: `Ya mandaste ${TOPE_PRUEBAS_HORA} pruebas en la última hora. Esperá un rato.`,
    };
  }

  const correo = armarBoletin(
    {
      asunto: boletin.asunto,
      preencabezado: boletin.preencabezado,
      introduccion: boletin.introduccion,
      notas,
      cierre: boletin.cierre,
    },
    BAJA_DE_PRUEBA,
  );
  const envio = await enviarCorreo({
    para,
    correo: { ...correo, asunto: `[Prueba] ${correo.asunto}` },
    tipo: "prueba",
    boletinId: boletin.id,
    autorId: usuario.id,
  });
  // El destinatario no va en el registro: es un correo, y el registro no es
  // lugar para juntarlos.
  await anotar(usuario, {
    accion: "newsletter.prueba",
    objetoId: boletin.id,
    resumen:
      envio.estado === "fallido"
        ? `Intentó mandar una prueba del newsletter «${boletin.asunto}» y falló`
        : `Mandó una prueba del newsletter «${boletin.asunto}»`,
    detalle: { notas: notas.length, faltan: faltan.length, estado: envio.estado },
  });
  revalidatePath("/admin/newsletter");
  if (envio.estado === "fallido") {
    return { ok: false, error: envio.error, correoId: envio.id };
  }
  return { ok: true, correoId: envio.id, enviado: envio.estado === "enviado" };
}

/**
 * «Enviar ahora» o «Programar envío». Manda lo guardado: el editor guarda
 * antes de llamar a esto.
 *
 * No manda nada por sí misma: deja el newsletter "programado" y la cola lo
 * toma a su hora. Hasta entonces se puede cancelar.
 */
export async function programarEnvioAction(
  datos: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const { usuario } = await requerirAdmin();
  const d = (typeof datos === "object" && datos !== null ? datos : {}) as {
    id?: unknown;
    cuando?: unknown;
  };
  if (typeof d.id !== "string") return { ok: false, error: "Falta el newsletter." };

  const ahora = new Date();
  let cuando: Date | null = null;
  if (d.cuando === "ahora") {
    cuando = ahora;
  } else if (typeof d.cuando === "object" && d.cuando !== null) {
    const { fecha, hora } = d.cuando as { fecha?: unknown; hora?: unknown };
    if (typeof fecha === "string" && typeof hora === "string") {
      cuando = horaDeTucuman(fecha, hora);
    }
  }
  if (!cuando) return { ok: false, error: "Elegí una fecha y una hora que existan." };
  const problema = revisarHora(cuando, ahora);
  if (problema === "pasada") {
    return { ok: false, error: "Esa hora ya pasó. Elegí una más adelante, o «Ahora»." };
  }
  if (problema === "muy-lejos") {
    return { ok: false, error: "Se puede programar hasta dos meses para adelante." };
  }

  const boletin = await obtenerBoletin(d.id);
  if (!boletin) return { ok: false, error: "Este newsletter ya no existe." };
  if (boletin.estado !== "borrador") {
    return { ok: false, error: "Este newsletter ya está programado o enviado." };
  }
  const { notas, faltan } = await resolverNotas(boletin.notas);
  if (notas.length === 0) {
    return { ok: false, error: "Agregá al menos una nota antes de enviarlo." };
  }
  if (faltan.length > 0) {
    return {
      ok: false,
      error: "Hay notas que ya no existen en el diario. Guardá de nuevo para sacarlas y revisalo antes de enviar.",
    };
  }
  const { activa } = await contarPorEstado();
  if (activa === 0) {
    return {
      ok: false,
      error: "Todavía nadie confirmó su suscripción: no hay a quién mandárselo.",
    };
  }

  if (!(await programarEnvio(boletin.id, cuando, usuario))) {
    return { ok: false, error: "Este newsletter ya está programado o enviado." };
  }
  const real = saleDeVerdad("boletin");
  await anotar(usuario, {
    accion: "newsletter.programado",
    objetoId: boletin.id,
    resumen:
      d.cuando === "ahora"
        ? `Mandó el newsletter «${boletin.asunto}» a la lista${real ? "" : " (de práctica)"}`
        : `Programó el newsletter «${boletin.asunto}» para el ${fechaLegible(cuando)}${real ? "" : " (de práctica)"}`,
    detalle: {
      para: cuando.toISOString(),
      destinatarios: activa,
      notas: notas.length,
      real,
    },
  });
  revalidatePath("/admin/newsletter");
  revalidatePath(`/admin/newsletter/${boletin.id}`);
  return { ok: true };
}

/** Vuelve un programado a borrador, si todavía no empezó a salir. */
export async function cancelarProgramacionAction(
  id: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const { usuario } = await requerirAdmin();
  if (typeof id !== "string") return { ok: false, error: "Falta el newsletter." };
  const boletin = await obtenerBoletin(id);
  if (!boletin) return { ok: false, error: "Este newsletter ya no existe." };
  if (!(await cancelarProgramacion(id))) {
    return {
      ok: false,
      error: "Ya empezó a salir. Si querés frenarlo, usá «Detener el envío».",
    };
  }
  await anotar(usuario, {
    accion: "newsletter.programacion-cancelada",
    objetoId: id,
    resumen: `Canceló el envío programado del newsletter «${boletin.asunto}»`,
  });
  revalidatePath("/admin/newsletter");
  revalidatePath(`/admin/newsletter/${id}`);
  return { ok: true };
}

/** Frena un envío en curso. Lo que ya salió, salió. */
export async function detenerEnvioAction(
  id: unknown,
): Promise<{ ok: boolean; error?: string; sinRecibir?: number }> {
  const { usuario } = await requerirAdmin();
  if (typeof id !== "string") return { ok: false, error: "Falta el newsletter." };
  const boletin = await obtenerBoletin(id);
  if (!boletin) return { ok: false, error: "Este newsletter ya no existe." };
  const sinRecibir = await detenerEnvio(id, usuario);
  if (sinRecibir === null) {
    return { ok: false, error: "Este envío ya no está en curso." };
  }
  await anotar(usuario, {
    accion: "newsletter.envio-detenido",
    objetoId: id,
    resumen: `Detuvo el envío del newsletter «${boletin.asunto}»`,
    detalle: { sinRecibir },
  });
  revalidatePath("/admin/newsletter");
  revalidatePath(`/admin/newsletter/${id}`);
  return { ok: true, sinRecibir };
}

export async function borrarBoletinAction(
  id: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const { usuario } = await requerirAdmin();
  if (typeof id !== "string") return { ok: false, error: "Falta el newsletter." };
  const boletin = await obtenerBoletin(id);
  if (!boletin || !(await borrarBoletin(id))) {
    return { ok: false, error: "Este newsletter ya no existe o ya no es un borrador." };
  }
  await anotar(usuario, {
    accion: "newsletter.borrado",
    objetoId: id,
    resumen: `Borró el newsletter «${boletin.asunto}»`,
  });
  revalidatePath("/admin/newsletter");
  return { ok: true };
}

/**
 * Dar de baja a un vecino desde el panel, cuando lo pide por otro canal.
 *
 * No hay "dar de alta" desde el panel, y es a propósito: anotarse lo hace cada
 * persona, con su cuenta, y confirma con su correo. Si el municipio pudiera
 * anotar a alguien, la lista dejaría de ser de gente que pidió recibirlo.
 */
export async function darDeBajaSuscripcionAction(
  id: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const { usuario } = await requerirAdmin();
  if (typeof id !== "string") return { ok: false, error: "Falta la suscripción." };
  const nombre = await nombreDeSuscripcion(id);
  if (nombre === null) return { ok: false, error: "Esa suscripción ya no existe." };
  const cambio = await darDeBaja(id, "panel");
  if (cambio) {
    await anotar(usuario, {
      accion: "suscripciones.baja",
      objetoId: id,
      resumen: `Dio de baja del newsletter a ${nombre}`,
    });
  }
  revalidatePath("/admin/suscripciones");
  revalidatePath("/admin/newsletter");
  return { ok: true };
}
