import { BarraLateralPanel } from "@/components/admin/navegacion-panel";
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
 * Ese "no se re-ejecuta" es también el motivo de que la barra lateral sea un
 * componente de cliente aparte: la ruta activa no se puede leer desde acá, y
 * si se pudiera quedaría clavada en la primera navegación. Este archivo se
 * queda server porque `requerirAdmin()` lo necesita; la marca de la sección
 * activa baja al cliente y nada más.
 *
 * Deliberadamente NO se parece al diario: no usa `.hoja` ni el escritorio, y
 * la superficie es lisa. El panel es una herramienta de trabajo, y confundirlo
 * con la publicación invita a creer que lo que se ve acá ya está publicado.
 *
 * El rediseño de tablero —fondo gris, tarjetas blancas flotando, esquinas
 * redondeadas, tipografía de interfaz— refuerza esa separación en vez de
 * discutirla: el diario es papel crema con filetes rectos y versalitas, y acá
 * no hay nada de eso. Por eso el panel tiene sus propios tokens `--panel-*`
 * en `globals.css` y no reusa los del diario: son dos sistemas visuales, y el
 * único puente entre ellos es `--accent`, el azul del isotipo municipal, que
 * es de la Municipalidad y no de ninguno de los dos.
 */

/** El destino del salto. Está acá y no escrito dos veces porque el enlace y el
 *  `<main>` tienen que coincidir o el salto no lleva a ningún lado, y eso no
 *  falla ruidosamente: falla en silencio, para una sola persona. */
const ID_CONTENIDO = "contenido-del-panel";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { usuario } = await requerirAdmin();

  return (
    /* flex-1 y no sólo min-h-full: el <body> es una columna flex, así que sin
       crecer el panel queda del alto de su contenido y por debajo asoma la
       panorámica del diario, que acá no pinta nada.

       `font-sans` va en la raíz del panel y no en cada pantalla: el <body>
       hereda la serif del diario, y una herramienta de trabajo escrita en
       Newsreader se lee como una nota publicada. */
    <div className="flex min-h-full flex-1 flex-col bg-panel-fondo font-sans text-panel-tinta lg:flex-row">
      {/*
        Saltar la navegación (WCAG 2.4.1, nivel A).

        La barra pone ocho paradas de tabulación —marca, cinco secciones, tema,
        usuario— antes de que se llegue al contenido, y las pone en las CINCO
        pantallas. En el editor, que es la más larga, eso se paga en cada vuelta
        al formulario. Va primero en el DOM porque tiene que ser la primera
        parada de todas; si estuviera después de la barra no serviría para nada.

        Es el único enlace del panel que se ve sólo al enfocarlo: `sr-only` lo
        deja disponible para el lector de pantalla y fuera de la vista, y
        `focus:not-sr-only` lo devuelve a la pantalla. `focus:fixed` y no
        `focus:absolute` a propósito: con `absolute` el enlace se dibuja arriba
        de todo el documento, así que tabular desde una pantalla ya scrolleada
        mandaba el foco a un cartel que no se veía.
      */}
      <a
        href={`#${ID_CONTENIDO}`}
        className="sr-only rounded-panel-2 border border-panel-borde-campo bg-panel-tarjeta px-4 py-2 text-panel-sm font-semibold text-panel-tinta shadow-panel focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        Saltar la navegación
      </a>

      <BarraLateralPanel usuario={usuario} />

      {/* min-w-0 para que una tabla ancha se desplace adentro de su tarjeta en
          vez de estirar la columna y empujar la barra fuera de la pantalla.

          `tabIndex={-1}` es lo que hace que el salto MUEVA el foco y no sólo la
          vista: sin él, el lector de pantalla se queda leyendo desde la barra
          aunque la página haya bajado. No lleva `focus:outline-none` —el anillo
          de la casa alrededor del contenido es justamente el acuse de recibo de
          que el salto llegó, y quien saltó vino con el teclado. */}
      <main
        id={ID_CONTENIDO}
        tabIndex={-1}
        className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
      >
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
