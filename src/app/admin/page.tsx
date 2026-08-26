import Link from "next/link";
import { AlertTriangle, Pencil, Plus } from "lucide-react";
import { requerirAdmin } from "@/lib/auth/dal";
import { getIndice, getResumenEdicion, repoEscribe } from "@/lib/repos/edicion";

export const metadata = { title: "Notas" };

/**
 * Listado de notas de la edición en curso.
 *
 * Pide permiso por su cuenta aunque el layout ya lo haya hecho: el layout
 * cubre el cromo, no los datos. La regla que dejó la fuga de la etapa 1 es que
 * **el componente que tiene los datos es el que pide permiso**, y acá los
 * títulos de la edición son datos.
 *
 * Cada fila lleva a su editor. Si no hay motor de escritura —sin DATABASE_URL
 * el diario lee del archivo semilla— el listado se degrada a sólo lectura y lo
 * dice, en vez de ofrecer un botón que perdería todo al recargar.
 */
export default async function AdminNotas() {
  await requerirAdmin();
  const puedeEditar = repoEscribe();
  const [edicion, indice] = await Promise.all([
    getResumenEdicion(),
    getIndice(),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-4">
        <div>
          <h1 className="font-sans text-[1.35rem] font-bold leading-tight text-ink">
            Notas de la edición
          </h1>
          <p className="mt-1 font-sans text-[0.8rem] text-ink-3">
            {edicion.mes} · N.º {edicion.numero} · {indice.length} notas
          </p>
        </div>
        {puedeEditar && (
          <Link
            href="/admin/nota/nueva"
            className="pressable inline-flex items-center gap-2 bg-accent px-5 py-2.5 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-accent-contrast hover:bg-accent-strong"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Nota nueva
          </Link>
        )}
      </div>

      {/* Que el panel diga en qué estado está es parte de no mentir. Sin motor
          de escritura no se ofrece editar: un botón que promete guardar y
          pierde todo al recargar es peor que no tenerlo. */}
      {puedeEditar ? (
        <p className="mt-5 flex items-start gap-2.5 border border-hairline bg-paper-2 px-4 py-3 font-sans text-[0.8rem] leading-relaxed text-ink-2">
          <AlertTriangle
            className="mt-[0.15em] h-4 w-4 shrink-0 text-accent"
            aria-hidden="true"
          />
          <span>
            Lo que se guarda acá sale publicado al instante: todavía no hay
            borradores ni historial de versiones. La moderación de comentarios y
            el tablero de Migue son los próximos pasos.
          </span>
        </p>
      ) : (
        <p className="mt-5 flex items-start gap-2.5 border border-hairline bg-paper-2 px-4 py-3 font-sans text-[0.8rem] leading-relaxed text-ink-2">
          <AlertTriangle
            className="mt-[0.15em] h-4 w-4 shrink-0 text-accent"
            aria-hidden="true"
          />
          <span>
            Sólo lectura: no hay base de datos configurada, así que el diario
            está sirviendo el archivo semilla y cualquier cambio se perdería.
            Falta <code className="font-mono">DATABASE_URL</code>.
          </span>
        </p>
      )}

      <ul className="mt-6 divide-y divide-hairline border-y border-hairline">
        {indice.map((nota, i) => (
          <li
            key={nota.slug}
            className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3.5"
          >
            <span className="w-10 shrink-0 font-sans text-[0.72rem] tabular-nums text-ink-3">
              Pág. {i + 2}
            </span>
            <span className="min-w-0 flex-1">
              <Link
                href={puedeEditar ? `/admin/nota/${nota.slug}` : `/nota/${nota.slug}`}
                className="font-sans text-[0.95rem] font-semibold leading-snug text-ink transition-colors hover:text-accent"
              >
                {nota.titulo}
              </Link>
              <span className="mt-0.5 block font-sans text-[0.72rem] text-ink-3">
                {nota.seccion} · {nota.minutosLectura} min ·{" "}
                <code className="font-mono text-[0.68rem]">{nota.slug}</code>
              </span>
            </span>
            {puedeEditar ? (
              <Link
                href={`/admin/nota/${nota.slug}`}
                className="pressable inline-flex shrink-0 items-center gap-1.5 border border-line px-3 py-1.5 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ink-2 hover:border-ink hover:text-ink"
              >
                <Pencil className="h-3 w-3" aria-hidden="true" />
                Editar
              </Link>
            ) : (
              <span className="font-sans text-[0.68rem] uppercase tracking-[0.12em] text-ink-3">
                Publicada
              </span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
