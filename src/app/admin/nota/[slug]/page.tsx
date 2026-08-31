import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { EditorNota } from "@/components/admin/editor-nota";
import { BannerPanel, clasesDeBoton } from "@/components/admin/piezas";
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

/**
 * Los dos enlaces de la cabecera son el botón secundario del panel.
 *
 * Esta pantalla ya había llegado por su cuenta a `--panel-borde-campo` —un
 * botón sin relleno propio es un borde y nada más, y ese filete es el único
 * límite del control: WCAG 1.4.11 le pide 3:1 y `--panel-borde` da 1,23:1—.
 * Ahora ese criterio vive una sola vez, en `clasesDeBoton`, y las otras cinco
 * definiciones sueltas que no lo tenían lo heredan de arriba en vez de tener
 * que enterarse.
 *
 * `sobre` queda en su valor por defecto (`"tarjeta"`) porque el banner es
 * `--panel-tarjeta`: el relleno del control es el contrario del de abajo.
 */
const enlaceSecundario = clasesDeBoton();

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
      {/* El <h1> de la pantalla lo pone el banner; adentro del editor no hay
          otro, sólo los <h2> de cada tarjeta. */}
      <BannerPanel
        titulo={esNueva ? "Nota nueva" : "Editar nota"}
        bajada={
          nota
            ? `${nota.seccion} · ${nota.minutosLectura} min de lectura`
            : "Se crea recién cuando la guardes: hasta entonces no existe para nadie."
        }
      >
        <Link href="/admin" className={enlaceSecundario}>
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
          Notas de la edición
        </Link>
        {nota && (
          <Link href={`/nota/${nota.slug}`} className={enlaceSecundario}>
            Ver en el diario
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
          </Link>
        )}
      </BannerPanel>

      <EditorNota
        nota={nota}
        secciones={secciones}
        ediciones={ediciones}
        edicionInicial={edicionInicial}
      />
    </>
  );
}
