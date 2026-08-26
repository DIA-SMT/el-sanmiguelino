import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { FilaComentario } from "@/components/admin/fila-comentario";
import { requerirAdmin } from "@/lib/auth/dal";
import { comentariosRepo } from "@/lib/repos/comentarios";
import { getIndice } from "@/lib/repos/edicion";
import type { EstadoComentario } from "@/lib/types";

export const metadata = { title: "Comentarios" };

const FILTROS = [
  { valor: undefined, nombre: "Todos" },
  { valor: "publicado" as const, nombre: "Publicados" },
  { valor: "oculto" as const, nombre: "De baja" },
];

/**
 * Moderación de la columna del lector.
 *
 * Pide permiso por su cuenta: acá hay comentarios de vecinos identificados,
 * que son datos personales, y el componente que tiene los datos es el que pide
 * permiso.
 *
 * Muestra **todo**, publicado y de baja, ordenado por fecha y no por estado:
 * moderar es mirar lo último que entró, no revisar una bandeja de pendientes.
 * La política acordada con el municipio es que los comentarios se publican
 * directo, así que no existe una cola de aprobación.
 */
export default async function AdminComentarios({
  searchParams,
}: PageProps<"/admin/comentarios">) {
  const { usuario } = await requerirAdmin();
  const { estado } = await searchParams;
  const filtro =
    estado === "publicado" || estado === "oculto"
      ? (estado as EstadoComentario)
      : undefined;

  const indice = await getIndice();
  const comentarios = await comentariosRepo.listarParaModeracion({
    estado: filtro,
    moderadorId: usuario.id,
  });
  const tituloDe = new Map(indice.map((n) => [n.slug, n.titulo]));

  return (
    <>
      <div className="border-b border-ink pb-4">
        <h1 className="font-sans text-[1.35rem] font-bold leading-tight text-ink">
          Comentarios
        </h1>
        <p className="mt-1 font-sans text-[0.8rem] text-ink-3">
          {comentarios.length}{" "}
          {comentarios.length === 1 ? "comentario" : "comentarios"}
          {filtro ? ` · filtrando por ${filtro}s` : " en toda la edición"}
        </p>
      </div>

      <nav aria-label="Filtrar por estado" className="mt-4 flex flex-wrap gap-1">
        {FILTROS.map((f) => {
          const activo = filtro === f.valor;
          return (
            <Link
              key={f.nombre}
              href={f.valor ? `/admin/comentarios?estado=${f.valor}` : "/admin/comentarios"}
              aria-current={activo ? "page" : undefined}
              className={
                activo
                  ? "border border-ink bg-ink px-3.5 py-1.5 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-paper"
                  : "pressable border border-line px-3.5 py-1.5 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink-2 hover:border-ink hover:text-ink"
              }
            >
              {f.nombre}
            </Link>
          );
        })}
      </nav>

      <p className="mt-5 border border-hairline bg-paper-2 px-4 py-3 font-sans text-[0.8rem] leading-relaxed text-ink-2">
        Los comentarios se publican directo, como se acordó con el municipio.
        Dar de baja no borra: el texto y los votos se conservan, y queda el
        registro de quién lo decidió y por qué.
      </p>

      {comentarios.length === 0 ? (
        <p className="mt-8 flex items-center gap-2.5 font-sans text-[0.85rem] text-ink-3">
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          {filtro === "oculto"
            ? "No hay comentarios dados de baja."
            : "Todavía no hay comentarios en esta edición."}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-hairline border-y border-hairline">
          {comentarios.map((c) => (
            <FilaComentario
              key={c.id}
              comentario={c}
              tituloNota={tituloDe.get(c.notaSlug)}
            />
          ))}
        </ul>
      )}
    </>
  );
}
