"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MessageCircleQuestion, RefreshCw, Send, X } from "lucide-react";
import { clasesDeBoton, clasesDeBotonIcono, clasesDeCampo } from "@/components/admin/piezas";
import { CuerpoMigue, RetratoMigue } from "@/components/migue/retrato-migue";
import { AYUDA, pantallaDeRuta } from "@/lib/migue/ayuda-panel";
import { cn } from "@/lib/utils";
import { ESTILO_SOBRE_LA_BARRA, useBurbujaMovible } from "@/lib/burbuja-movible";

interface Mensaje {
  rol: "usuario" | "migue";
  texto: string;
}

/**
 * Migue en el panel de administración.
 *
 * El mismo Migue del diario —el retrato y el cuerpo de siempre, sin tocar—
 * metido en la piel del panel: tarjeta blanca, tokens `--panel-*`, tipografía
 * de interfaz. Lo que cambia es qué sabe: acá ayuda a usar el panel, no cuenta
 * las notas (ver `lib/migue/panel.ts`).
 *
 * **Lo primero que ofrece son las preguntas de la pantalla en la que estás**, y
 * cambian solas al cambiar de sección: la ruta sale de `usePathname()`, que sí
 * se vuelve a ejecutar en cada navegación (el layout que lo monta no). Esas
 * preguntas traen la respuesta escrita en `ayuda-panel.ts` y se contestan acá
 * mismo, sin llamar al servidor: no cuestan nada y no pueden inventar.
 *
 * **Si lo que buscás no está, "Otra consulta"** lleva al campo de texto, y esa
 * pregunta sí va al modelo, con la guía del panel como único saber.
 *
 * Vive en `admin/layout.tsx` para que la conversación sobreviva al cambio de
 * pantalla, igual que el del diario vive en el layout del diario.
 */
