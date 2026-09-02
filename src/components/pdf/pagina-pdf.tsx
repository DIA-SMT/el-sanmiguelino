"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import type { RenderTask } from "pdfjs-dist";
import { abrirPdf, claseCapaTexto } from "@/lib/pdf/visor";
import { cn } from "@/lib/utils";

/**
 * Una página del PDF del impreso, dibujada dentro de la hoja del diario.
 *
 * **Se dibuja con pdf.js en un canvas, y no se delega en el visor del
 * navegador.** Un `<iframe src="…#page=3">` es dos líneas y falla justo donde
 * más lectores hay: Safari en iPhone ignora el `#page` dentro de un iframe y
 * muestra siempre la primera página, así que pasar de hoja no haría nada. Con
 * pdf.js la página es un elemento más de la hoja: entra en el papel, respeta
 * el ancho de la caja, pasa con el mismo gesto que el resto del diario y no
 * trae la barra de herramientas de otro programa encima del diseño.
 *
 * **Y va con capa de texto.** Un canvas es una imagen: sin ella el diario
 * entero quedaría fuera del alcance de un lector de pantalla y no se podría ni
 * seleccionar una frase para copiarla — inaceptable en un sitio del Estado
 * (Ley 26.653). La capa son los mismos caracteres del PDF, transparentes y
 * ubicados encima de su dibujo. Lo que no puede arreglar es un PDF que sea un
 * escaneo: ahí no hay texto que sacar, y por eso la página siempre ofrece
 * además el archivo entero para abrirlo con las herramientas de cada uno.
 *
 * El PDF **no se vuelve a bajar en cada hoja**: `abrirPdf()` guarda el
 * documento abierto por dirección y el caché vive en el módulo, así que
 * sobrevive a la navegación del cliente.
 */
export function PaginaPdf({
  url,
  pagina,
  etiqueta,
  className,
}: {
  /** El PDF de la edición. */
  url: string;
  /** Qué página dibujar, empezando en 1. */
  pagina: number;
  /** Qué es esto, para quien no lo ve: "Página 3 de Septiembre de 2026". */
  etiqueta: string;
  className?: string;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const capa = useRef<HTMLDivElement>(null);

  const [ancho, setAncho] = useState(0);
  /** alto/ancho de la página, para reservar el lugar antes de dibujarla. */
  const [proporcion, setProporcion] = useState<number | null>(null);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * El ancho de la caja, redondeado a saltos de 16px.
   *
   * Sin el redondeo, arrastrar el borde de la ventana dispara un dibujado por
   * cada píxel: pdf.js rasteriza una página entera cada vez y el navegador se
   * arrodilla. Con saltos de 16 el resultado es indistinguible —la página se
   * reescala por CSS en el medio— y se dibuja una vez cada tanto.
   */
  useEffect(() => {
    const elemento = caja.current;
    if (!elemento) return;
    const observador = new ResizeObserver(([entrada]) => {
      const medido = entrada.contentRect.width;
      if (medido > 0) setAncho(Math.round(medido / 16) * 16);
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    if (ancho === 0) return;

    let cancelado = false;
    let tarea: RenderTask | null = null;

    (async () => {
      try {
        const documento = await abrirPdf(url);
        if (cancelado) return;
        const hoja = await documento.getPage(pagina);
        if (cancelado) return;

        const natural = hoja.getViewport({ scale: 1 });
        setProporcion(natural.height / natural.width);

        const escala = ancho / natural.width;
        /*
         * El canvas se dibuja a la resolución de la pantalla, no a la del
         * diseño: en un teléfono con dpr 3 un canvas de 360px de ancho se ve
         * borroso al lado del texto del diario, que es vectorial.
         *
         * Con tope en 2 igual: de 2 a 3 la diferencia no se ve y el área del
         * canvas —y con ella la memoria— crece con el cuadrado. Una página de
         * diario a dpr 3 son 40 millones de píxeles, que en iOS directamente
         * no se asigna y el canvas sale en blanco.
         */
        const densidad = Math.min(window.devicePixelRatio || 1, 2);
        const vista = hoja.getViewport({ scale: escala * densidad });

        const canvas = lienzo.current;
        const contexto = canvas?.getContext("2d");
        if (!canvas || !contexto) return;

        canvas.width = Math.floor(vista.width);
        canvas.height = Math.floor(vista.height);
        canvas.style.width = "100%";
        canvas.style.height = "auto";

        tarea = hoja.render({ canvas, canvasContext: contexto, viewport: vista });
        await tarea.promise;
        if (cancelado) return;

        /*
         * La capa de texto va en unidades CSS, no en las del canvas: son los
         * caracteres de verdad, ubicados encima de su dibujo. pdf.js posiciona
         * cada span con `calc(var(--total-scale-factor) * …px)`, así que la
         * variable tiene que estar puesta en el contenedor o todo se apila en
         * la esquina.
         */
        const contenedor = capa.current;
        if (contenedor) {
          const vistaCss = hoja.getViewport({ scale: escala });
          contenedor.replaceChildren();
          contenedor.style.setProperty("--total-scale-factor", String(escala));
          const CapaTexto = await claseCapaTexto();
          if (cancelado) return;
          await new CapaTexto({
            textContentSource: hoja.streamTextContent(),
            container: contenedor,
            viewport: vistaCss,
          }).render();
        }

        if (cancelado) return;
        setError(null);
        setListo(true);
      } catch (e) {
        // Cancelar un dibujado en curso —al pasar de página, al reescalar— tira
        // por diseño. No es un error que el lector tenga que ver.
        if (cancelado || (e as Error)?.name === "RenderingCancelledException") {
          return;
        }
        setError(
          e instanceof Error && e.message
            ? e.message
            : "No se pudo abrir el PDF de esta edición.",
        );
      }
    })();

    return () => {
      cancelado = true;
      tarea?.cancel();
    };
  }, [url, pagina, ancho]);

  return (
    <div ref={caja} className={cn("w-full", className)}>
      {error ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 border border-line px-5 py-6"
        >
          <p className="flex items-center gap-2 font-sans text-[0.9rem] text-ink">
            <AlertTriangle
              className="h-4 w-4 shrink-0 text-accent"
              aria-hidden="true"
            />
            {error}
          </p>
          <a
            href={url}
            target="_blank"
            rel="noopener"
            className="enlace inline-flex items-center gap-1.5 font-sans text-[0.85rem]"
          >
            Abrir el PDF de esta edición
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      ) : (
        <div
          className="pagina-pdf relative w-full"
          /* El lugar se reserva antes de dibujar: sin esto la hoja crece de
             golpe cuando la página aparece y el diario da un salto. Mientras
             no se sabe la proporción se usa la de una hoja de diario. */
          style={{ aspectRatio: `1 / ${proporcion ?? 1.4}` }}
        >
          <canvas
            ref={lienzo}
            /* La imagen la describe la capa de texto, que son los caracteres
               de verdad. Anunciar además "imagen: página 3" sería leer dos
               veces la misma cosa. */
            aria-hidden="true"
            className={cn(
              "block w-full transition-opacity duration-300",
              listo ? "opacity-100" : "opacity-0",
            )}
          />
          <div ref={capa} className="capa-texto" aria-label={etiqueta} />
          {!listo && (
            <p className="absolute inset-0 flex items-center justify-center font-sans text-[0.8rem] uppercase tracking-[0.16em] text-ink-3">
              Cargando la página…
            </p>
          )}
        </div>
      )}
    </div>
  );
}
