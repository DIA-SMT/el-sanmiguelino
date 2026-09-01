"use client";

import { useEffect, useState } from "react";
import { MessageSquare, RefreshCw, ThumbsDown, ThumbsUp } from "lucide-react";
import { nombreDeDiario } from "@/lib/auth/cidituc/nombre";
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
      estado: "publicado",
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
    <section aria-labelledby="columna-lector" className="mx-auto mt-16 max-w-3xl">
      <div className="rule-double mb-7 py-2.5 text-center">
        <h2
          id="columna-lector"
          className="volanta text-ink"
        >
          Columna del lector
        </h2>
      </div>

      {/* Sumá tu opinión */}
      <form
        onSubmit={publicar}
        className="border border-line bg-paper-2 p-5"
      >
        <label
          htmlFor="nueva-opinion"
          className="volanta block text-ink"
        >
          Sumá tu opinión
        </label>
        <p className="mt-1.5 font-serif text-[0.85rem] italic text-ink-3">
          Firmás como{" "}
          <strong className="not-italic text-ink">
            {nombreDeDiario(usuario.nombre)}
          </strong>
        </p>
        <textarea
          id="nueva-opinion"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="¿Qué te pareció esta nota?"
          className="mt-3.5 w-full resize-y border border-line bg-chrome px-3.5 py-2.5 font-serif text-[0.95rem] leading-relaxed text-ink transition-colors placeholder:italic placeholder:text-ink-3 focus:border-accent"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          {errorPublicar ? (
            <p role="alert" className="font-sans text-xs text-red-700 dark:text-red-400">
              No se pudo publicar. Tu texto quedó guardado, probá de nuevo.
            </p>
          ) : (
            <span className="font-sans text-[0.7rem] tabular-nums text-ink-3">
              {texto.length}/1000
            </span>
          )}
          <button
            type="submit"
            disabled={publicando || texto.trim() === ""}
            className="pressable bg-ink px-5 py-2.5 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-paper hover:bg-accent hover:text-accent-contrast disabled:opacity-40 disabled:hover:bg-ink disabled:hover:text-paper"
          >
            {publicando ? "Publicando…" : "Publicar"}
          </button>
        </div>
      </form>

      {/* Lista */}
      <div className="mt-7">
        {estado.fase === "cargando" && (
          <div className="divide-y divide-hairline" aria-hidden="true">
            {[0, 1].map((i) => (
              <div key={i} className="animate-pulse py-5">
                <div className="h-3 w-32 bg-line" />
                <div className="mt-3.5 h-3 w-full bg-line" />
                <div className="mt-2 h-3 w-2/3 bg-line" />
              </div>
            ))}
            <p className="sr-only" role="status">
              Cargando comentarios
            </p>
          </div>
        )}

        {estado.fase === "error" && (
          <div className="border border-line bg-paper-2 p-7 text-center">
            <p className="font-serif text-[0.95rem] italic text-ink-2">
              No pudimos cargar los comentarios.
            </p>
            <button
              type="button"
              onClick={reintentar}
              className="pressable mt-4 inline-flex items-center gap-2 border border-line bg-chrome px-4 py-2 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink hover:border-ink hover:bg-paper"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Reintentar
            </button>
          </div>
        )}

        {estado.fase === "listo" && estado.comentarios.length === 0 && (
          <div className="border border-dashed border-line p-9 text-center">
            <MessageSquare className="mx-auto h-6 w-6 text-ink-3" aria-hidden="true" />
            <p className="mt-3 font-serif text-[0.95rem] italic leading-relaxed text-ink-2">
              Todavía no hay opiniones sobre esta nota. ¡Sé la primera persona en
              comentar!
            </p>
          </div>
        )}

        {estado.fase === "listo" && estado.comentarios.length > 0 && (
          <ul className="divide-y divide-hairline border-t border-hairline">
            {estado.comentarios.map((c) => (
              <li key={c.id} className="py-5">
                <p className="flex flex-wrap items-baseline gap-x-2 font-sans text-[0.72rem]">
                  {/* El `uppercase` es la versalita del diario, no un grito: es
                      la misma tipografía que usan las volantas y los folios, y
                      va en TODAS las firmas por igual. Lo que se normaliza es el
                      texto real —lo que lee un lector de pantalla, lo que se ve
                      en el panel y lo que quedó guardado antes de este cambio—,
                      no cómo lo pinta el CSS. */}
                  <span className="font-semibold uppercase tracking-[0.1em] text-ink">
                    {nombreDeDiario(c.usuarioNombre)}
                  </span>
                  <span className="text-ink-3">· {tiempoRelativo(c.fecha)}</span>
                </p>
                <p className="mt-2.5 font-serif text-[0.98rem] leading-[1.7] text-ink">
                  {c.texto}
                </p>
                <div className="mt-3.5 flex items-center gap-2">
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
        "pressable inline-flex items-center gap-1.5 border px-3 py-1.5 font-sans text-[0.7rem] font-medium",
        activo
          ? "border-accent bg-accent text-accent-contrast"
          : "border-line bg-chrome text-ink-3 hover:border-ink hover:text-ink",
      )}
    >
      <Icono className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="tabular-nums">{cantidad}</span>
    </button>
  );
}
