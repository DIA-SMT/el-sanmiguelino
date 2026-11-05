import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, FlaskConical, MailCheck } from "lucide-react";
import {
  Aviso,
  BannerPanel,
  SeccionPanel,
  clasesDeBoton,
} from "@/components/admin/piezas";
import { requerirAdmin } from "@/lib/auth/dal";
import { REMITENTE, obtenerCorreo } from "@/lib/correo/enviar";

export const metadata = { title: "Correo de prueba" };

const FECHA = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Tucuman",
  dateStyle: "long",
  timeStyle: "short",
});

/**
 * Un correo de la bandeja, como habría llegado.
 *
 * Se dibuja en un `iframe` con `sandbox` vacío: sin scripts, sin formularios y
 * sin ventanas nuevas. Y con `<base target="_blank">`, que dentro de ese
 * sandbox vuelve inertes los enlaces. Es a propósito: un correo de
 * confirmación trae el enlace de verdad de un vecino, y tocarlo desde el panel
 * confirmaría una suscripción que esa persona no confirmó. Los enlaces se leen
 * en la versión de texto, abajo, para quien esté probando con su propio
 * correo.
 */
export default async function CorreoDePrueba({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirAdmin();
  const { id } = await params;
  const correo = await obtenerCorreo(id);
  if (!correo) notFound();

  const html = correo.html.replace(
    "<head>",
    '<head><base target="_blank">',
  );

  return (
    <>
      <BannerPanel titulo={correo.asunto} antetitulo="Correo">
        <Link href="/admin/newsletter" className={clasesDeBoton()}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver al newsletter
        </Link>
      </BannerPanel>

      <div className="grid gap-6">
        {correo.estado === "enviado" ? (
          <Aviso icono={MailCheck} tono="var(--grafico-nota)">
            <strong className="font-semibold text-panel-tinta">
              Salió
            </strong>{" "}
            a{" "}
            <strong className="font-semibold text-panel-tinta">
              {correo.para}
            </strong>{" "}
            el {FECHA.format(new Date(correo.fecha))}, desde {REMITENTE.nombre}{" "}
            &lt;{REMITENTE.correo}&gt;. Los enlaces de la vista no se abren a
            propósito.
          </Aviso>
        ) : correo.estado === "fallido" ? (
          <Aviso icono={AlertTriangle} tono="var(--grafico-alerta)">
            <strong className="font-semibold text-panel-tinta">
              No salió:
            </strong>{" "}
            {correo.error ?? "falló el envío"} Era para{" "}
            <strong className="font-semibold text-panel-tinta">
              {correo.para}
            </strong>
            , el {FECHA.format(new Date(correo.fecha))}.
          </Aviso>
        ) : (
          <Aviso icono={FlaskConical} tono="var(--grafico-diario)">
            <strong className="font-semibold text-panel-tinta">
              Este correo no salió:
            </strong>{" "}
            quedó simulado. Así es como le habría llegado a{" "}
            <strong className="font-semibold text-panel-tinta">
              {correo.para}
            </strong>{" "}
            el {FECHA.format(new Date(correo.fecha))}, desde {REMITENTE.nombre}{" "}
            &lt;{REMITENTE.correo}&gt;. Los enlaces de la vista no se abren a
            propósito.
          </Aviso>
        )}

        <SeccionPanel id="como-llega" titulo="Cómo llega">
          <iframe
            title={`Vista del correo «${correo.asunto}»`}
            sandbox=""
            srcDoc={html}
            className="h-[70vh] min-h-[32rem] w-full rounded-panel-2 border border-panel-borde bg-white"
          />
        </SeccionPanel>

        <SeccionPanel
          id="version-texto"
          titulo="Versión de texto"
          bajada="La que ven los programas de correo que no muestran diseño. Acá están los enlaces."
        >
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-panel-2 bg-panel-tarjeta-2 p-4 font-mono text-panel-sm text-panel-tinta-2">
            {correo.texto}
          </pre>
        </SeccionPanel>
      </div>
    </>
  );
}
