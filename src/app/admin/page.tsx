import Link from "next/link";
import { AlertTriangle, FileText } from "lucide-react";
import { requerirAdmin } from "@/lib/auth/dal";
import { getIndice, getResumenEdicion } from "@/lib/repos/edicion";

export const metadata = { title: "Notas" };

/**
 * Listado de notas de la edición en curso.
 *
 * Pide permiso por su cuenta aunque el layout ya lo haya hecho: el layout
 * cubre el cromo, no los datos. La regla que dejó la fuga de la etapa 1 es que
 * **el componente que tiene los datos es el que pide permiso**, y acá los
 * títulos de la edición son datos.
 *
 * Todavía es sólo lectura: el editor de notas es lo que sigue. Se muestra el
 * listado real para que el panel no mienta sobre lo que ya puede hacer.
 */
export default async function AdminNotas() {
  await requerirAdmin();
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
      </div>

      {/* Que el panel diga en qué estado está es parte de no mentir: un botón
          de "nueva nota" que no hace nada es peor que no tenerlo. */}
      <p className="mt-5 flex items-start gap-2.5 border border-hairline bg-paper-2 px-4 py-3 font-sans text-[0.8rem] leading-relaxed text-ink-2">
        <AlertTriangle
          className="mt-[0.15em] h-4 w-4 shrink-0 text-accent"
          aria-hidden="true"
        />
        <span>
          Por ahora el panel es de sólo lectura: muestra la edición tal como
          está publicada. El editor de notas, la moderación de comentarios y el
          tablero de Migue son los próximos pasos.
        </span>
      </p>

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
                href={`/nota/${nota.slug}`}
                className="font-sans text-[0.95rem] font-semibold leading-snug text-ink transition-colors hover:text-accent"
              >
                {nota.titulo}
              </Link>
              <span className="mt-0.5 block font-sans text-[0.72rem] text-ink-3">
                {nota.seccion} · {nota.minutosLectura} min ·{" "}
                <code className="font-mono text-[0.68rem]">{nota.slug}</code>
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 font-sans text-[0.68rem] uppercase tracking-[0.12em] text-ink-3">
              <FileText className="h-3 w-3" aria-hidden="true" />
              Publicada
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
