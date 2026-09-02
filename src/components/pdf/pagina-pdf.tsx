"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import {
  abrirPdf,
  claseCapaTexto,
  dibujarPagina,
  olvidarHojasLejanas,
} from "@/lib/pdf/visor";
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
 * **La hoja no se dibuja acá: se pide dibujada.** `dibujarPagina()` la tiene
 * lista de antes —este mismo componente pidió las vecinas mientras el lector
 * leía la anterior— y lo único que queda es copiarla. Ahí está la diferencia
 * entre un giro de página fluido y uno que se arrastra; el porqué, con los
 * tiempos medidos, está en `src/lib/pdf/visor.ts`.
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
   *
   * Y además es lo que hace que el caché de dibujos sirva: la clave lleva el
   * ancho, así que sin redondear, dos hojas del mismo diario casi nunca
   * compartirían medida.
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
    let ocio: number | null = null;

    /*
     * El canvas se dibuja a la resolución de la pantalla, no a la del diseño:
     * en un teléfono con dpr 3 un canvas de 360px de ancho se ve borroso al
     * lado del texto del diario, que es vectorial.
     *
     * Con tope en 2 igual: de 2 a 3 la diferencia no se ve y el área del canvas
     * —y con ella la memoria— crece con el cuadrado. Una página de diario a dpr
     * 3 son 40 millones de píxeles, que en iOS directamente no se asigna y el
     * canvas sale en blanco.
     */
    const densidad = Math.min(window.devicePixelRatio || 1, 2);

    (async () => {
      try {
        // Si la hoja ya estaba dibujada —el caso normal al pasar de página—
        // esto resuelve en el acto y lo único que cuesta es la copia.
        const dibujo = await dibujarPagina(url, pagina, ancho, densidad);
        if (cancelado) return;

        setProporcion(dibujo.height / dibujo.width);

        const canvas = lienzo.current;
        const pincel = canvas?.getContext("2d");
        if (!canvas || !pincel) return;
        canvas.width = dibujo.width;
        canvas.height = dibujo.height;
        canvas.style.width = "100%";
        canvas.style.height = "auto";
        pincel.drawImage(dibujo, 0, 0);

        /*
         * La capa de texto va en unidades CSS, no en las del canvas: son los
         * caracteres de verdad, ubicados encima de su dibujo. pdf.js posiciona
         * cada span con `calc(var(--total-scale-factor) * …px)`, así que la
         * variable tiene que estar puesta en el contenedor o todo se apila en
         * la esquina.
         *
         * Cuesta 33-43 ms medidos, así que va en el camino directo y no
         * adelantada: adelantarla obligaría a guardar nodos del DOM en el
         * caché para ahorrar cuarenta milisegundos.
         */
        const documento = await abrirPdf(url);
        if (cancelado) return;
        const hoja = await documento.getPage(pagina);
        if (cancelado) return;
        const contenedor = capa.current;
        if (contenedor) {
          const natural = hoja.getViewport({ scale: 1 });
          const escala = ancho / natural.width;
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

        /*
         * Y ahora las vecinas, mientras el lector lee ésta.
         *
         * Va en `requestIdleCallback` para no pelearle el hilo a la hoja que se
         * está terminando de mostrar —ni al giro de página, si todavía está
         * corriendo—. Safari no lo tiene, así que hay respaldo con un
         * temporizador de 1200 ms: apenas más que el giro, o sea el primer
         * momento en que se sabe que la animación no está animando.
         *
         * Los errores se comen en silencio a propósito: esto es trabajo
         * especulativo sobre una página que el lector todavía no pidió, y si
         * falla se va a volver a intentar cuando la pida de verdad.
         */
        const adelantarVecinas = () => {
          if (cancelado) return;
          for (const vecina of [pagina + 1, pagina - 1]) {
            if (vecina < 1 || vecina > documento.numPages) continue;
            void dibujarPagina(url, vecina, ancho, densidad).catch(() => {});
          }
          olvidarHojasLejanas(url, pagina, ancho);
        };

        if (typeof requestIdleCallback === "function") {
          ocio = requestIdleCallback(adelantarVecinas, { timeout: 3000 });
        } else {
          ocio = window.setTimeout(adelantarVecinas, 1200);
        }
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
      /*
       * El dibujado NO se cancela, y es a propósito: vive en el módulo, así que
       * si el lector pasa de hoja mientras ésta se dibuja, el trabajo termina y
       * queda en el caché. Volver atrás es entonces instantáneo. Antes se
       * cancelaba y se tiraba a la basura.
       */
      if (ocio !== null) {
        if (typeof cancelIdleCallback === "function") cancelIdleCallback(ocio);
        window.clearTimeout(ocio);
      }
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
