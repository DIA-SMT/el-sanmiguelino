import type { Metadata } from "next";
import { leerEnlace } from "@/lib/repos/suscripciones";
import { darDeBajaAction } from "../acciones";
import {
  BOTON,
  EnlaceQueNoSirve,
  HojaNewsletter,
  correoAMedias,
} from "../hoja";

export const metadata: Metadata = {
  title: "Darse de baja",
  robots: { index: false },
};

/**
 * Adonde lleva el «Darme de baja» del pie de cada correo.
 *
 * No pide ingresar: el enlace firmado alcanza. Darse de baja tiene que ser
 * tan fácil como anotarse, o más. Abrir la página no da de baja (ver la nota
 * de la página de confirmar): lo hace el botón. Los programas de correo que
 * traen su propio botón de baja usan `/api/newsletter/baja`, que sí actúa
 * directo.
 */
export default async function DarseDeBaja({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[]; prueba?: string }>;
}) {
  const { t, prueba } = await searchParams;

  // El enlace de los correos de prueba del panel: no apunta a nadie.
  if (prueba === "1") {
    return (
      <HojaNewsletter rotulo="Correo de prueba" titulo="Acá se da de baja">
        <p>
          Este enlace viene de un correo de prueba, así que no da de baja a
          nadie. En los correos de verdad lleva a la persona a esta página con
          un botón para dejar de recibirlos.
        </p>
      </HojaNewsletter>
    );
  }

  const token = typeof t === "string" ? t : undefined;
  const leido = await leerEnlace("baja", token);
  if (!leido.ok) return <EnlaceQueNoSirve motivo={leido.estado} />;

  if (leido.estado === "baja") {
    return (
      <HojaNewsletter rotulo="Newsletter" titulo="Listo, te diste de baja">
        <p>
          No vas a recibir más correos de El Sanmiguelino en{" "}
          <strong className="text-ink">{correoAMedias(leido.email)}</strong>.
          El diario sigue en la web cuando quieras leerlo.
        </p>
        <p className="text-[0.9rem] text-ink-3">
          ¿Te arrepentiste? Anotate de nuevo desde el pie del diario.
        </p>
      </HojaNewsletter>
    );
  }

  return (
    <HojaNewsletter rotulo="Newsletter" titulo="¿Dejar de recibir las novedades?">
      <p>
        Vamos a dejar de escribirle a{" "}
        <strong className="text-ink">{correoAMedias(leido.email)}</strong>.
      </p>
      <form action={darDeBajaAction}>
        <input type="hidden" name="t" value={token} />
        <button type="submit" className={BOTON}>
          Darme de baja
        </button>
      </form>
    </HojaNewsletter>
  );
}
