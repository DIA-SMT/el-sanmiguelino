import { LogoSanmiguelino } from "@/components/brand/logos";

/**
 * La hoja de las páginas a las que llevan los correos: confirmar y darse de
 * baja. Es la misma presentación que "Sin conexión": una hoja del diario sobre
 * el escritorio, con la marca, un rótulo y lo que haya que decir.
 */
export function HojaNewsletter({
  rotulo,
  titulo,
  children,
}: {
  rotulo: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <main className="escritorio grano flex flex-1 items-center justify-center px-4 py-24">
      <div className="fade-up hoja grano w-full max-w-md px-8 py-12 text-center sm:px-10">
        <LogoSanmiguelino className="mx-auto w-full max-w-[15rem] text-ink opacity-70" />
        <p className="volanta mt-6 text-accent">{rotulo}</p>
        <h1 className="titular mt-3 text-[clamp(1.5rem,5vw,2.1rem)] leading-tight text-ink">
          {titulo}
        </h1>
        <div className="mt-4 space-y-4 text-pretty font-serif text-[0.98rem] leading-[1.7] text-ink-2">
          {children}
        </div>
        <a
          href="/diario"
          className="mt-7 inline-flex items-center gap-2 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-3 transition-colors hover:text-accent"
        >
          Ir al diario
        </a>
      </div>
    </main>
  );
}

/** El botón grande de estas páginas. */
export const BOTON =
  "pressable inline-flex items-center gap-2 border border-ink bg-ink px-5 py-3 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-paper transition-colors hover:bg-accent hover:text-accent-contrast";

/**
 * El correo a medias: `ju•••@gmail.com`.
 *
 * Alcanza para que la persona reconozca su dirección, sin mostrarla entera a
 * quien tenga el enlace en la mano (un correo reenviado, una captura).
 */
export function correoAMedias(email: string): string {
  const [usuario, dominio] = email.split("@");
  if (!dominio) return "tu correo";
  return `${usuario.slice(0, Math.min(2, usuario.length))}•••@${dominio}`;
}

/** Lo que se dice cuando el enlace no sirve, sea cual sea el motivo. */
export function EnlaceQueNoSirve({
  motivo,
}: {
  motivo: "invalido" | "vencido" | "no-existe";
}) {
  return (
    <HojaNewsletter
      rotulo="Newsletter"
      titulo={motivo === "vencido" ? "Este enlace venció" : "Este enlace no funciona"}
    >
      <p>
        {motivo === "vencido"
          ? "Los enlaces para confirmar duran 30 días. Anotate de nuevo desde el pie del diario y te llega uno nuevo."
          : "Puede que esté incompleto: probá copiarlo entero desde el correo. Si el problema sigue, anotate de nuevo desde el pie del diario."}
      </p>
    </HojaNewsletter>
  );
}
