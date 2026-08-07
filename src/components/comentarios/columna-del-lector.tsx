"use client";

import { useEffect, useState } from "react";
import { MessageSquare, RefreshCw, ThumbsDown, ThumbsUp } from "lucide-react";
import type { Comentario, Usuario } from "@/lib/types";
import { cn, tiempoRelativo } from "@/lib/utils";

async function fetchComentarios(notaSlug: string): Promise<Comentario[]> {
  const res = await fetch(`/api/comentarios?nota=${encodeURIComponent(notaSlug)}`);
  if (!res.ok) throw new Error("No se pudieron cargar los comentarios");
  const data: { comentarios: Comentario[] } = await res.json();
  return data.comentarios;
}

type Estado =
  | { fase: "cargando" }
  | { fase: "error" }
  | { fase: "listo"; comentarios: Comentario[] };

export function ColumnaDelLector({
  notaSlug,
  usuario,
}: {
  notaSlug: string;
  usuario: Usuario;
}) {
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });
  const [texto, setTexto] = useState("");
  const [publicando, setPublicando] = useState(false);
  const [errorPublicar, setErrorPublicar] = useState(false);

  useEffect(() => {
    let activo = true;
    fetchComentarios(notaSlug)
      .then((comentarios) => {
        if (activo) setEstado({ fase: "listo", comentarios });
      })
      .catch(() => {
        if (activo) setEstado({ fase: "error" });
      });
    return () => {
      activo = false;
    };
  }, [notaSlug]);

  function reintentar() {
    setEstado({ fase: "cargando" });
    fetchComentarios(notaSlug)
      .then((comentarios) => setEstado({ fase: "listo", comentarios }))
      .catch(() => setEstado({ fase: "error" }));
  }

  async function publicar(e: React.FormEvent) {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio || publicando || estado.fase !== "listo") return;
    setPublicando(true);
    setErrorPublicar(false);

    // Optimistic UI: se muestra ya mismo y se confirma con el server
    const optimista: Comentario = {
      id: `optimista-${Date.now()}`,
      notaSlug,
      usuarioId: usuario.id,
      usuarioNombre: usuario.nombre,
      texto: limpio,
      fecha: new Date().toISOString(),
      likes: 0,
      dislikes: 0,
      miVoto: null,
    };
    const previos = estado.comentarios;
    setEstado({ fase: "listo", comentarios: [optimista, ...previos] });
    setTexto("");

    try {
      const res = await fetch("/api/comentarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notaSlug, texto: limpio }),
      });
      if (!res.ok) throw new Error();
      const data: { comentario: Comentario } = await res.json();
      setEstado({ fase: "listo", comentarios: [data.comentario, ...previos] });
    } catch {
      setEstado({ fase: "listo", comentarios: previos });
      setTexto(limpio);
      setErrorPublicar(true);
    } finally {
      setPublicando(false);
    }
  }

  async function votar(comentario: Comentario, valor: 1 | -1) {
    if (estado.fase !== "listo") return;
    // Toggle mutuamente excluyente: repetir el voto lo quita
    const objetivo: 1 | -1 | null = comentario.miVoto === valor ? null : valor;

    const aplicar = (c: Comentario): Comentario => {
      if (c.id !== comentario.id) return c;
      let { likes, dislikes } = c;
      if (c.miVoto === 1) likes--;
      if (c.miVoto === -1) dislikes--;
      if (objetivo === 1) likes++;
      if (objetivo === -1) dislikes++;
      return { ...c, likes, dislikes, miVoto: objetivo };
    };

    const previos = estado.comentarios;
    setEstado({ fase: "listo", comentarios: previos.map(aplicar) });

    try {
      const res = await fetch(`/api/comentarios/${comentario.id}/voto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor: objetivo }),
      });
      if (!res.ok) throw new Error();
      const data: { comentario: Comentario } = await res.json();
      setEstado((actual) =>
        actual.fase === "listo"
          ? {
              fase: "listo",
              comentarios: actual.comentarios.map((c) =>
                c.id === data.comentario.id ? data.comentario : c,
              ),
            }
          : actual,
      );
    } catch {
      // Revertir si falló
      setEstado({ fase: "listo", comentarios: previos });
    }
  }

  return (
    <section aria-labelledby="columna-lector" className="mx-auto mt-14 max-w-3xl">
      <h2
        id="columna-lector"
        className="rule-double mb-6 py-2 text-center font-sans text-sm font-bold uppercase tracking-[0.2em] text-ink"
      >
        Columna del lector
      </h2>

      {/* Sumá tu opinión */}
      <form onSubmit={publicar} className="rounded-lg border border-line bg-chrome p-4">
        <label
          htmlFor="nueva-opinion"
          className="font-sans text-sm font-semibold text-ink"
        >
          Sumá tu opinión
        </label>
        <p className="mt-0.5 font-sans text-xs text-ink-2">
          Firmás como <strong className="text-ink">{usuario.nombre}</strong>
        </p>
        <textarea
          id="nueva-opinion"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="¿Qué te pareció esta nota?"
          className="mt-3 w-full resize-y rounded-md border border-line bg-paper px-3 py-2 font-serif text-sm text-ink placeholder:text-ink-2/70"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          {errorPublicar ? (
            <p role="alert" className="font-sans text-xs text-red-700 dark:text-red-400">
              No se pudo publicar. Tu texto quedó guardado, probá de nuevo.
            </p>
          ) : (
            <span className="font-sans text-xs tabular-nums text-ink-2">
              {texto.length}/1000
            </span>
          )}
          <button
            type="submit"
            disabled={publicando || texto.trim() === ""}
            className="pressable rounded-md bg-accent px-4 py-2 font-sans text-sm font-semibold text-accent-contrast transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            {publicando ? "Publicando…" : "Publicar"}
          </button>
        </div>
      </form>

      {/* Lista */}
      <div className="mt-6">
        {estado.fase === "cargando" && (
          <div className="space-y-4" aria-hidden="true">
            {[0, 1].map((i) => (
              <div key={i} className="animate-pulse rounded-lg border border-line bg-chrome p-4">
                <div className="h-3 w-32 rounded bg-line" />
                <div className="mt-3 h-3 w-full rounded bg-line" />
                <div className="mt-2 h-3 w-2/3 rounded bg-line" />
              </div>
            ))}
            <p className="sr-only" role="status">
              Cargando comentarios
            </p>
          </div>
        )}

        {estado.fase === "error" && (
          <div className="rounded-lg border border-line bg-chrome p-6 text-center">
            <p className="font-sans text-sm text-ink-2">
              No pudimos cargar los comentarios.
            </p>
            <button
              type="button"
              onClick={reintentar}
              className="pressable mt-3 inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 font-sans text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Reintentar
            </button>
          </div>
        )}

        {estado.fase === "listo" && estado.comentarios.length === 0 && (
          <div className="rounded-lg border border-dashed border-line p-8 text-center">
            <MessageSquare className="mx-auto h-6 w-6 text-ink-2" aria-hidden="true" />
            <p className="mt-2 font-sans text-sm text-ink-2">
              Todavía no hay opiniones sobre esta nota. ¡Sé la primera persona en
              comentar!
            </p>
          </div>
        )}

        {estado.fase === "listo" && estado.comentarios.length > 0 && (
          <ul className="space-y-4">
            {estado.comentarios.map((c) => (
              <li key={c.id} className="rounded-lg border border-line bg-chrome p-4">
                <p className="font-sans text-sm">
                  <span className="font-semibold text-ink">{c.usuarioNombre}</span>{" "}
                  <span className="text-ink-2">· {tiempoRelativo(c.fecha)}</span>
                </p>
                <p className="mt-2 font-serif text-[0.95rem] leading-relaxed text-ink">
                  {c.texto}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <BotonVoto
                    tipo="like"
                    activo={c.miVoto === 1}
                    cantidad={c.likes}
                    onClick={() => votar(c, 1)}
                  />
                  <BotonVoto
                    tipo="dislike"
                    activo={c.miVoto === -1}
                    cantidad={c.dislikes}
                    onClick={() => votar(c, -1)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function BotonVoto({
  tipo,
  activo,
  cantidad,
  onClick,
}: {
  tipo: "like" | "dislike";
  activo: boolean;
  cantidad: number;
  onClick: () => void;
}) {
  const Icono = tipo === "like" ? ThumbsUp : ThumbsDown;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      aria-label={tipo === "like" ? "Me gusta este comentario" : "No me gusta este comentario"}
      className={cn(
        "pressable inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-sans text-xs font-medium transition-colors",
        activo
          ? "border-accent bg-accent text-accent-contrast"
          : "border-line bg-paper text-ink-2 hover:border-accent hover:text-accent",
      )}
    >
      <Icono className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="tabular-nums">{cantidad}</span>
    </button>
  );
}
