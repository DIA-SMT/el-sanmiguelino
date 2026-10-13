"use client";

/**
 * "Verla como salió impresa": la página del PDF, sobre la nota digitalizada.
 *
 * Existe porque digitalizar una página **cambia lo que el lector ve**. El texto
 * pasa a fluir en las columnas de la web, las fotos se acomodan solas y en un
 * teléfono por fin se lee; pero la maqueta del impreso —dónde estaba cada cosa,
 * qué tamaño tenía el titular, cómo se cruzaban la infografía y el aviso— es
 * información que el diario en papel comunica y que la versión web no puede
 * reproducir. En una publicación oficial eso no es un detalle estético: es el
 * documento.
 *
 * Así que el facsímil no se tira, se corre a un botón. El visor es el mismo de
 * siempre (`PaginaPdf`), con su caché de dibujos y su capa de texto
 * seleccionable.
 *
 * **El visor se monta recién cuando se abre el diálogo.** `PaginaPdf` importa
 * pdf.js dinámicamente —450 KB— y ponerlo en el árbol de cada nota lo bajaría
 * para todos los lectores, incluidos los que nunca tocan el botón. Radix
 * desmonta el contenido cuando está cerrado, así que basta con no forzar
 * `forceMount`.
 */

import * as Dialog from "@radix-ui/react-dialog";
import { Newspaper, X } from "lucide-react";
import { PaginaPdf } from "@/components/pdf/pagina-pdf";
import { rotuloDeFolios } from "@/lib/data/paginas";

export function VerFacsimil({
  url,
  paginas,
  mes,
}: {
  url: string;
  /**
   * Las páginas del impreso que muestra la nota, en orden. Casi siempre una;
   * dos cuando la nota ocupaba dos páginas del papel y la redacción las unió
   * (ver `NotaResumen.pdfHasta`). Van una debajo de la otra, como se
   * hojearían: mostrar sólo la primera dejaría la segunda sin forma de verse.
   */
  paginas: number[];
  mes: string;
}) {
  if (paginas.length === 0) return null;
  const rotulo = rotuloDeFolios({
    desde: paginas[0],
    hasta: paginas[paginas.length - 1],
  });

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="pressable inline-flex items-center gap-2 border border-line px-3 py-1.5 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-3 transition-colors hover:border-ink hover:text-ink"
        >
          <Newspaper className="h-3.5 w-3.5" aria-hidden="true" />
          Verla como salió impresa
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-[2px]" />
        {/* Casi toda la pantalla: una A3 en un cuadro chico es exactamente el
            problema que la digitalización vino a resolver. Acá el lector viene
            a mirar la maqueta, así que se le da todo el lugar disponible y el
            alto lo maneja el scroll. */}
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-1.5rem)] w-[min(64rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 flex-col border border-ink bg-chrome shadow-flotante"
        >
          <header className="flex items-center justify-between gap-4 border-b border-ink bg-paper-2 px-4 py-3">
            <Dialog.Title className="font-sans text-[0.8rem] font-bold uppercase tracking-[0.14em] text-ink">
              {rotulo} · {mes}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Cerrar"
                className="pressable flex h-8 w-8 shrink-0 items-center justify-center border border-transparent text-ink-3 hover:border-line hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </header>

          <div className="grid gap-6 overflow-y-auto p-3 sm:p-4">
            {paginas.map((pagina) => (
              <PaginaPdf
                key={pagina}
                url={url}
                pagina={pagina}
                etiqueta={`Página ${pagina} de El Sanmiguelino, ${mes}, tal como salió impresa`}
              />
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
