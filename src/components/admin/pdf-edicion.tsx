"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ExternalLink,
  FileText,
  Trash2,
  Upload,
} from "lucide-react";
import {
  firmarSubidaPdfAction,
  guardarPdfEdicionAction,
  quitarPdfEdicionAction,
} from "@/app/admin/acciones";
import { Aviso, clasesDeBoton } from "@/components/admin/piezas";
import { contarPaginas } from "@/lib/pdf/visor";

const BOTON_SECUNDARIO = clasesDeBoton({ tamano: "chico", sobre: "tarjeta" });
const BOTON_PRIMARIO = clasesDeBoton({ tono: "primario", tamano: "chico" });
const BOTON_DESTRUCTIVO = clasesDeBoton({
  tono: "destructivo",
  tamano: "chico",
  sobre: "tarjeta",
});
const BOTON_QUIETO = clasesDeBoton({ tono: "fantasma", tamano: "chico" });

/** El mismo tope que valida el servidor en `verificarPdfSubido()`. Acá está
 *  para avisar ANTES de esperar una subida entera, no para reemplazarlo: la
 *  validación que cuenta es la del servidor. */
const MAXIMO_BYTES = 60 * 1024 * 1024;

type Paso =
  | { que: "quieto" }
  | { que: "leyendo" }
  /** Ya se sabe cuántas páginas tiene, y borra páginas que existen: hay que
   *  preguntar antes. */
  | { que: "confirmar"; archivo: File; paginas: number; sePierden: number }
  | { que: "subiendo"; porcentaje: number }
  | { que: "guardando" };

/**
 * Cargar el PDF del impreso en una edición.
 *
 * **El archivo no pasa por el servidor.** El navegador le pide una firma, sube
 * directo a Storage y recién después le avisa al servidor dónde quedó. El
 * porqué está en `urlFirmadaParaPdf()`: en Vercel un request no puede pesar más
 * de 4,5 MB y el PDF de un diario mensual siempre pesa más.
 *
 * Las páginas también se cuentan acá, con el mismo pdf.js que dibuja el diario.
 * Del lado del servidor habría que bajar y parsear el archivo entero en cada
 * carga; y como quien sube es un administrador cargando su propio número, lo
 * único que puede lograr mintiendo es romperlo a la vista de todos.
 */
