import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BannerPanel, clasesDeBoton } from "@/components/admin/piezas";
import { EditorBoletin } from "@/components/admin/editor-boletin";
import {
  SeguimientoEnvio,
  type EstadoDelBoletin,
} from "@/components/admin/seguimiento-envio";
import { requerirAdmin } from "@/lib/auth/dal";
import {
  notasCandidatas,
  obtenerBoletin,
  resolverNotas,
} from "@/lib/repos/boletines";
import { contarPorEstado } from "@/lib/repos/suscripciones";
import { saleDeVerdad } from "@/lib/correo/enviar";
import {
  contarEnvios,
  contenidoDelEnvio,
  enviosConProblema,
} from "@/lib/newsletter/envios";
import { armarBoletin, type DatosDelBoletin } from "@/lib/newsletter/plantilla";
import { iaDisponible } from "@/lib/newsletter/borrador-ia";
import { SITIO_URL } from "@/lib/compartir";

export const metadata = { title: "Newsletter" };

const BAJA_DE_PRUEBA = `${SITIO_URL.origin}/newsletter/baja?prueba=1`;
const POR_PAGINA = 20;

/** Si la hora programada ya llegó o llega dentro de un minuto. El reloj se lee
 *  en una función con nombre, como en Suscripciones: la página se arma una vez
 *  por pedido y es una foto de ese momento (ver `react-hooks/purity`). */
function saleEnSeguida(programadoPara: string | null): boolean {
  return Boolean(
    programadoPara && new Date(programadoPara).getTime() <= Date.now() + 60_000,
  );
}

/**
 * Un newsletter. Mientras es borrador, el editor; desde que se manda o se
 * programa, el seguimiento del envío.
 */
export default async function PaginaNewsletter({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pagina?: string }>;
}) {
  await requerirAdmin();
  const { id } = await params;
  const boletin = await obtenerBoletin(id);
  if (!boletin) notFound();

  const volver = (
    <Link href="/admin/newsletter" className={clasesDeBoton()}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Volver
    </Link>
  );
  const envioReal = saleDeVerdad("boletin");

  if (boletin.estado === "borrador") {
    const [candidatas, { notas, faltan }, cuentas] = await Promise.all([
      notasCandidatas(),
      resolverNotas(boletin.notas),
      contarPorEstado(),
    ]);
    return (
      <>
        <BannerPanel
          titulo="Editar newsletter"
          bajada="Lo que ves a la derecha es exactamente el correo que llega."
        >
          {volver}
        </BannerPanel>
        <EditorBoletin
          boletin={boletin}
          candidatas={candidatas}
          elegidasIniciales={notas}
          faltan={faltan}
          destinatarios={cuentas.activa}
          envioReal={envioReal}
          iaDisponible={iaDisponible()}
        />
      </>
    );
  }

  const estado = (
    ["programado", "enviando", "enviado", "cancelado"].includes(boletin.estado)
      ? boletin.estado
      : "cancelado"
  ) as EstadoDelBoletin;

  const { pagina: crudo } = await searchParams;
  const pedida = Math.max(1, Math.floor(Number(crudo)) || 1);

  const [cuentas, congelado, suscripciones, primera] = await Promise.all([
    contarEnvios(id),
    contenidoDelEnvio(id),
    contarPorEstado(),
    enviosConProblema(id, pedida, POR_PAGINA),
  ]);
  // Si la página pedida quedó más allá del final (se resolvieron los
  // problemas), se muestra la última que existe.
  const ultima = Math.max(1, Math.ceil(primera.total / POR_PAGINA));
  const problemas =
    pedida > ultima ? await enviosConProblema(id, ultima, POR_PAGINA) : primera;
  const pagina = Math.min(pedida, ultima);

  // Lo que salió (congelado) o, si todavía no salió, cómo saldría hoy.
  const contenido: DatosDelBoletin =
    congelado ??
    (await resolverNotas(boletin.notas).then(({ notas }) => ({
      asunto: boletin.asunto,
      preencabezado: boletin.preencabezado,
      introduccion: boletin.introduccion,
      cierre: boletin.cierre,
      notas,
    })));
  const html = armarBoletin(contenido, BAJA_DE_PRUEBA).html.replace(
    "<head>",
    '<head><base target="_blank">',
  );

  const programadoPara = boletin.programadoPara;
  return (
    <>
      <BannerPanel
        titulo="Envío del newsletter"
        bajada="Cuándo sale, a cuántos les llegó y el correo tal cual se mandó."
      >
        {volver}
      </BannerPanel>
      <SeguimientoEnvio
        datos={{
          id,
          asunto: contenido.asunto,
          preencabezado: contenido.preencabezado,
          estado,
          programadoPara,
          programadoPorNombre: boletin.programadoPorNombre,
          envioIniciadoEn: boletin.envioIniciadoEn,
          envioTerminadoEn: boletin.envioTerminadoEn,
          canceladoEn: boletin.canceladoEn,
          canceladoPorNombre: boletin.canceladoPorNombre,
          motivoCancelacion: boletin.motivoCancelacion,
          destinatarios: boletin.destinatarios,
          cuentas,
          problemas: problemas.filas,
          totalProblemas: problemas.total,
          pagina,
          porPagina: POR_PAGINA,
          html,
          inminente: saleEnSeguida(programadoPara),
          activasHoy: suscripciones.activa,
          envioReal,
        }}
      />
    </>
  );
}
