import { CIDITUC_CONFIGURADO } from "@/lib/auth/config";

/**
 * El botón de ingreso. Un enlace común, no un `fetch`: lo que sigue es una
 * navegación de verdad que sale del sitio hacia el derivador municipal, y volver
 * de ahí con un token no es algo que pueda resolver el cliente.
 *
 * Deliberadamente **no** es un `<Link>` de Next. `Link` precarga el destino al
 * pasarle el mouse por encima, y el destino de acá no es una página: es el
 * arranque del ingreso, que deja una cookie con un nonce. Precargarlo emitiría
 * nonces que nadie va a usar y pisaría el del intento en curso.
 */
export function BotonIngresar({ destino }: { destino: string }) {
  if (!CIDITUC_CONFIGURADO) {
    return (
      <p
        role="status"
        className="mt-8 border border-line px-4 py-3 font-sans text-[0.78rem] leading-relaxed text-ink-3"
      >
        El ingreso con Cidituc todavía no está habilitado en este sitio.
      </p>
    );
  }

  const href =
    destino === "/diario"
      ? "/auth/cidituc/inicio"
      : `/auth/cidituc/inicio?volverA=${encodeURIComponent(destino)}`;

  return (
    <div className="mt-8">
      <a
        href={href}
        className="pressable inline-flex w-full items-center justify-center gap-2.5 bg-accent px-5 py-3.5 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-accent-contrast shadow-control hover:bg-accent-strong"
      >
        Ingresar con Cidituc
      </a>
    </div>
  );
}
