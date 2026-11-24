/**
 * Las reglas del contador de visitas que no necesitan base ni servidor: qué
 * página cuenta, cómo se escribe su ruta y quién es un robot.
 *
 * Puro a propósito: lo usan el navegador (para no mandar nada de lo que no
 * cuenta) y el servidor (que vuelve a mirar todo, porque lo que llega del
 * navegador puede venir de cualquiera), y se prueba con Node suelto.
 */

/** Un slug del diario: minúsculas, números y guiones. */
const SLUG = "[a-z0-9]+(?:-[a-z0-9]+)*";

/** Las páginas que se cuentan. Todo lo demás —el panel, el ingreso, las APIs,
 *  la página sin conexión— no es "leer el diario". */
const CONTABLES: RegExp[] = [
  /^\/$/,
  /^\/diario$/,
  /^\/archivo$/,
  /^\/buscar$/,
  new RegExp(`^\\/nota\\/${SLUG}$`),
  new RegExp(`^\\/edicion\\/${SLUG}$`),
  new RegExp(`^\\/seccion\\/${SLUG}$`),
];

/**
 * La ruta como se guarda, o null si esa página no se cuenta. Sin la parte de
 * `?…` ni `#…` (un enlace compartido con `?utm_source=` es la misma nota), sin
 * barra final y con tope de largo.
 */
export function rutaContable(ruta: unknown): string | null {
  if (typeof ruta !== "string" || ruta.length > 200) return null;
  let r = ruta.split(/[?#]/)[0];
  try {
    r = decodeURIComponent(r);
  } catch {
    return null;
  }
  if (r.length > 1) r = r.replace(/\/+$/, "");
  return CONTABLES.some((re) => re.test(r)) ? r : null;
}

/**
 * Si quien pide es un robot: buscadores, las vistas previas de WhatsApp y
 * Facebook, navegadores sin pantalla. Casi ninguno ejecuta JavaScript y por
 * eso casi ninguno llega al contador, pero los que sí, se descartan acá.
 */
export function esRobot(agente: string | null | undefined): boolean {
  if (!agente || agente.length < 10) return true;
  return /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|node-fetch|axios|go-http/i.test(
    agente,
  );
}

/** El día de hoy en Tucumán ("2026-11-24"): las visitas de las 23:30 son de
 *  hoy, no del día siguiente en UTC. Argentina no tiene horario de verano. */
export function diaDeTucuman(ahora = new Date()): string {
  return new Date(ahora.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
