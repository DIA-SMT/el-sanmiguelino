"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ExternalLink,
  FileText,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import {
  digitalizarEdicionAction,
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

/** El mismo tope que valida el servidor en `verificarPdfSubido()` y el mismo
 *  que tiene el bucket. Acá está para avisar ANTES de esperar una subida
 *  entera, no para reemplazarlo: la validación que cuenta es la del bucket, que
 *  es la única que no se puede saltear desde acá. */
const MAXIMO_BYTES = 50 * 1024 * 1024;

type Paso =
  | { que: "quieto" }
  | { que: "leyendo" }
  /** Ya se sabe cuántas páginas tiene y hay algo que se va a borrar: páginas
   *  que existen, notas escritas, o las dos cosas. Se pregunta antes. */
  | { que: "confirmar"; archivo: File; paginas: number; sePierden: number }
  /** Quitar el PDF también borra páginas y comentarios: se pregunta igual. */
  | { que: "confirmar-quitar" }
  | { que: "subiendo"; porcentaje: number }
  | { que: "guardando" }
  /** El servidor se está bajando el PDF y convirtiéndolo. Son unos cinco
   *  segundos para ocho páginas, así que necesita su propio cartel: sin él
   *  parece que la subida se colgó justo al final. */
  | { que: "digitalizando" }
  /** Digitalizar una edición que ya está publicada reemplaza lo que los
   *  vecinos están leyendo. Se pregunta antes. */
  | { que: "confirmar-digitalizar" };

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
  comentariosEscritos,
  comentariosPaginas,
  laUnicaServible,
  publicada,
  paginasDigitalizadas,
}: {
  slug: string;
  mes: string;
  /** Lo que ya está cargado, si hay algo. */
  pdf: { url: string; paginas: number } | null;
  /** Notas escritas a mano en esta edición. Cargar el PDF las reemplaza, y por
   *  eso se cuentan: hay que poder decir cuántas se van. */
  notasEscritas: number;
  /** Comentarios que cuelgan de esas notas escritas. Se van con ellas. */
  comentariosEscritos: number;
  /** Comentarios que cuelgan de las PÁGINAS del PDF: los que se pierden al
   *  quitarlo. */
  comentariosPaginas: number;
  /** Es la única edición que el diario puede servir. Quitarle el PDF la deja
   *  sin contenido, así que dejaría el sitio sin ningún número. */
  laUnicaServible: boolean;
  /** Ya salió: es lo que están leyendo los vecinos. Digitalizarla reemplaza el
   *  contenido en vivo, así que se pregunta antes. */
  publicada: boolean;
  /** Cuántas de sus páginas ya están digitalizadas. Con 0, el número está
   *  cargado como facsímil y se ve el PDF dibujado. */
  paginasDigitalizadas: number;
}) {
  const router = useRouter();
  const campo = useRef<HTMLInputElement>(null);
  const [paso, setPaso] = useState<Paso>({ que: "quieto" });
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    paginas: number;
    figuras: number;
    segundos: number;
    avisos: { pagina: number; texto: string }[];
  } | null>(null);

  const ocupado =
    paso.que !== "quieto" &&
    paso.que !== "confirmar" &&
    paso.que !== "confirmar-quitar" &&
    paso.que !== "confirmar-digitalizar";

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
      /*
       * Se pregunta antes de subir cuando hay algo que se va a borrar, y hay
       * dos motivos posibles:
       *
       * - **notas escritas**: publicar el número como facsímil las reemplaza;
       * - **un PDF más largo que el nuevo**: las páginas de más quedan colgadas.
       *
       * Los dos se llevan comentarios de vecinos por la cascada, así que
       * ninguno puede pasar en silencio.
       */
      const sePierden = pdf ? Math.max(pdf.paginas - paginas, 0) : 0;
      if (sePierden > 0 || notasEscritas > 0) {
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
        // Sólo cuando de verdad hay notas escritas. La bandera existe porque el
        // servidor se niega a mezclar las dos formas de publicar un número, y
        // acá ya se preguntó cuántas notas y cuántos comentarios se van.
        reemplazarNotasEscritas: notasEscritas > 0,
      });
      if (!guardado.ok) throw new Error(guardado.error ?? "No se pudo guardar.");

      // Y se digitaliza en el acto. Es lo que hace que un número nuevo salga
      // legible sin que nadie tenga que acordarse de un segundo paso: subir el
      // PDF y digitalizarlo son la misma operación desde el punto de vista de
      // quien carga la edición.
      await digitalizar();
    } catch (e) {
      setPaso({ que: "quieto" });
      setError(e instanceof Error ? e.message : "No se pudo subir el PDF.");
    }
  }

  /**
   * Convierte el PDF ya cargado en las notas del diario.
   *
   * Se puede repetir cuantas veces haga falta y **no exige volver a subir el
   * archivo**: el objeto vive en una URL pública y el servidor se lo baja solo.
   * Eso es lo que permite mejorar el conversor y reprocesar un número viejo con
   * un botón.
   */
  async function digitalizar() {
    setError(null);
    setResultado(null);
    setPaso({ que: "digitalizando" });
    try {
      const res = await digitalizarEdicionAction({
        slug,
        // Sólo cuando de verdad está publicada. El servidor lo exige en ese
        // caso y acá ya se preguntó.
        confirmarPublicada: publicada,
      });
      if (!res.ok) throw new Error(res.error ?? "No se pudo digitalizar.");
      setPaso({ que: "quieto" });
      setResultado({
        paginas: res.paginas ?? 0,
        figuras: res.figuras ?? 0,
        segundos: res.segundos ?? 0,
        avisos: res.avisos ?? [],
      });
      router.refresh();
    } catch (e) {
      setPaso({ que: "quieto" });
      setError(
        e instanceof Error ? e.message : "No se pudo digitalizar el PDF.",
      );
    }
  }

  async function quitar() {
    setError(null);
    setPaso({ que: "guardando" });
    try {
      const res = await quitarPdfEdicionAction({
        slug,
        // Sólo cuando de verdad hay comentarios que perder. El servidor lo
        // exige en ese caso y acá ya se preguntó, contándolos.
        confirmarComentarios: comentariosPaginas > 0,
      });
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

      {paso.que === "confirmar-digitalizar" ? (
        <>
          <Aviso
            icono={AlertTriangle}
            tono="var(--grafico-alerta)"
            sobre="tarjeta"
            rol="alert"
          >
            {mes}{" "}
            <strong className="font-semibold text-panel-tinta">
              ya está publicada
            </strong>
            : es el número que están leyendo los vecinos. Digitalizarlo de nuevo
            reemplaza el texto y las fotos de sus{" "}
            <strong className="font-semibold text-panel-tinta">
              {pdf?.paginas ?? 0} páginas
            </strong>{" "}
            por lo que salga de la conversión, en vivo. Los comentarios no se
            pierden: siguen colgados de cada página.
          </Aviso>
          <div className="flex flex-wrap items-center gap-panel-controles">
            <button
              type="button"
              onClick={() => void digitalizar()}
              className={BOTON_DESTRUCTIVO}
            >
              <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
              Digitalizar igual
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
      ) : paso.que === "confirmar-quitar" ? (
        <>
          <Aviso
            icono={AlertTriangle}
            tono="var(--grafico-alerta)"
            sobre="tarjeta"
            rol="alert"
          >
            Quitar el PDF de {mes} borra sus{" "}
            <strong className="font-semibold text-panel-tinta">
              {pdf ? pdf.paginas - 1 : 0}{" "}
              {pdf && pdf.paginas - 1 === 1 ? "página" : "páginas"} del diario
            </strong>
            {comentariosPaginas > 0 ? (
              <>
                {" y los "}
                <strong className="font-semibold text-panel-tinta">
                  {comentariosPaginas}{" "}
                  {comentariosPaginas === 1
                    ? "comentario de un vecino"
                    : "comentarios de vecinos"}
                </strong>
                {" que tienen"}
              </>
            ) : null}
            . El archivo queda en el storage, pero el número se queda sin
            contenido.{" "}
            <strong className="font-semibold text-panel-tinta">
              Si lo que querés es cambiar el archivo por otro, no hace falta
              quitarlo
            </strong>
            : usá Reemplazar el PDF.
          </Aviso>
          <div className="flex flex-wrap items-center gap-panel-controles">
            <button
              type="button"
              onClick={() => void quitar()}
              className={BOTON_DESTRUCTIVO}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Quitar el PDF
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
      ) : paso.que === "confirmar" ? (
        <>
          <Aviso
            icono={AlertTriangle}
            tono="var(--grafico-alerta)"
            sobre="tarjeta"
            rol="alert"
          >
            {/* Se enumera lo que se pierde, contado. "Se van a borrar datos"
                obliga a adivinar cuántos, y adivinando nadie decide bien. */}
            El PDF tiene {paso.paginas}{" "}
            {paso.paginas === 1 ? "página" : "páginas"}. Al cargarlo se borra:
            <ul className="mt-1.5 grid gap-0.5">
              {notasEscritas > 0 && (
                <li>
                  las{" "}
                  <strong className="font-semibold text-panel-tinta">
                    {notasEscritas}{" "}
                    {notasEscritas === 1 ? "nota escrita" : "notas escritas"}
                  </strong>{" "}
                  de {mes}
                  {comentariosEscritos > 0 ? (
                    <>
                      {" "}
                      y sus {comentariosEscritos}{" "}
                      {comentariosEscritos === 1
                        ? "comentario"
                        : "comentarios"}
                    </>
                  ) : null}
                </li>
              )}
              {paso.sePierden > 0 && (
                <li>
                  <strong className="font-semibold text-panel-tinta">
                    {paso.sePierden}{" "}
                    {paso.sePierden === 1 ? "página" : "páginas"}
                  </strong>{" "}
                  del PDF anterior, que tenía {pdf?.paginas}, y los comentarios
                  que tengan
                </li>
              )}
            </ul>
          </Aviso>
          <div className="flex flex-wrap items-center gap-panel-controles">
            <button
              type="button"
              onClick={() => subir(paso.archivo, paso.paginas)}
              className={BOTON_PRIMARIO}
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              {notasEscritas > 0
                ? "Publicar el número como PDF"
                : "Subir igual"}
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
        <>
          {/* El aviso está, pero ya NO reemplaza al botón.
              Antes sí, y era un callejón: las dos ediciones que existían tenían
              notas escritas, así que en las dos la única cosa que se veía era
              este cartel — la carga del PDF quedaba invisible justo donde se la
              buscaba, y encima no había forma de borrar una nota desde el panel.
              Ahora el botón se ve siempre y el conflicto se resuelve en la
              confirmación, contando lo que se va. */}
          {notasEscritas > 0 && (
            <Aviso
              icono={AlertTriangle}
              tono="var(--grafico-diario)"
              sobre="tarjeta"
            >
              {mes} está armada con {notasEscritas}{" "}
              {notasEscritas === 1 ? "nota escrita" : "notas escritas"}. Un
              número se publica con notas o con el PDF del impreso, no con las
              dos cosas: cargar el PDF las reemplaza.
            </Aviso>
          )}
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
                  onClick={() => {
                    setError(null);
                    setPaso({ que: "confirmar-quitar" });
                  }}
                  disabled={ocupado || laUnicaServible}
                  title={
                    laUnicaServible
                      ? "Es la única edición que el diario puede servir: sin el PDF se queda sin contenido y el sitio sin ningún número."
                      : undefined
                  }
                  className={BOTON_DESTRUCTIVO}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Quitar
                </button>
                {/* Digitalizar de nuevo NO pide volver a subir el archivo: el
                    servidor se lo baja del bucket. Sirve para reprocesar un
                    número viejo cuando el conversor mejora, y para rehacer una
                    página que se corrigió a mano y quedó peor. */}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    if (publicada) setPaso({ que: "confirmar-digitalizar" });
                    else void digitalizar();
                  }}
                  disabled={ocupado}
                  className={BOTON_SECUNDARIO}
                >
                  <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {paginasDigitalizadas > 0
                    ? "Digitalizar de nuevo"
                    : "Digitalizar"}
                </button>
              </>
            )}
          </div>

          {/* Cómo quedó el número: digitalizado o dibujado. Es la diferencia
              entre que se lea en un teléfono y que no, así que se dice acá y no
              hay que ir a buscarlo al diario. */}
          {pdf && !resultado && (
            <p className="text-panel-xs text-panel-tinta-3">
              {paginasDigitalizadas > 0
                ? `${paginasDigitalizadas} ${paginasDigitalizadas === 1 ? "página digitalizada" : "páginas digitalizadas"}: el diario las muestra como notas y el facsímil queda a un botón.`
                : "Sin digitalizar: el diario dibuja las páginas del PDF, que en un teléfono no se leen."}
            </p>
          )}
        </>
      )}

      {resultado && (
        <div className="grid gap-1.5 rounded-panel-2 bg-panel-tarjeta p-3">
          <p className="text-panel-sm font-medium text-panel-tinta-2">
            {resultado.paginas}{" "}
            {resultado.paginas === 1 ? "página" : "páginas"} y{" "}
            {resultado.figuras}{" "}
            {resultado.figuras === 1 ? "imagen" : "imágenes"}, en{" "}
            {resultado.segundos} s.
          </p>
          {resultado.avisos.length > 0 ? (
            <>
              {/* Los avisos son lo ÚNICO que hay que mirar sí o sí. El resto de
                  la revisión es opcional; esto es el conversor diciendo dónde
                  no estuvo seguro. */}
              <p className="text-panel-xs text-panel-tinta-3">
                Revisá estas {resultado.avisos.length === 1 ? "página" : "páginas"}:
              </p>
              <ul className="grid gap-1">
                {resultado.avisos.map((a, i) => (
                  <li key={i} className="text-panel-xs text-panel-tinta-2">
                    <Link
                      href={`/admin/nota/${slug}-p${a.pagina}`}
                      className="font-medium underline underline-offset-2 hover:text-accent"
                    >
                      Página {a.pagina}
                    </Link>
                    : {a.texto}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-panel-xs text-panel-tinta-3">
              El conversor no encontró nada dudoso. Igual conviene mirar el
              número en el diario antes de publicarlo.
            </p>
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
                : paso.que === "digitalizando"
                  ? "Digitalizando: separando el texto, recortando las fotos y armando las notas. Puede tardar unos segundos."
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
