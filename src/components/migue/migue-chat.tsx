"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { RefreshCw, Send, X } from "lucide-react";
import { CuerpoMigue, RetratoMigue } from "@/components/migue/retrato-migue";
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

/** Vive en el layout del diario: la conversación sobrevive al paso de página
 *  y el contexto (la nota abierta) sale del pathname. */
export function MigueChat() {
  const pathname = usePathname();
  const notaSlug = pathname.startsWith("/nota/")
    ? pathname.slice("/nota/".length)
    : undefined;
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [errorUltima, setErrorUltima] = useState<string | null>(null);
  const reducirMovimiento = useReducedMotion();
  const listaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight });
  }, [mensajes, cargando]);

  // La barra de secciones puede abrir el chat ("Migue" a la derecha)
  useEffect(() => {
    const abrir = () => setAbierto(true);
    window.addEventListener("migue:abrir", abrir);
    return () => window.removeEventListener("migue:abrir", abrir);
  }, []);

  const enviar = useCallback(
    async (pregunta: string) => {
      const limpia = pregunta.trim();
      if (!limpia || cargando) return;
      setErrorUltima(null);
      setTexto("");
      setMensajes((prev) => [...prev, { rol: "usuario", texto: limpia }]);
      setCargando(true);
      try {
        const res = await fetch("/api/migue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pregunta: limpia, notaSlug }),
        });
        if (!res.ok) throw new Error();
        const data: { respuesta: string } = await res.json();
        setMensajes((prev) => [...prev, { rol: "migue", texto: data.respuesta }]);
      } catch {
        setErrorUltima(limpia);
      } finally {
        setCargando(false);
        inputRef.current?.focus();
      }
    },
    [cargando, notaSlug],
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
                  {mensajes.length === 0 && (
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
                </div>

                {/* Input */}
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
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
