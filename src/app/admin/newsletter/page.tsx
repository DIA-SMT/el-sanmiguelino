import Link from "next/link";
import {
  FlaskConical,
  Hourglass,
  MailCheck,
  MailX,
  Plus,
} from "lucide-react";
import {
  Aviso,
  BannerPanel,
  EstadoVacio,
  Pildora,
  SeccionPanel,
  TABLA,
  TarjetaDato,
  ZonaDeTabla,
  clasesDeBoton,
} from "@/components/admin/piezas";
import { requerirAdmin } from "@/lib/auth/dal";
import { listarBoletines } from "@/lib/repos/boletines";
import { contarPorEstado } from "@/lib/repos/suscripciones";
import {
  REMITENTE,
  envioALosVecinosAutorizado,
  listarCorreos,
  modoDeCorreo,
} from "@/lib/correo/enviar";
import { fechaLegible } from "@/lib/newsletter/cola";
import {
  historialDeEnvios,
  resumenDeSuscripciones,
} from "@/lib/newsletter/estadisticas";
import { EstadisticasNewsletter } from "@/components/admin/estadisticas-newsletter";
import { tiempoRelativo } from "@/lib/utils";
import { crearBoletinAction } from "./acciones";

export const metadata = { title: "Newsletter" };

const POR_PAGINA = 10;

/** Cómo está cada newsletter, con el color de su píldora. */
const ESTADOS_DE_BOLETIN: Record<string, { nombre: string; tono: string }> = {
  borrador: { nombre: "Borrador", tono: "var(--grafico-diario)" },
  programado: { nombre: "Programado", tono: "var(--grafico-acento)" },
  enviando: { nombre: "Saliendo", tono: "var(--grafico-indice)" },
  enviado: { nombre: "Enviado", tono: "var(--grafico-nota)" },
  cancelado: { nombre: "Detenido", tono: "var(--grafico-alerta)" },
};

/** La línea de abajo de cada newsletter de la lista. */
function detalleDeBoletin(b: {
  estado: string;
  notas: number;
  autorNombre: string;
  actualizadoEn: string;
  programadoPara: string | null;
  destinatarios: number | null;
}): string {
  const notas = b.notas === 1 ? "1 nota" : `${b.notas} notas`;
  const personas = (n: number) => (n === 1 ? "1 persona" : `${n} personas`);
  switch (b.estado) {
    case "programado":
      return b.programadoPara
        ? `${notas} · sale el ${fechaLegible(b.programadoPara)}`
        : notas;
    case "enviando":
      return `${notas} · saliendo a ${personas(b.destinatarios ?? 0)}`;
    case "enviado":
      return `${notas} · enviado a ${personas(b.destinatarios ?? 0)}`;
    case "cancelado":
      return `${notas} · se detuvo`;
    default:
      return `${notas} · lo tocó ${b.autorNombre} ${tiempoRelativo(b.actualizadoEn)}`;
  }
}

/** Cómo quedó cada correo, con el color de su píldora. */
const ESTADOS_DE_CORREO: Record<string, { nombre: string; tono: string }> = {
  enviado: { nombre: "Enviado", tono: "var(--grafico-nota)" },
  simulado: { nombre: "No salió (simulado)", tono: "var(--grafico-diario)" },
  fallido: { nombre: "Falló", tono: "var(--grafico-alerta)" },
};

const TIPOS: Record<string, string> = {
  prueba: "Prueba",
  confirmacion: "Confirmación",
  boletin: "Newsletter",
};

/**
 * El newsletter: los borradores, cuánta gente lo recibiría y la bandeja de los
 * correos de prueba.
 *
 * Hay tres situaciones posibles, y el aviso de arriba dice en cuál se está
 * para que nadie crea que algo salió (o que no): sin la cuenta conectada no
 * sale nada; con la cuenta, salen las pruebas y el envío a la lista es de
 * práctica; con la cuenta y la autorización del municipio, sale todo.
 */
