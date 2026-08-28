"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Mailbox, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Anotarse para recibir El Sanmiguelino en papel.
 *
 * Pide correo, domicilio, nombre y edad. **Cuando llegue el SSO de Cidituc, el
 * nombre y la edad van a salir de ahí** y el formulario va a quedar en dos
 * campos. Por eso esos dos están juntos y últimos: el día que sobren, se va la
 * fila entera y el resto queda igual.
 *
 * La validación de verdad está en el servidor —`/api/suscripciones`—. Lo de
 * acá es para que quien escribe se entere antes de mandar, no una defensa.
 */

const campo =
  "w-full border border-line bg-chrome px-3 py-2 font-sans text-[0.9rem] text-ink transition-colors placeholder:text-ink-3 focus:border-accent focus:outline-none";
const etiqueta =
  "block font-sans text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-2";

export function SuscripcionPapel() {
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<"nuevo" | "actualizado" | null>(null);
  const [datos, setDatos] = useState({
    nombre: "",
    edad: "",
    email: "",
    direccion: "",
  });

  function editar(clave: keyof typeof datos, valor: string) {
    setError(null);
    setDatos((d) => ({ ...d, [clave]: valor }));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/suscripciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
      const cuerpo = await res.json();
      if (!res.ok) {
        setError(cuerpo.error ?? "No se pudo guardar.");
        return;
      }
      setListo(cuerpo.yaEstaba ? "actualizado" : "nuevo");
    } catch {
      setError("No se pudo hablar con el servidor. Probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  function cerrar(v: boolean) {
    setAbierto(v);
    // Al volver a abrirlo, en limpio: dejar el cartel de "listo" puesto haría
    // creer que se anotó de nuevo.
    if (!v) {
      setListo(null);
      setError(null);
    }
  }

  return (
    <Dialog.Root open={abierto} onOpenChange={cerrar}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="pressable inline-flex items-center gap-2 border border-ink px-3.5 py-2 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink transition-colors hover:bg-ink hover:text-paper"
        >
          <Mailbox className="h-3.5 w-3.5" aria-hidden="true" />
          Recibilo en papel
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-ink bg-chrome shadow-flotante">
          <header className="flex items-start justify-between gap-4 border-b border-ink bg-paper-2 px-5 py-4">
            <div>
              <Dialog.Title className="font-sans text-[0.95rem] font-bold text-ink">
                El Sanmiguelino en papel
              </Dialog.Title>
              <Dialog.Description className="mt-1 font-serif text-[0.85rem] italic text-ink-3">
                Dejanos tus datos y te lo llevamos a tu casa.
              </Dialog.Description>
            </div>
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

          {listo ? (
            <div className="px-5 py-9 text-center">
              <Check
                className="mx-auto h-8 w-8 text-accent"
                aria-hidden="true"
              />
              <p className="mt-3 font-serif text-[1rem] text-ink">
                {listo === "nuevo"
                  ? "Listo, quedaste anotado."
                  : "Actualizamos tus datos."}
              </p>
              <p className="mt-1.5 font-sans text-[0.78rem] text-ink-3">
                El próximo número va a {datos.direccion}.
              </p>
            </div>
          ) : (
            <form onSubmit={enviar} className="space-y-4 px-5 py-5">
              <label className="block">
                <span className={etiqueta}>Correo</span>
                <input
                  type="email"
                  required
                  value={datos.email}
                  onChange={(e) => editar("email", e.target.value)}
                  className={cn(campo, "mt-1.5")}
                  placeholder="vos@ejemplo.com"
                />
              </label>

              <label className="block">
                <span className={etiqueta}>Dirección</span>
                <input
                  required
                  value={datos.direccion}
                  onChange={(e) => editar("direccion", e.target.value)}
                  className={cn(campo, "mt-1.5")}
                  placeholder="Calle, número, piso y barrio"
                />
                <span className="mt-1 block font-sans text-[0.72rem] text-ink-3">
                  Es a dónde se lleva el diario.
                </span>
              </label>

              {/* Los dos que va a traer Cidituc. */}
              <div className="grid gap-4 sm:grid-cols-[1fr_6.5rem]">
                <label className="block">
                  <span className={etiqueta}>Nombre</span>
                  <input
                    required
                    value={datos.nombre}
                    onChange={(e) => editar("nombre", e.target.value)}
                    className={cn(campo, "mt-1.5")}
                    placeholder="Nombre y apellido"
                  />
                </label>
                <label className="block">
                  <span className={etiqueta}>Edad</span>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={datos.edad}
                    onChange={(e) => editar("edad", e.target.value)}
                    className={cn(campo, "mt-1.5")}
                    placeholder="—"
                  />
                </label>
              </div>

              {error && (
                <p
                  role="alert"
                  className="border border-red-300 bg-red-50 px-3 py-2 font-sans text-[0.8rem] text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
                >
                  {error}
                </p>
              )}

              <div className="flex items-center justify-between gap-4 border-t border-hairline pt-4">
                <p className="font-sans text-[0.7rem] leading-relaxed text-ink-3">
                  Tus datos los usa la Municipalidad sólo para llevarte el
                  diario.
                </p>
                <button
                  type="submit"
                  disabled={enviando}
                  className="pressable shrink-0 bg-accent px-4 py-2 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-accent-contrast hover:bg-accent-strong disabled:opacity-50"
                >
                  {enviando ? "Guardando…" : "Anotarme"}
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
