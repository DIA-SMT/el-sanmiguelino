import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BannerPanel, clasesDeBoton } from "@/components/admin/piezas";
import { EditorBoletin } from "@/components/admin/editor-boletin";
import { requerirAdmin } from "@/lib/auth/dal";
import {
  notasCandidatas,
  obtenerBoletin,
  resolverNotas,
} from "@/lib/repos/boletines";

export const metadata = { title: "Editar newsletter" };

export default async function EditarNewsletter({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirAdmin();
  const { id } = await params;
  const boletin = await obtenerBoletin(id);
  if (!boletin) notFound();

  const [candidatas, { notas, faltan }] = await Promise.all([
    notasCandidatas(),
    resolverNotas(boletin.notas),
  ]);

  return (
    <>
      <BannerPanel
        titulo="Editar newsletter"
        bajada="Lo que ves a la derecha es exactamente el correo que llega."
      >
        <Link href="/admin/newsletter" className={clasesDeBoton()}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver
        </Link>
      </BannerPanel>
      <EditorBoletin
        boletin={boletin}
        candidatas={candidatas}
        elegidasIniciales={notas}
        faltan={faltan}
      />
    </>
  );
}