export function MiguePanel({ nombre }: { nombre: string }) {
  const pantalla = pantallaDeRuta(usePathname());
  const ayuda = AYUDA[pantalla];
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [errorUltima, setErrorUltima] = useState<string | null>(null);
  const reducirMovimiento = useReducedMotion();
  // Se arrastra a donde moleste menos, y nunca tapa la barra de Guardar.
  const burbuja = useBurbujaMovible("sm-migue-panel-posicion");
  const listaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight });
  }, [mensajes, cargando, pantalla]);

  /** Una pregunta de la pantalla: la respuesta ya está escrita. */
  const responderEscrita = useCallback((pregunta: string, respuesta: string) => {
    setErrorUltima(null);
    setMensajes((prev) => [
      ...prev,
      { rol: "usuario", texto: pregunta },
      { rol: "migue", texto: respuesta },
    ]);
  }, []);

  /** "Otra consulta": no hay nada que mandar, hay que dejar escribir. */
  const otraConsulta = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const enviar = useCallback(
    async (pregunta: string) => {
      const limpia = pregunta.trim();
      if (!limpia || cargando) return;
      setErrorUltima(null);
      setTexto("");
      const anteriores = mensajes.slice(-12);
      setMensajes((prev) => [...prev, { rol: "usuario", texto: limpia }]);
      setCargando(true);
      try {
        const res = await fetch("/api/migue/panel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pregunta: limpia, pantalla, historial: anteriores }),
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
    [cargando, mensajes, pantalla],
  );

  /* Las preguntas que todavía no se hicieron en esta charla. Repetir como
     sugerencia algo que ya está contestado dos burbujas más arriba es ruido. */
  const hechas = new Set(mensajes.filter((m) => m.rol === "usuario").map((m) => m.texto));
  const pendientes = ayuda.preguntas.filter((p) => !hechas.has(p.pregunta));
  const primerNombre = nombre.split(" ")[0];

  return (
    <Dialog.Root open={abierto} onOpenChange={setAbierto} modal={false}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Abrir la ayuda de Migue"
          title="Tocá para preguntar; arrastrá para moverla"
          style={burbuja.style}
          {...burbuja.handlers}
          className="pressable fixed right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent font-sans text-accent-contrast shadow-panel hover:bg-accent-strong sm:h-auto sm:w-auto sm:gap-2.5 sm:py-1.5 sm:pr-4 sm:pl-1.5"
        >
          <RetratoMigue
            prioridad
            sizes="44px"
            className="h-11 w-11 bg-panel-tarjeta ring-1 ring-accent-contrast/25"
          />
          <span className="hidden text-panel-sm font-semibold sm:inline">
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
                initial={reducirMovimiento ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
                animate={reducirMovimiento ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                exit={reducirMovimiento ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                style={{ transformOrigin: "bottom right", ...ESTILO_SOBRE_LA_BARRA }}
                className="fixed right-5 z-50 flex h-[min(600px,calc(100dvh-2.5rem))] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-panel border border-panel-borde bg-panel-tarjeta font-sans text-panel-tinta shadow-panel"
              >
                <header className="flex items-center gap-3 border-b border-panel-borde px-4 py-3">
                  <RetratoMigue sizes="40px" className="h-10 w-10 bg-panel-tarjeta-2" />
                  <div className="min-w-0 flex-1">
                    <Dialog.Title className="text-panel-base font-semibold text-panel-tinta">
                      Migue
                    </Dialog.Title>
                    {/* Dónde está parado, dicho arriba: es lo que explica por
                        qué cambian las preguntas al cambiar de sección. */}
                    <p className="truncate text-panel-xs text-panel-tinta-3">
                      Ayuda del panel · {ayuda.nombre}
                    </p>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Cerrar la ayuda"
                      className={clasesDeBotonIcono({ tono: "fantasma" })}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </Dialog.Close>
                </header>

                <div
                  ref={listaRef}
                  className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
                  aria-live="polite"
                >
                  {mensajes.length === 0 && (
                    <div className="flex items-end gap-1">
                      <CuerpoMigue className="h-24 w-auto" />
                      <p className="mb-2 flex-1 text-panel-base text-panel-tinta-2">
                        ¡Hola, {primerNombre}! Estás en{" "}
                        <strong className="font-semibold text-panel-tinta">{ayuda.nombre}</strong>.
                        Estas son las dudas más comunes de esta pantalla.
                      </p>
                    </div>
                  )}

                  {mensajes.map((m, i) => (
                    <div
                      key={i}
                      className={cn(
                        "max-w-[88%] rounded-panel-2 px-3.5 py-2.5 text-panel-sm leading-relaxed whitespace-pre-wrap",
                        m.rol === "usuario"
                          ? "ml-auto bg-accent text-accent-contrast"
                          : "mr-auto bg-panel-tarjeta-2 text-panel-tinta",
                      )}
                    >
                      {m.texto}
                    </div>
                  ))}

                  {cargando && (
                    <p
                      role="status"
                      className="mr-auto flex items-center gap-1.5 rounded-panel-2 bg-panel-tarjeta-2 px-3.5 py-3"
                    >
                      <span className="sr-only">Migue está escribiendo</span>
                      <span aria-hidden="true" className="flex gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-panel-tinta-3 [animation-delay:0ms] motion-reduce:animate-none" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-panel-tinta-3 [animation-delay:120ms] motion-reduce:animate-none" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-panel-tinta-3 [animation-delay:240ms] motion-reduce:animate-none" />
                      </span>
                    </p>
                  )}

                  {errorUltima !== null && (
                    <div
                      role="alert"
                      className="mr-auto max-w-[88%] rounded-panel-2 border border-[var(--grafico-alerta)] bg-panel-tarjeta px-3.5 py-2.5 text-panel-sm text-panel-tinta"
                    >
                      <p>No pude responder por un problema de conexión.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setMensajes((prev) => prev.slice(0, -1));
                          enviar(errorUltima);
                        }}
                        className={`${clasesDeBoton({ tamano: "chico" })} mt-2`}
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        Reintentar
                      </button>
                    </div>
                  )}

                  {/* Las preguntas de esta pantalla, siempre al final del
                      historial: al empezar son lo primero que se ve, y después
                      de cada respuesta quedan a mano con las que faltan. Si
                      cambiás de sección con el chat abierto, aparecen las de la
                      nueva. "Otra consulta" va última y aparte, para cuando
                      lo que buscás no está. */}
                  {!cargando && (
                    <section aria-label={`Preguntas sobre ${ayuda.nombre}`} className="pt-1">
                      {mensajes.length > 0 && (
                        <p className="mb-2 text-panel-xs font-semibold text-panel-tinta-3">
                          Sobre {ayuda.nombre}
                        </p>
                      )}
                      <ul className="grid gap-2">
                        {pendientes.map((p) => (
                          <li key={p.pregunta}>
                            <button
                              type="button"
                              onClick={() => responderEscrita(p.pregunta, p.respuesta)}
                              className="pressable w-full rounded-panel-2 border border-panel-borde-campo bg-panel-tarjeta px-3.5 py-2.5 text-left text-panel-sm text-panel-tinta hover:border-accent hover:bg-panel-wash"
                            >
                              {p.pregunta}
                            </button>
                          </li>
                        ))}
                        <li>
                          <button
                            type="button"
                            onClick={otraConsulta}
                            className="pressable inline-flex w-full items-center gap-2 rounded-panel-2 px-3.5 py-2.5 text-left text-panel-sm font-semibold text-accent hover:bg-panel-wash"
                          >
                            <MessageCircleQuestion className="h-4 w-4 shrink-0" aria-hidden="true" />
                            {pendientes.length > 0
                              ? "Otra consulta"
                              : "¿Algo más? Escribime tu consulta"}
                          </button>
                        </li>
                      </ul>
                    </section>
                  )}
                </div>

                <form
                  className="flex items-center gap-panel-controles border-t border-panel-borde bg-panel-tarjeta-2 px-3 py-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    enviar(texto);
                  }}
                >
                  <label htmlFor="migue-panel-input" className="sr-only">
                    Escribí tu consulta para Migue
                  </label>
                  <input
                    id="migue-panel-input"
                    ref={inputRef}
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    maxLength={500}
                    placeholder="Escribí otra consulta…"
                    autoComplete="off"
                    className={`${clasesDeCampo("hundida")} h-10 flex-1`}
                  />
                  <button
                    type="submit"
                    disabled={cargando || texto.trim() === ""}
                    aria-label="Enviar consulta"
                    className={`${clasesDeBoton({ tono: "primario" })} h-10 w-10 shrink-0 px-0`}
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
