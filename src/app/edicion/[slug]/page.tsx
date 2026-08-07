import { notFound, redirect } from "next/navigation";
import { edicionActual } from "@/lib/data/edicion-actual";

/** Por ahora solo existe la edición actual; el archivo histórico llegará con
 *  la persistencia real. La ruta queda para no romper links compartidos. */
export default async function EdicionPage({
  params,
}: PageProps<"/edicion/[slug]">) {
  const { slug } = await params;
  if (slug !== edicionActual.slug) notFound();
  redirect("/diario");
}
