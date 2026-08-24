import { notFound, redirect } from "next/navigation";
import { getResumenEdicion } from "@/lib/repos/edicion";

/** Por ahora solo existe la edición actual; el archivo histórico llegará con
 *  la persistencia real. La ruta queda para no romper links compartidos. */
export default async function EdicionPage({
  params,
}: PageProps<"/edicion/[slug]">) {
  const { slug } = await params;
  const edicion = await getResumenEdicion();
  if (slug !== edicion.slug) notFound();
  redirect("/diario");
}
