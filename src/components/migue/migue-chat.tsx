"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { LoaderCircle, LogIn, RefreshCw, Send, Square, X } from "lucide-react";
import { CuerpoMigue, RetratoMigue } from "@/components/migue/retrato-migue";
import { rutaDeIngreso } from "@/lib/auth/destino";
import { useRutaActual } from "@/lib/auth/usar-ruta-actual";
import { useLecturaEnVoz } from "@/lib/voz/usar-voz";
import { cn } from "@/lib/utils";

interface Mensaje {
  rol: "usuario" | "migue";
  texto: string;
}

const SUGERENCIAS = [
  "¿Qué notas trae esta edición?",
  "Contame sobre las esculturas del parque",
  "¿Qué hay en la agenda cultural?",
];

/* La marca de "volver del ingreso con el chat abierto". Guarda DESDE QUÉ
   PÁGINA se pidió el ingreso, y al montarse el chat se saca siempre: si la
   persona no llegó a ingresar ("Seguir leyendo", atrás, un error de Cidituc),
   una marca colgada abría el chat sola en otra página, horas después, en un
   ingreso que no lo había pedido. Va en sessionStorage —se va con la pestaña—
   y con try/catch: puede no estar (ventana privada, datos del sitio
   bloqueados), y eso no puede romper el chat. */
const MARCA_ABRIR = "sm-abrir-migue";
function marcarParaAbrir(ruta: string) {
  try {
    sessionStorage.setItem(MARCA_ABRIR, ruta);
  } catch {}
}
function sacarMarcaParaAbrir(): string | null {
  try {
    const ruta = sessionStorage.getItem(MARCA_ABRIR);
    sessionStorage.removeItem(MARCA_ABRIR);
    return ruta;
  } catch {
    return null;
  }
}

/** Vive en el layout del diario: la conversación sobrevive al paso de página
 *  y el contexto (la nota abierta) sale del pathname.
 *
 *  **Preguntarle a Migue pide ingresar**, aunque leer sea libre: cada respuesta
 *  la paga el municipio, y el tope por persona necesita saber quién pregunta
 *  (ver `src/lib/migue/tope.ts`). Sin sesión el botón sigue estando y el chat
 *  se abre igual, pero en lugar de las sugerencias y el campo va la invitación
 *  a ingresar, que vuelve a esta misma página con el chat abierto. Así no se
 *  manda una pregunta para recibir un rechazo disfrazado de error de conexión.
 *
 *  El layout lo monta con `key` según haya sesión: al salir de la cuenta el
 *  chat arranca de cero, sin la conversación de quien estaba. */
