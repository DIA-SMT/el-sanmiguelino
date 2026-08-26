/**
 * Conversión entre la hora de Tucumán y el instante que se guarda.
 *
 * Existe por un error concreto y fácil de cometer: "el 1 de septiembre" son las
 * 00:00 **en Tucumán**, no en UTC. Con tres horas de por medio, una edición
 * cargada sin cuidado sale el 31 de agosto a las 21.
 *
 * El desfase se calcula preguntándoselo al sistema para **esa fecha**, no con
 * un `-3` escrito a mano. Argentina hoy no cambia la hora, pero ya lo hizo
 * varias veces y volvería a hacerlo por decreto: una constante en el código
 * quedaría muda y las ediciones empezarían a salir con una hora de corrimiento
 * sin que nada avise.
 */

const ZONA = "America/Argentina/Tucuman";

/** Cuánto se corre Tucumán respecto de UTC en ese instante, en milisegundos. */
function desfase(instante: Date): number {
  const enZona = new Date(instante.toLocaleString("en-US", { timeZone: ZONA }));
  const enUtc = new Date(
    instante.toLocaleString("en-US", { timeZone: "UTC" }),
  );
  return enZona.getTime() - enUtc.getTime();
}

/**
 * De lo que el panel muestra (`"2026-09-01T00:00"`, hora de Tucumán) al
 * instante que va a la base.
 *
 * Se itera dos veces porque el desfase depende del instante, y el instante
 * depende del desfase: la primera pasada usa una aproximación y la segunda ya
 * cae del lado correcto aunque la fecha esté justo en un cambio de hora.
 */
export function desdeHoraTucuman(local: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const comoSiFueraUtc = new Date(local + ":00.000Z");
  if (Number.isNaN(comoSiFueraUtc.getTime())) return null;

  let instante = comoSiFueraUtc;
  for (let i = 0; i < 2; i++) {
    instante = new Date(comoSiFueraUtc.getTime() - desfase(instante));
  }
  return instante;
}

/** Del instante guardado al valor de un `<input type="datetime-local">`. */
export function aHoraTucuman(instante: Date): string {
  const local = new Date(instante.getTime() + desfase(instante));
  return local.toISOString().slice(0, 16);
}

/** Para mostrar: "1 de septiembre de 2026, 00:00". */
export function textoHoraTucuman(instante: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA,
    dateStyle: "long",
    timeStyle: "short",
  }).format(instante);
}
