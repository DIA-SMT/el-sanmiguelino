/**
 * Copia los archivos del bucket de Supabase al depósito del servidor, con los
 * mismos nombres: `<bucket>/julio-2026-p1-bbb381c7.webp` →
 * `$ARCHIVOS_DIR/julio-2026-p1-bbb381c7.webp`, y lo mismo con `pdf/` y `voz/`.
 *
 * Se corre en la VPS, durante la mudanza (ver docs/servidor.md):
 *
 *   ARCHIVOS_DIR=/srv/sanmiguelino/compartido/archivos \
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
 *   node scripts/mudanza-vps/bajar-archivos.mjs
 *
 * La clave de Supabase se usa sólo para LISTAR el bucket; los archivos se
 * bajan por su dirección pública. Se puede correr varias veces: lo que ya
 * está con el mismo tamaño no se vuelve a bajar. Al final dice cuántos hay de
 * cada lado, y sale con error si no coinciden.
 */
import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const bucket = process.env.SUPABASE_BUCKET?.trim() || "diario";
const destino = process.env.ARCHIVOS_DIR?.trim();
if (!url || !clave || !destino) {
  console.error("Faltan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o ARCHIVOS_DIR.");
  process.exit(1);
}

/** La misma regla que `esClave()` en src/lib/archivos.ts. */
const CLAVE = /^(?:pdf\/|voz\/)?[a-z0-9]+(?:-[a-z0-9]+)*\.(jpg|png|webp|pdf|mp3)$/;

async function listar(prefijo) {
  const todos = [];
  for (let desde = 0; ; desde += 1000) {
    const r = await fetch(`${url}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${clave}`, apikey: clave, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: prefijo, limit: 1000, offset: desde, sortBy: { column: "name", order: "asc" } }),
    });
    if (!r.ok) throw new Error(`No se pudo listar ${prefijo || "la raíz"}: ${r.status}`);
    const lote = await r.json();
    todos.push(...lote);
    if (lote.length < 1000) return todos;
  }
}

const archivos = [];
for (const o of await listar("")) {
  if (o.id) archivos.push({ nombre: o.name, tamano: o.metadata?.size ?? null });
  else for (const h of await listar(o.name)) if (h.id) archivos.push({ nombre: `${o.name}/${h.name}`, tamano: h.metadata?.size ?? null });
}

let bajados = 0, yaEstaban = 0, raros = 0, errores = 0;
const base = path.resolve(destino);
for (const a of archivos) {
  if (!CLAVE.test(a.nombre)) {
    console.warn(`  nombre que el sitio no sirve, se saltea: ${a.nombre}`);
    raros++;
    continue;
  }
  const ruta = path.join(base, a.nombre);
  try {
    const s = await stat(ruta);
    if (a.tamano !== null && s.size === a.tamano) { yaEstaban++; continue; }
  } catch { /* no está */ }
  try {
    const r = await fetch(`${url}/storage/v1/object/public/${bucket}/${a.nombre}`);
    if (!r.ok) throw new Error(String(r.status));
    const bytes = Buffer.from(await r.arrayBuffer());
    if (a.tamano !== null && bytes.length !== a.tamano) throw new Error(`llegaron ${bytes.length} de ${a.tamano} bytes`);
    await mkdir(path.dirname(ruta), { recursive: true });
    await writeFile(`${ruta}.parcial`, bytes);
    await rename(`${ruta}.parcial`, ruta);
    bajados++;
  } catch (e) {
    console.error(`  falló ${a.nombre}: ${e.message}`);
    errores++;
  }
}

console.log(`\nEn el bucket: ${archivos.length}. Bajados ahora: ${bajados}. Ya estaban: ${yaEstaban}. Salteados: ${raros}. Con error: ${errores}.`);
process.exitCode = errores || bajados + yaEstaban + raros !== archivos.length ? 1 : 0;