export function MigueChat({ conSesion }: { conSesion: boolean }) {
  const pathname = usePathname();
  // A dónde vuelve el "Ingresar": la página con su query.
  const rutaActual = useRutaActual();
  const enlaceIngreso = useRef<HTMLAnchorElement>(null);
  const notaSlug = pathname.startsWith("/nota/")
    ? pathname.slice("/nota/".length)
    : undefined;
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [errorUltima, setErrorUltima] = useState<string | null>(null);
  /** La API contestó que la sesión ya no vale (vencida, o cerrada en otra
   *  pestaña) o que la cuenta está bloqueada. */
  const [rechazo, setRechazo] = useState<"sesion" | "bloqueado" | null>(null);
  const puedePreguntar = conSesion && rechazo === null;
  const reducirMovimiento = useReducedMotion();
  const listaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /**
   * El slug de la última nota que Migue cita.
   *
   * Existe para que "me interesa eso, dame un resumen en audio" tenga
   * referente. Los atajos de la voz no miran la conversación a propósito —el
   * referente sale de la ruta, no del hilo—, pero cuando alguien pide audio y
   * no nombra ninguna nota, la que acaba de mencionarse ES la que quiere. Sin
   * esto Migue contestaba por escrito que eso no lo tenía, con la nota recién
   * nombrada dos burbujas más arriba.
   *
   * Va en un ref y no en estado: cambiarlo no tiene que repintar nada.
   */
  const ultimaNotaRef = useRef<string | undefined>(undefined);
  // Migue lee en voz alta cuando el servidor le manda un texto para decir.
  // El motor vive en el chat, que está montado en el layout, así que la voz
  // sobrevive al paso de página igual que la conversación.
  const { leyendo, preparando, leer, detener } = useLecturaEnVoz();

  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight });
  }, [mensajes, cargando]);

  // La barra de secciones puede abrir el chat ("Migue" a la derecha)
  useEffect(() => {
    const abrir = () => setAbierto(true);
    window.addEventListener("migue:abrir", abrir);
    return () => window.removeEventListener("migue:abrir", abrir);
  }, []);

  // De vuelta del ingreso que se pidió desde el chat, en la misma página: se
  // reabre solo. La marca se saca siempre, haya sesión o no. En un setTimeout
  // y no en el cuerpo del efecto, para no encadenar un render más sobre el de
  // la hidratación.
  useEffect(() => {
    const t = setTimeout(() => {
      const desde = sacarMarcaParaAbrir();
      if (conSesion && desde === rutaActual) setAbierto(true);
    });
    return () => clearTimeout(t);
  }, [conSesion, rutaActual]);

  // Si la API rechaza la pregunta, el foco va a "Ingresar": el campo donde
  // estaba acaba de desaparecer.
  useEffect(() => {
    if (rechazo === "sesion") enlaceIngreso.current?.focus();
  }, [rechazo]);

  const enviar = useCallback(
    async (pregunta: string) => {
      const limpia = pregunta.trim();
      if (!limpia || cargando) return;
      setErrorUltima(null);
      setTexto("");
      // Los turnos anteriores, tomados ANTES de agregar el actual: el que se
      // pregunta ahora viaja aparte, en `pregunta`. Sin esto Migue recibía cada
      // mensaje suelto y a un "decime" no podía contestar más que un saludo,
      // porque no sabía qué acababa de ofrecer.
      const anteriores = mensajes.slice(-12);
      setMensajes((prev) => [...prev, { rol: "usuario", texto: limpia }]);
      setCargando(true);
      try {
        const res = await fetch("/api/migue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pregunta: limpia,
            notaSlug,
            // La última nota de la que se habló, para que "dame un audio de
            // eso" tenga a qué referirse. Ver `ultimaNotaRef`.
            ultimaNota: ultimaNotaRef.current,
            historial: anteriores,
          }),
        });
        if (res.status === 401 || res.status === 403) {
          // No es un problema de conexión y reintentar no lo arregla: se saca
          // la pregunta que no se pudo hacer y se explica qué pasa.
          setMensajes((prev) => prev.slice(0, -1));
          setRechazo(res.status === 401 ? "sesion" : "bloqueado");
          return;
        }
        if (!res.ok) throw new Error();
        const data: { respuesta: string; notaSlug?: string; leer?: string } =
          await res.json();
        // El hilo de QUÉ nota se está hablando. El historial de texto no
        // alcanza: el servidor tendría que releer sus propias respuestas para
        // adivinar de cuál habló, y el slug ya viaja en la respuesta.
        if (data.notaSlug) ultimaNotaRef.current = data.notaSlug;
        setMensajes((prev) => [...prev, { rol: "migue", texto: data.respuesta }]);
        /*
         * Migue habla.
         *
         * Esto ROMPE la regla del gesto síncrono de iOS a propósito y con
         * conocimiento: el `speak()` sale después de un `await fetch`, así que
         * en Safari de iPhone puede no sonar. No hay forma de evitarlo por este
         * camino —el texto lo decide el servidor, que es el único que tiene la
         * nota—, y la alternativa sería que el cliente adivine qué leer, que es
         * peor. Para quien esté en iPhone existe el botón "Escuchar el resumen"
         * de la franja de metadatos, que sí habla desde el mismo tick del
         * click. Los dos caminos comparten el motor.
         *
         * El mp3 con la voz de Migue NO arregla esto y no hay que pretender
         * que sí: `audio.play()` tiene exactamente el mismo requisito de gesto
         * que `speak()`, y acá el gesto se perdió una llamada antes. Lo que sí
         * gana el chat es la voz: donde el navegador deja reproducir, Migue
         * suena como Migue en vez de como el sintetizador del sistema.
         *
         * **La fuente sale de `data.notaSlug`, no del pathname**, y la
         * diferencia no es cosmética: es de qué habla la voz.
         *
         * Salió roto a producción. Estaba tomando el slug de la URL, que es de
         * dónde sale el resto del contexto de este componente. Pero desde la
         * tapa el pathname no tiene slug, así que a "dame un resumen en audio
         * de la peatonal" el texto contestaba "te leo la peatonal" y sonaba
         * **el audio de la tapa**. Peor que no sonar: la voz oficial del
         * municipio leyendo algo que nadie pidió, con la pantalla afirmando
         * otra cosa.
         *
         * Quién decide qué se lee es el servidor —es el único que tiene la
         * edición— y lo dice en la respuesta. El pathname dice dónde está
         * parado el lector, que es una pregunta distinta y acá no es la que
         * importa: se puede pedir el audio de una nota desde cualquier página.
         *
         * Sin `notaSlug` en la respuesta, lo que se leyó es la tapa: es el
         * único caso donde la ruta contesta con `leer` y sin nota.
         *
         * El texto no viaja —lo deriva el servidor—; `data.leer` queda como el
         * respaldo que se le pasa a la voz del sistema.
         */
        if (data.leer) {
          leer(
            data.leer,
            data.notaSlug
              ? { que: "nota", slug: data.notaSlug }
              : { que: "tapa" },
          );
        }
      } catch {
        setErrorUltima(limpia);
      } finally {
        setCargando(false);
        inputRef.current?.focus();
      }
    },
    [cargando, notaSlug, mensajes, leer],
  );

  return (
    <Dialog.Root open={abierto} onOpenChange={setAbierto} modal={false}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Abrir chat con Migue, el asistente del diario"
          className="pressable fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-contrast shadow-flotante hover:bg-accent-strong sm:h-auto sm:w-auto sm:gap-2.5 sm:py-2 sm:pl-2 sm:pr-5"
        >
          {/* La cara va sobre un círculo claro y no directamente sobre el
              acento: el retrato tiene alfa, y el azul del botón se le metía
              entre el pelo y los anteojos. */}
          <RetratoMigue
            prioridad
            sizes="44px"
            className="h-11 w-11 bg-paper ring-1 ring-accent-contrast/25"
          />
          <span className="hidden font-sans text-[0.7rem] font-semibold uppercase tracking-[0.16em] sm:inline">
            Preguntale a Migue
          </span>
        </button>
      </Dialog.Trigger>

      <AnimatePresence>
        {abierto && (
          <Dialog.Portal forceMount>
            <Dialog.Content
              asChild
              forceMount
              aria-describedby={undefined}
              onInteractOutside={(e) => e.preventDefault()}
            >
              <motion.div
                initial={
                  reducirMovimiento ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 8 }
                }
                animate={
                  reducirMovimiento ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }
                }
                exit={
                  reducirMovimiento ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 8 }
                }
                transition={{ duration: 0.2, ease: "easeOut" }}
                style={{ transformOrigin: "bottom right" }}
                className="fixed bottom-5 right-5 z-50 flex h-[min(580px,calc(100dvh-2.5rem))] w-[min(390px,calc(100vw-2.5rem))] flex-col overflow-hidden border border-ink bg-chrome shadow-flotante"
              >
                {/* Header */}
                <header className="flex items-center gap-3 border-b border-ink bg-paper-2 px-4 py-3">
                  <RetratoMigue sizes="40px" className="h-10 w-10 bg-paper-2" />
                  <div className="min-w-0 flex-1">
                    <Dialog.Title className="font-sans text-[0.72rem] font-bold uppercase tracking-[0.18em] text-ink">
                      Migue
                    </Dialog.Title>
                    <p className="truncate font-serif text-[0.78rem] italic text-ink-3">
                      Asistente de El Sanmiguelino
                    </p>
                  </div>
                  {/*
                   * Callar a Migue. Aparece SÓLO mientras habla, y va acá —en
                   * la cabecera, pegado al cerrar— y no adentro de la burbuja
                   * por una razón concreta: la lectura sobrevive al scroll del
                   * historial y al paso de página, así que el control que la
                   * corta no puede vivir en algo que se puede ir de pantalla.
                   *
                   * No lleva texto de estado propio: el historial entero ya es
                   * una región viva (`aria-live` acá abajo), y un anuncio más
                   * adentro hace que un lector de pantalla lea todo dos veces.
                   *
                   * Aparece TAMBIÉN mientras se genera el mp3 —`leyendo` ya es
                   * true ahí— y eso es medio punto de la función: generar el
                   * audio puede tardar unos segundos, y si el botón recién
                   * apareciera cuando empieza a sonar, no habría forma de
                   * arrepentirse durante la única parte que se hace esperar.
                   */}
                  {leyendo && (
                    <button
                      type="button"
                      onClick={detener}
                      /*
                       * El label EMPIEZA por la palabra que se ve, en los dos
                       * estados. Es el criterio 2.5.3 de WCAG (Label in Name):
                       * quien maneja el diario por voz —Voice Control de iOS,
                       * Voice Access de Android, Dragon— lee el botón y dice
                       * "tocar Preparando" o "tocar Parar", y si esa palabra no
                       * está en el nombre accesible el comando no engancha con
                       * nada. Antes el label era "Dejar de leer en voz alta"
                       * fijo: ni "Preparando" ni "Parar" estaban adentro, así
                       * que el único control que corta la voz quedaba
                       * inalcanzable justo cuando hace falta arrepentirse.
                       */
                      aria-label={
                        preparando
                          ? "Preparando la lectura, tocá para cancelar"
                          : "Parar la lectura en voz alta"
                      }
                      className="pressable flex h-8 items-center gap-1.5 border border-accent bg-accent px-2.5 font-sans text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-accent-contrast hover:bg-accent-strong"
                    >
                      {preparando ? (
                        <LoaderCircle
                          className="h-3 w-3 animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                      ) : (
                        <Square className="h-3 w-3" aria-hidden="true" />
                      )}
                      {preparando ? "Preparando" : "Parar"}
                    </button>
                  )}
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Cerrar chat"
                      className="pressable flex h-8 w-8 items-center justify-center border border-transparent text-ink-3 hover:border-line hover:bg-chrome hover:text-ink"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </Dialog.Close>
                </header>

                {/* Historial */}
                <div
                  ref={listaRef}
                  className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
                  aria-live="polite"
                >
                  {puedePreguntar && mensajes.length === 0 && (
                    <div className="space-y-3.5">
                      <div className="flex items-end gap-1">
                        <CuerpoMigue className="h-28 w-auto" />
                        <p className="mb-3 flex-1 font-serif text-[0.95rem] leading-relaxed text-ink-2">
                          ¡Hola! Soy Migue. Preguntame lo que quieras sobre las
                          notas de esta edición.
                        </p>
                      </div>
                      <ul className="space-y-2">
                        {SUGERENCIAS.map((s) => (
                          <li key={s}>
                            <button
                              type="button"
                              onClick={() => enviar(s)}
                              className="pressable w-full border border-line bg-paper-2 px-3.5 py-2.5 text-left font-serif text-[0.9rem] italic text-ink hover:border-ink hover:bg-paper"
                            >
                              {s}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {mensajes.map((m, i) => (
                    <div
                      key={i}
                      className={cn(
                        "max-w-[86%] whitespace-pre-wrap px-3.5 py-2.5 font-sans text-[0.85rem] leading-relaxed",
                        m.rol === "usuario"
                          ? "ml-auto bg-ink text-paper"
                          : "mr-auto border border-line bg-paper-2 text-ink",
                      )}
                    >
                      {m.texto}
                    </div>
                  ))}

                  {cargando && (
                    <p
                      className="mr-auto flex items-center gap-1.5 border border-line bg-paper-2 px-3.5 py-3 font-sans text-sm text-ink-2"
                      role="status"
                    >
                      <span className="sr-only">Migue está escribiendo</span>
                      <span aria-hidden="true" className="flex gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-2 [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-2 [animation-delay:120ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-2 [animation-delay:240ms]" />
                      </span>
                    </p>
                  )}

                  {errorUltima !== null && (
                    <div
                      role="alert"
                      className="mr-auto max-w-[86%] border border-red-300 bg-red-50 px-3.5 py-2.5 font-sans text-[0.85rem] text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                    >
                      <p>No pude responder por un problema de conexión.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setMensajes((prev) => prev.slice(0, -1));
                          enviar(errorUltima);
                        }}
                        className="pressable mt-1.5 inline-flex items-center gap-1 font-semibold underline underline-offset-2"
                      >
                        <RefreshCw className="h-3 w-3" aria-hidden="true" />
                        Reintentar
                      </button>
                    </div>
                  )}

                  {/* La invitación va AL FINAL del historial y no arriba: si la
                      sesión vence en medio de una charla, el historial ya está
                      bajado hasta el fondo, y arriba quedaba fuera de la vista,
                      con el campo de texto desaparecido. Sin sesión el
                      historial está vacío y se ve igual que antes. */}
                  {!puedePreguntar && (
                    <div className="space-y-3.5">
                      <div className="flex items-end gap-1">
                        <CuerpoMigue className="h-28 w-auto" />
                        <p className="mb-3 flex-1 font-serif text-[0.95rem] leading-relaxed text-ink-2">
                          {rechazo === "bloqueado"
                            ? "Tu cuenta no puede usar a Migue. Las notas se siguen leyendo igual."
                            : rechazo === "sesion"
                              ? "Se te venció la sesión. Ingresá de nuevo para seguir preguntando."
                              : "¡Hola! Soy Migue. Para preguntarme sobre las notas, ingresá con tu cuenta de Ciudadano Digital."}
                        </p>
                      </div>
                      {rechazo !== "bloqueado" && (
                        <Link
                          ref={enlaceIngreso}
                          href={rutaDeIngreso(rutaActual)}
                          onClick={() => marcarParaAbrir(rutaActual)}
                          className="pressable flex w-full items-center justify-center gap-2 bg-accent px-4 py-3 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-accent-contrast hover:bg-accent-strong"
                        >
                          <LogIn className="h-4 w-4" aria-hidden="true" />
                          Ingresar para preguntarle
                        </Link>
                      )}
                    </div>
                  )}
                </div>

                {/* Input: sólo para quien puede preguntar. */}
                {puedePreguntar && (
                  <form
                    className="flex items-center gap-2 border-t border-line bg-paper-2 px-3 py-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      enviar(texto);
                    }}
                  >
                    <label htmlFor="migue-input" className="sr-only">
                      Escribí tu pregunta para Migue
                    </label>
                    <input
                      id="migue-input"
                      ref={inputRef}
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      placeholder="Preguntale a Migue…"
                      autoComplete="off"
                      className="h-10 flex-1 border border-line bg-chrome px-3 font-serif text-[0.9rem] text-ink transition-colors placeholder:italic placeholder:text-ink-3 focus:border-accent"
                    />
                    <button
                      type="submit"
                      disabled={cargando || texto.trim() === ""}
                      aria-label="Enviar pregunta"
                      className="pressable flex h-10 w-10 shrink-0 items-center justify-center bg-accent text-accent-contrast hover:bg-accent-strong disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </form>
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
