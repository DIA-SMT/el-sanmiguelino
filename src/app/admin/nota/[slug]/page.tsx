import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { EditorNota } from "@/components/admin/editor-nota";
import { requerirAdmin } from "@/lib/auth/dal";
import {
  getIndice,
  getNotaParaEditar,
  getResumenEdicion,
  repoEscribe,
} from "@/lib/repos/edicion";
import { db } from "@/lib/db";

/**
 * Editar una nota existente, o crear una nueva con el slug reservado `nueva`.
 *
 * Pide permiso por su cuenta aunque el layout ya lo haya hecho: acá hay datos,
 * y el componente que tiene los datos es el que pide permiso.
 */
export default async function AdminEditarNota({
  params,
}: PageProps<"/admin/nota/[slug]">) {
  await requerirAdmin();
  const { slug } = await params;

  // Sin motor de escritura el editor sería un formulario que promete guardar y
  // pierde todo al recargar. Mejor que no exista.
  if (!repoEscribe()) notFound();

  const esNueva = slug === "nueva";
  // Del panel, no del diario: tiene que abrir también las notas de ediciones
  // que todavía no salieron. Ver getNotaParaEditar().
  const nota = esNueva ? null : await getNotaParaEditar(slug);
  if (!esNueva && !nota) notFound();

  const indice = await getIndice();
  const secciones = [...new Set(indice.map((n) => n.seccion))].sort();

  /*
   * Las ediciones, para poder elegir a cuál va la nota.
   *
   * Se leen acá y no por el repo porque el repo sólo expone las publicadas
   * —es lo que necesita el archivo—, y el editor necesita también las
   * programadas y las que todavía no tienen fecha: son justamente las que se
   * están armando.
   *
   * El estado se calcula igual que en /admin/ediciones. Si las dos formas se
   * separan, el panel se contradice a sí mismo.
   */
  const ahora = new Date();
  const filas = await db().edicion.findMany({
    orderBy: [{ anio: "desc" }, { numero: "desc" }],
    select: { slug: true, mes: true, publicaEn: true },
  });
  const ediciones = filas.map((e) => ({
    slug: e.slug,
    mes: e.mes,
    estado: (!e.publicaEn
      ? "sin_fecha"
      : e.publicaEn <= ahora
        ? "publicada"
        : "programada") as "publicada" | "programada" | "sin_fecha",
  }));

  // Para una nota nueva, la que se está mirando: `getResumenEdicion()` ya
  // respeta la previsualización, así que crear desde la vista previa de
  // septiembre propone septiembre.
  const actual = await getResumenEdicion();
  const edicionInicial = nota?.edicionSlug ?? actual.slug;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink pb-4">
        <div className="min-w-0">
          <Link
            href="/admin"
            className="group inline-flex items-center gap-2 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-3 transition-colors hover:text-accent"
          >
            <ArrowLeft
              className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-1"
              aria-hidden="true"
            />
            Notas de la edición
          </Link>
          <h1 className="mt-2 font-sans text-[1.35rem] font-bold leading-tight text-ink">
            {esNueva ? "Nota nueva" : "Editar nota"}
          </h1>
          {nota && (
            <p className="mt-1 font-sans text-[0.78rem] text-ink-3">
              {nota.seccion} · {nota.minutosLectura} min de lectura
            </p>
          )}
        </div>
        {nota && (
          <Link
            href={`/nota/${nota.slug}`}
            className="pressable inline-flex items-center gap-2 border border-line px-4 py-2 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-ink-2 hover:border-ink hover:text-ink"
          >
            Ver en el diario
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>

      <div className="mt-6">
        <EditorNota
        nota={nota}
        secciones={secciones}
        ediciones={ediciones}
        edicionInicial={edicionInicial}
      />
      </div>
    </>
  );
}