export default async function AdminNewsletter({
  searchParams,
}: {
  searchParams: Promise<{ envios?: string }>;
}) {
  await requerirAdmin();
  const conectada = modoDeCorreo() === "smtp";
  const aLosVecinos = envioALosVecinosAutorizado();
  const { envios } = await searchParams;
  const pedida = Math.max(1, Math.floor(Number(envios)) || 1);
  const [cuentas, boletines, correos, suscripciones, primera] = await Promise.all([
    contarPorEstado(),
    listarBoletines(),
    listarCorreos(30),
    resumenDeSuscripciones(30),
    historialDeEnvios(pedida, POR_PAGINA),
  ]);
  // Si la página pedida quedó más allá del final, se muestra la última.
  const ultima = Math.max(1, Math.ceil(primera.total / POR_PAGINA));
  const paginaEnvios = Math.min(pedida, ultima);
  const historial =
    pedida > ultima ? await historialDeEnvios(ultima, POR_PAGINA) : primera;

  return (
    <>
      <BannerPanel
        titulo="Newsletter"
        bajada="Armá el correo con las novedades del diario: elegí las notas, mirá cómo queda en la compu y en el celular, y mandate una prueba."
      >
        <form action={crearBoletinAction}>
          <button type="submit" className={clasesDeBoton({ tono: "primario" })}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nuevo newsletter
          </button>
        </form>
      </BannerPanel>

      <div className="grid gap-6">
        {conectada && aLosVecinos ? (
          <Aviso icono={MailCheck} tono="var(--grafico-nota)">
            <strong className="font-semibold text-panel-tinta">
              Los correos salen de verdad
            </strong>{" "}
            desde{" "}
            <strong className="font-semibold text-panel-tinta">
              {REMITENTE.correo}
            </strong>
            : las pruebas, las confirmaciones y el newsletter a la lista.
          </Aviso>
        ) : conectada ? (
          <Aviso icono={MailCheck} tono="var(--grafico-nota)">
            <strong className="font-semibold text-panel-tinta">
              Las pruebas salen de verdad
            </strong>{" "}
            desde{" "}
            <strong className="font-semibold text-panel-tinta">
              {REMITENTE.correo}
            </strong>
            , a la dirección que escribas. El envío a la lista todavía es de
            práctica: recorre a todos, pero no le llega a nadie.
          </Aviso>
        ) : (
          <Aviso icono={FlaskConical} tono="var(--grafico-diario)">
            <strong className="font-semibold text-panel-tinta">
              Modo de prueba: todavía no sale ningún correo.
            </strong>{" "}
            Falta conectar la cuenta {REMITENTE.correo}. Mientras tanto, lo que
            mandes de prueba queda en «Correos de prueba», abajo, tal cual
            habría llegado.
          </Aviso>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TarjetaDato
            icono={MailCheck}
            color="azul"
            valor={String(cuentas.activa)}
            titulo="Lo recibirían"
            nota="Confirmaron su correo"
          />
          <TarjetaDato
            icono={Hourglass}
            color="oro"
            valor={String(cuentas.pendiente)}
            titulo="Falta que confirmen"
            nota="Hasta que confirmen, no lo reciben"
          />
          <TarjetaDato
            icono={MailX}
            color="alerta"
            valor={String(cuentas.baja)}
            titulo="Se dieron de baja"
            nota="No se les escribe más"
          />
        </div>

        <EstadisticasNewsletter
          suscripciones={suscripciones}
          historial={historial}
          pagina={paginaEnvios}
          porPagina={POR_PAGINA}
        />

        <SeccionPanel
          id="borradores"
          titulo="Newsletters"
          bajada="Del último que se tocó al primero. Tocá uno para editarlo o ver cómo va su envío."
        >
          {boletines.length === 0 ? (
            <EstadoVacio ilustracion="periodico">
              Todavía no hay ningún newsletter. Empezá uno con «Nuevo
              newsletter».
            </EstadoVacio>
          ) : (
            <ul className="divide-y divide-panel-borde">
              {boletines.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/admin/newsletter/${b.id}`}
                      className="font-semibold text-panel-tinta hover:text-accent hover:underline"
                    >
                      {b.asunto}
                    </Link>
                    <p className="mt-0.5 text-panel-sm text-panel-tinta-3">
                      {detalleDeBoletin(b)}
                    </p>
                  </div>
                  <Pildora tono={ESTADOS_DE_BOLETIN[b.estado]?.tono}>
                    {ESTADOS_DE_BOLETIN[b.estado]?.nombre ?? b.estado}
                  </Pildora>
                </li>
              ))}
            </ul>
          )}
        </SeccionPanel>

        <SeccionPanel
          id="correos-de-prueba"
          titulo="Correos de prueba"
          bajada="Los que salieron y los que quedaron simulados. Tocá uno para verlo como llega."
        >
          {correos.length === 0 ? (
            <EstadoVacio ilustracion="estadisticas">
              Todavía no hay ninguno. Mandate una prueba desde un newsletter.
            </EstadoVacio>
          ) : (
            <ZonaDeTabla
              id="zona-tabla-correos"
              nombre="Correos de prueba. Si la tabla es más ancha que la pantalla, se desplaza al costado con las flechas."
            >
              <table className={`${TABLA.tabla} min-w-[44rem]`}>
                <caption className="sr-only">
                  Correos enviados y simulados, del más nuevo al más viejo.
                </caption>
                <thead>
                  <tr>
                    {["Asunto", "Para", "Tipo", "Estado", "Cuándo"].map((t) => (
                      <th key={t} scope="col" className={TABLA.cabecera}>
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {correos.map((c) => (
                    <tr key={c.id} className={TABLA.fila}>
                      <td className={TABLA.celda}>
                        <Link
                          href={`/admin/newsletter/correos/${c.id}`}
                          className="font-medium text-panel-tinta hover:text-accent hover:underline"
                        >
                          {c.asunto}
                        </Link>
                      </td>
                      <td className={TABLA.celda}>{c.para}</td>
                      <td className={TABLA.celda}>{TIPOS[c.tipo] ?? c.tipo}</td>
                      <td className={TABLA.celda}>
                        <Pildora tono={ESTADOS_DE_CORREO[c.estado]?.tono}>
                          {ESTADOS_DE_CORREO[c.estado]?.nombre ?? c.estado}
                        </Pildora>
                      </td>
                      <td className={`${TABLA.celda} whitespace-nowrap`}>
                        {tiempoRelativo(c.fecha)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ZonaDeTabla>
          )}
        </SeccionPanel>
      </div>
    </>
  );
}
