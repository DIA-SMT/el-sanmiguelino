"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MessageCircle, RefreshCw, Send, X } from "lucide-react";
import { LogoHoja } from "@/components/brand/logos";
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

export function MigueChat({ notaSlug }: { notaSlug?: string }) {
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
          className="pressable fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-contrast shadow-lg transition-colors hover:bg-accent-strong"
        >
          <MessageCircle className="h-6 w-6" aria-hidden="true" />
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
                className="fixed bottom-5 right-5 z-50 flex h-[min(560px,calc(100dvh-2.5rem))] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-xl border border-line bg-chrome shadow-2xl"
              >
                {/* Header */}
                <header className="flex items-center gap-3 border-b border-line bg-paper px-4 py-3">
                  <LogoHoja className="h-8 w-8" title="Migue" />
                  <div className="min-w-0 flex-1">
                    <Dialog.Title className="font-sans text-sm font-bold text-ink">
                      Migue
                    </Dialog.Title>
                    <p className="truncate font-sans text-xs text-ink-2">
                      Asistente de El Sanmiguelino
                    </p>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Cerrar chat"
                      className="pressable flex h-8 w-8 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-bg hover:text-ink"
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
                    <div className="space-y-3">
                      <p className="font-sans text-sm text-ink-2">
                        ¡Hola! Soy Migue. Preguntame lo que quieras sobre las
                        notas de esta edición.
                      </p>
                      <ul className="space-y-2">
                        {SUGERENCIAS.map((s) => (
                          <li key={s}>
                            <button
                              type="button"
                              onClick={() => enviar(s)}
                              className="pressable w-full rounded-lg border border-line bg-paper px-3 py-2 text-left font-sans text-sm text-ink transition-colors hover:border-accent hover:text-accent"
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
                        "max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 font-sans text-sm leading-relaxed",
                        m.rol === "usuario"
                          ? "ml-auto rounded-br-sm bg-accent text-accent-contrast"
                          : "mr-auto rounded-bl-sm bg-paper text-ink border border-line",
                      )}
                    >
                      {m.texto}
                    </div>
                  ))}

                  {cargando && (
                    <p
                      className="mr-auto flex items-center gap-1.5 rounded-xl rounded-bl-sm border border-line bg-paper px-3 py-2 font-sans text-sm text-ink-2"
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
                      className="mr-auto max-w-[85%] rounded-xl rounded-bl-sm border border-red-300 bg-red-50 px-3 py-2 font-sans text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
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
                  className="flex items-center gap-2 border-t border-line bg-paper px-3 py-3"
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
                    className="h-10 flex-1 rounded-md border border-line bg-chrome px-3 font-sans text-sm text-ink placeholder:text-ink-2/70"
                  />
                  <button
                    type="submit"
                    disabled={cargando || texto.trim() === ""}
                    aria-label="Enviar pregunta"
                    className="pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-contrast transition-colors hover:bg-accent-strong disabled:opacity-50"
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
