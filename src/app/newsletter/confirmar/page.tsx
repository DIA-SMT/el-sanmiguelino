import type { Metadata } from "next";
import { leerEnlace } from "@/lib/repos/suscripciones";
import { confirmarAction } from "../acciones";
import {
  BOTON,
  EnlaceQueNoSirve,
  HojaNewsletter,
  correoAMedias,
} from "../hoja";

export const metadata: Metadata = {
  title: "Confirmar la suscripción",
  robots: { index: false },
};

/**
 * Adonde lleva el botón del correo de confirmación.
 *
 * **Abrir la página no confirma nada: confirma el botón.** Los filtros de
 * correo de muchas oficinas abren cada enlace que llega para revisarlo, y si
 * con abrir alcanzara, se confirmarían suscripciones que nadie pidió. Lo mismo
 * en la página de baja.
 */
export default async function ConfirmarSuscripcion({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const { t } = await searchParams;
  const token = typeof t === "string" ? t : undefined;
  const leido = await leerEnlace("confirmar", token);
  if (!leido.ok) return <EnlaceQueNoSirve motivo={leido.estado} />;

  if (leido.estado === "activa") {
    return (
      <HojaNewsletter rotulo="Newsletter" titulo="¡Listo, ya estás!">
        <p>
          Las novedades de El Sanmiguelino van a llegar a{" "}
          <strong className="text-ink">{correoAMedias(leido.email)}</strong>.
          Cada correo trae al pie un enlace para darte de baja cuando quieras.
        </p>
      </HojaNewsletter>
    );
  }

  if (leido.estado === "baja") {
    return (
      <HojaNewsletter rotulo="Newsletter" titulo="Esta suscripción está dada de baja">
        <p>
          Si querés volver a recibir las novedades, anotate de nuevo desde el
          pie del diario.
        </p>
      </HojaNewsletter>
    );
  }

  return (
    <HojaNewsletter rotulo="Newsletter" titulo="Confirmá tu suscripción">
      <p>
        Vas a recibir las novedades de El Sanmiguelino en{" "}
        <strong className="text-ink">{correoAMedias(leido.email)}</strong>.
      </p>
      <form action={confirmarAction}>
        <input type="hidden" name="t" value={token} />
        <button type="submit" className={BOTON}>
          Confirmar mi suscripción
        </button>
      </form>
    </HojaNewsletter>
  );
}
