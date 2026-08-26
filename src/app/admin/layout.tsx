import Link from "next/link";
import { LogoHoja } from "@/components/brand/logos";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserChip } from "@/components/user-chip";
import { requerirAdmin } from "@/lib/auth/dal";

/**
 * Chrome del panel de administración.
 *
 * Llama a `requerirAdmin()`, **y cada página de adentro lo llama otra vez**.
 * No es redundancia: en el App Router el layout no es un límite de seguridad
 * —no se re-ejecuta en navegaciones del cliente y no corre para las Server
 * Actions—, así que la guardia de acá cubre el cromo y nada más. Ya nos pasó
 * una vez con `(diario)/layout.tsx`, que servía el índice completo de la
 * edición a una cookie con firma inválida.
 *
 * Deliberadamente NO se parece al diario: no usa `.hoja` ni el escritorio, y
 * el fondo es liso. El panel es una herramienta de trabajo, y confundirlo con
 * la publicación invita a creer que lo que se ve acá ya está publicado.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requerirAdmin();

  return (
    /* flex-1 y no sólo min-h-full: el <body> es una columna flex, así que sin
       crecer el panel queda del alto de su contenido y por debajo asoma la
       panorámica del diario, que acá no pinta nada. */
    <div className="flex min-h-full flex-1 flex-col bg-paper">
      <header className="border-b border-ink bg-chrome">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <LogoHoja className="h-8 w-8 shrink-0" />
            <div className="min-w-0">
              <p className="font-sans text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink">
                Administración
              </p>
              <p className="truncate font-sans text-[0.68rem] text-ink-3">
                El Sanmiguelino
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              href="/diario"
              className="pressable hidden font-sans text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-3 hover:text-accent sm:inline"
            >
              Ver el diario
            </Link>
            <ThemeToggle />
            <AdminUser />
          </div>
        </div>
        {/* Todavía no hay barra de secciones: sería un menú de un solo ítem, o
            peor, links a pantallas que no existen. Vuelve cuando estén la
            moderación de comentarios y el tablero de Migue. */}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}

/** El chip del usuario necesita la sesión; `requerirAdmin()` ya la resolvió y
 *  `cache()` hace que esta segunda llamada no vuelva a pegarle a nada. */
async function AdminUser() {
  const { usuario } = await requerirAdmin();
  return <UserChip usuario={usuario} />;
}