export function PdfEdicion({
  slug,
  mes,
  pdf,
  notasEscritas,
}: {
  slug: string;
  mes: string;
  /** Lo que ya está cargado, si hay algo. */
  pdf: { url: string; paginas: number } | null;
  /** Notas escritas a mano en esta edición. Con una sola, el PDF no se puede
   *  cargar: una edición se publica de una forma o de la otra. */
  notasEscritas: number;
}) {
  const router = useRouter();
  const campo = useRef<HTMLInputElement>(null);
  const [paso, setPaso] = useState<Paso>({ que: "quieto" });
  const [error, setError] = useState<string | null>(null);

  const ocupado = paso.que !== "quieto" && paso.que !== "confirmar";

  function limpiarCampo() {
    // Sin esto, elegir el MISMO archivo dos veces seguidas —después de un
    // error— no dispara `change` y el botón parece no hacer nada.
    if (campo.current) campo.current.value = "";
  }

  async function alElegir(archivo: File) {
    setError(null);

    if (archivo.size === 0) {
      setError("El archivo está vacío.");
      return;
    }
    if (archivo.size > MAXIMO_BYTES) {
      setError(
        `El PDF pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB y el ` +
          `máximo son ${MAXIMO_BYTES / 1024 / 1024} MB.`,
      );
      return;
    }

    setPaso({ que: "leyendo" });
    try {
      // Los cinco bytes de la cabecera, antes de cargar treinta megas en
      // pdf.js: un archivo que no es un PDF se descarta en el acto y con un
      // mensaje que dice qué pasó.
      const cabeza = new Uint8Array(await archivo.slice(0, 5).arrayBuffer());
      if (String.fromCharCode(...cabeza) !== "%PDF-") {
        throw new Error(
          "Ese archivo no es un PDF. Si le cambiaste la extensión, el " +
            "contenido sigue siendo el de antes.",
        );
      }

      const paginas = await contarPaginas(archivo);
      // Un PDF más corto que el anterior deja páginas colgadas, y borrarlas
      // borra sus comentarios. Eso se pregunta antes, no se informa después.
      const sePierden = pdf ? Math.max(pdf.paginas - paginas, 0) : 0;
      if (sePierden > 0) {
        setPaso({ que: "confirmar", archivo, paginas, sePierden });
        return;
      }
      await subir(archivo, paginas);
    } catch (e) {
      setPaso({ que: "quieto" });
      setError(
        e instanceof Error ? e.message : "No se pudo leer el PDF.",
      );
    } finally {
      limpiarCampo();
    }
  }

  async function subir(archivo: File, paginas: number) {
    setError(null);
    setPaso({ que: "subiendo", porcentaje: 0 });

    try {
      const firma = await firmarSubidaPdfAction(slug);
      if (!firma.ok || !firma.destino || !firma.urlPublica) {
        throw new Error(firma.error ?? "No se pudo preparar la subida.");
      }

      /*
       * XMLHttpRequest y no `fetch`, por una sola razón: el porcentaje.
       *
       * `fetch` no informa el avance de la SUBIDA —sólo el de la bajada— y acá
       * son treinta megas por una conexión municipal. Sin barra, el editor mira
       * una pantalla quieta durante minutos y lo más razonable que puede hacer
       * es apretar de nuevo.
       */
      await new Promise<void>((listo, falla) => {
        const pedido = new XMLHttpRequest();
        pedido.open("PUT", firma.destino!);
        pedido.setRequestHeader("Content-Type", "application/pdf");
        pedido.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setPaso({
              que: "subiendo",
              porcentaje: Math.round((e.loaded / e.total) * 100),
            });
          }
        });
        pedido.addEventListener("load", () => {
          if (pedido.status >= 200 && pedido.status < 300) listo();
          else falla(new Error(`Storage rechazó el archivo (${pedido.status}).`));
        });
        pedido.addEventListener("error", () =>
          falla(new Error("Se cortó la conexión mientras subía el archivo.")),
        );
        pedido.addEventListener("abort", () =>
          falla(new Error("La subida se canceló.")),
        );
        pedido.send(archivo);
      });

      setPaso({ que: "guardando" });
      const guardado = await guardarPdfEdicionAction({
        slug,
        url: firma.urlPublica,
        paginas,
      });
      if (!guardado.ok) throw new Error(guardado.error ?? "No se pudo guardar.");

      setPaso({ que: "quieto" });
      router.refresh();
    } catch (e) {
      setPaso({ que: "quieto" });
      setError(e instanceof Error ? e.message : "No se pudo subir el PDF.");
    }
  }

  async function quitar() {
    setError(null);
    setPaso({ que: "guardando" });
    try {
      const res = await quitarPdfEdicionAction(slug);
      if (!res.ok) throw new Error(res.error ?? "No se pudo quitar el PDF.");
      setPaso({ que: "quieto" });
      router.refresh();
    } catch (e) {
      setPaso({ que: "quieto" });
      setError(e instanceof Error ? e.message : "No se pudo quitar el PDF.");
    }
  }

  return (
    <div className="mt-3 grid gap-2.5 rounded-panel-2 bg-panel-tarjeta-2 p-3.5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <FileText
          className="h-4 w-4 shrink-0 text-panel-tinta-3"
          aria-hidden="true"
        />
        <span className="text-panel-sm font-medium text-panel-tinta-2">
          Diario en PDF
        </span>
        {pdf ? (
          <span className="text-panel-xs text-panel-tinta-3">
            {pdf.paginas} {pdf.paginas === 1 ? "página" : "páginas"} · la tapa
            es la 1 y {pdf.paginas > 1 ? `las otras ${pdf.paginas - 1} se pasan` : "no hay más"} en el
            diario
          </span>
        ) : (
          <span className="text-panel-xs text-panel-tinta-3">
            Sin cargar: {mes} se arma con notas escritas.
          </span>
        )}
      </div>

      {notasEscritas > 0 && !pdf ? (
        <Aviso icono={AlertTriangle} tono="var(--grafico-diario)" sobre="tarjeta">
          Esta edición tiene {notasEscritas}{" "}
          {notasEscritas === 1 ? "nota escrita" : "notas escritas"}. Una edición
          se publica con notas o con el PDF del impreso, no con las dos cosas.
        </Aviso>
      ) : paso.que === "confirmar" ? (
        <>
          <Aviso
            icono={AlertTriangle}
            tono="var(--grafico-alerta)"
            sobre="tarjeta"
            rol="alert"
          >
            El PDF nuevo tiene {paso.paginas}{" "}
            {paso.paginas === 1 ? "página" : "páginas"} y el que está cargado
            tiene {pdf?.paginas}. Se van a borrar {paso.sePierden}{" "}
            {paso.sePierden === 1 ? "página" : "páginas"} del diario{" "}
            <strong className="font-semibold text-panel-tinta">
              y los comentarios que tengan
            </strong>
            .
          </Aviso>
          <div className="flex flex-wrap items-center gap-panel-controles">
            <button
              type="button"
              onClick={() => subir(paso.archivo, paso.paginas)}
              className={BOTON_PRIMARIO}
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              Subir igual
            </button>
            <button
              type="button"
              onClick={() => setPaso({ que: "quieto" })}
              className={BOTON_QUIETO}
            >
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-panel-controles">
          {/* El input va escondido y lo dispara el botón: un `input[type=file]`
              suelto se dibuja distinto en cada navegador y no hay forma de que
              entre en el vocabulario de botones del panel. `sr-only` y no
              `hidden` para que siga siendo alcanzable por teclado y lo anuncie
              un lector de pantalla. */}
          <label className={BOTON_SECUNDARIO}>
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            {pdf ? "Reemplazar el PDF" : "Cargar el PDF"}
            <input
              ref={campo}
              type="file"
              accept="application/pdf,.pdf"
              disabled={ocupado}
              className="sr-only"
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (archivo) void alElegir(archivo);
              }}
            />
          </label>

          {pdf && (
            <>
              <a
                href={pdf.url}
                target="_blank"
                rel="noopener"
                className={BOTON_SECUNDARIO}
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Ver el archivo
              </a>
              <button
                type="button"
                onClick={() => void quitar()}
                disabled={ocupado}
                className={BOTON_DESTRUCTIVO}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Quitar
              </button>
            </>
          )}
        </div>
      )}

      {ocupado && (
        <div className="grid gap-1.5">
          <p
            className="text-panel-xs text-panel-tinta-2"
            role="status"
            aria-live="polite"
          >
            {paso.que === "leyendo"
              ? "Leyendo el PDF y contando las páginas…"
              : paso.que === "subiendo"
                ? `Subiendo… ${paso.porcentaje}%`
                : "Guardando las páginas de la edición…"}
          </p>
          {/* La barra es decorativa: el número ya está escrito arriba y lo
              anuncia el `aria-live`. Una segunda voz diciendo lo mismo
              interrumpe la lectura en cada porcentaje. */}
          <div
            aria-hidden="true"
            className="h-1 w-full overflow-hidden rounded-full bg-panel-borde"
          >
            <div
              className="h-full bg-accent transition-[width] duration-200"
              style={{
                width:
                  paso.que === "subiendo" ? `${paso.porcentaje}%` : "100%",
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <Aviso
          icono={AlertTriangle}
          tono="var(--grafico-alerta)"
          sobre="tarjeta"
          rol="alert"
        >
          {error}
        </Aviso>
      )}
    </div>
  );
}
