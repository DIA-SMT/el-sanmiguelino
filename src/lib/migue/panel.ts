import "server-only";

import { guiaDelPanel, AYUDA, type PantallaDelPanel } from "@/lib/migue/ayuda-panel";
import { pedirAlModelo, type Turno } from "@/lib/migue/openrouter";

/**
 * Migue en el panel: el que ayuda a la redacción a usar la herramienta.
 *
 * Es el mismo personaje y el mismo modelo que el del diario, pero **no sabe lo
 * mismo**. Aquél contesta sobre las notas de la edición; éste, sobre cómo se
 * usa el panel, y lo único que sabe del panel es la guía de
 * `ayuda-panel.ts` —las mismas respuestas que ofrece como preguntas de cada
 * pantalla—. La regla es la misma que la del diario y por la misma razón: un
 * asistente que inventa un botón que no existe o una regla que no se cumple
 * manda a alguien a apretar algo equivocado en una herramienta que publica al
 * instante.
 *
 * Tampoco ve datos: no sabe cuántos comentarios hay en revisión ni quién entró
 * ayer. Eso lo dice cada pantalla, y una cifra contada por el modelo sería una
 * cifra inventada.
 */

function instrucciones(nombre: string, pantalla: PantallaDelPanel): string {
  return [
    `Sos Migue, el asistente de El Sanmiguelino, el diario digital mensual de la Municipalidad de San Miguel de Tucumán.`,
    `Ahora estás en el PANEL DE ADMINISTRACIÓN, ayudando a ${nombre}, que forma parte de la redacción, a usar el panel.`,
    `Tuteá, en español rioplatense, cordial y directo.`,
    ``,
    `REGLA PRINCIPAL, POR ENCIMA DE TODO:`,
    `Lo único que sabés del panel es la GUÍA DEL PANEL de abajo. No inventes botones, pantallas, pasos, reglas ni opciones que no estén ahí.`,
    `Tampoco tenés datos: no sabés cuántas notas, comentarios, usuarios o suscripciones hay, ni qué pasó hoy. Si te lo preguntan, decí que eso lo muestra la pantalla correspondiente y cuál es.`,
    `Si la respuesta no está en la guía, decilo con naturalidad —"eso no lo tengo"— y sugerí a qué pantalla mirar o que lo consulte con quien administra el sistema. Decir que no sabés es siempre mejor que adivinar.`,
    `No des instrucciones técnicas de servidores, bases de datos, variables de entorno ni código: no las tenés.`,
    ``,
    `Saludá una sola vez. Contestá en pocas oraciones, con los nombres de los botones tal como aparecen en la guía.`,
    ``,
    `DÓNDE ESTÁ AHORA: en la pantalla "${AYUDA[pantalla].nombre}". Si te habla de "esta pantalla" o "acá", es ésa.`,
    ``,
    `GUÍA DEL PANEL:`,
    guiaDelPanel(),
  ].join("\n");
}

/**
 * Le pregunta al modelo. `null` si no se pudo (sin clave, error, demora): el
 * llamador contesta con el respaldo, que manda a las preguntas de la pantalla.
 */
export async function preguntarSobreElPanel({
  pregunta,
  pantalla,
  nombre,
  historial,
}: {
  pregunta: string;
  pantalla: PantallaDelPanel;
  nombre: string;
  historial: Turno[];
}): Promise<string | null> {
  const crudo = await pedirAlModelo({
    sistema: [instrucciones(nombre, pantalla)],
    historial,
    pregunta,
  });
  if (crudo === null) return null;
  // Por las dudas: la línea FUENTE es del Migue del diario, y acá no hay notas
  // que citar. Si el modelo la escribe igual, se saca antes de mostrarla.
  const limpia = crudo
    .split("\n")
    .filter((l) => !/^\s*FUENTE\s*:/i.test(l))
    .join("\n")
    .trim();
  return limpia || null;
}
