import type { Metadata } from "next";
import { LogoSanmiguelino } from "@/components/brand/logos";
import { BotonReintentar } from "./boton-reintentar";

export const metadata: Metadata = {
  title: "Sin conexión",
  robots: { index: false },
};

/**
 * Lo que se ve cuando no hay señal y la página pedida no está guardada.
 *
 * No se llega acá navegando: el service worker (`public/sw.js`) la guarda al
 * instalarse y la sirve **en lugar de** la página que no pudo traer, así que la
 * barra de direcciones sigue mostrando la nota que se pidió. Por eso reintentar
 * es recargar, y recargar vuelve a pedir esa nota y no esta página.
 *
 * Es pública en el proxy: el worker la pide al instalarse, que puede ser en la
 * landing y sin sesión. Si pasara por el gate se guardaría el /login como aviso.
 *
 * No dice nada de quién está leyendo ni de la edición: es la misma para todos y
 * queda guardada en el teléfono aunque se cierre la sesión.
 *
 * Lleva la misma marca que `HojaDiario` (`data-sin-conexion`) porque el worker
 * no guarda ninguna página que no la traiga, tampoco ésta.
 */
export default function SinConexion() {
  return (
    <main
      className="escritorio grano flex flex-1 items-center justify-center px-4 py-24"
      data-sin-conexion="guardable"
    >
      <div className="fade-up hoja grano max-w-md px-8 py-12 text-center sm:px-10">
        <LogoSanmiguelino className="mx-auto w-full max-w-[15rem] text-ink opacity-70" />
        <p className="volanta mt-6 text-accent">Sin conexión</p>
        <h1 className="titular mt-3 text-[clamp(1.5rem,5vw,2.1rem)] leading-tight text-ink">
          Esta página no llegó
        </h1>
        {/* Sin "teléfono": la aplicación también se instala en la
            computadora, y ahí el aviso tiene que seguir siendo cierto. */}
        <p className="mt-4 text-pretty font-serif text-[0.98rem] leading-[1.7] text-ink-2">
          No hay conexión a internet y esta página todavía no estaba guardada
          en este dispositivo. Las páginas del diario que abrís con conexión
          quedan guardadas para leerlas sin ella.
        </p>
        <BotonReintentar />
        {/* Un enlace común y no un `<Link>`: el `<Link>` pediría la portada
            por la red, fallaría, y recién ahí caería a una navegación
            completa. Así va directo, y el worker contesta con la portada
            guardada si la hay. Anda aunque esta página no haya hidratado. */}
        <a
          href="/diario"
          className="mt-5 inline-flex items-center gap-2 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-3 transition-colors hover:text-accent"
        >
          Ir a la portada
        </a>
      </div>
    </main>
  );
}
