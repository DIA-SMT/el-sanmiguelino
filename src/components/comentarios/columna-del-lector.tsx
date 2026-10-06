"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LogIn,
  MessageSquare,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { rutaDeIngreso } from "@/lib/auth/destino";
import { guardarBorrador, olvidarBorrador, sacarBorrador } from "@/lib/borradores";
import type { ComentarioPublico } from "@/lib/types";
import { cn, tiempoRelativo } from "@/lib/utils";

async function fetchComentarios(notaSlug: string): Promise<ComentarioPublico[]> {
  const res = await fetch(`/api/comentarios?nota=${encodeURIComponent(notaSlug)}`);
  if (!res.ok) throw new Error("No se pudieron cargar los comentarios");
  const data: { comentarios: ComentarioPublico[] } = await res.json();
  return data.comentarios;
}

type Estado =
  | { fase: "cargando" }
  | { fase: "error" }
  | { fase: "listo"; comentarios: ComentarioPublico[] };

type FalloPublicar = "red" | "sesion" | "bloqueado";

/**
 * Los comentarios de la nota.
 *
 * Leerlos es libre, como leer la nota. Opinar y votar piden ingresar con
 * Ciudadano Digital: sin sesión, en lugar del formulario va una invitación, y
 * tocar un voto la muestra al lado del comentario. El enlace vuelve a esta
 * misma columna (`#columna-lector`) después de pasar por Cidituc.
 *
 * Las firmas son públicas y abreviadas —"Alfredo B."—, también la propia en
 * "Firmás como": lo que ve quien escribe es lo que va a ver el resto.
 */
export function ColumnaDelLector({
  notaSlug,
  firma,
}: {
  notaSlug: string;
  /** La firma de quien mira, ya abreviada; null sin sesión. Sólo el texto:
   *  este componente es de cliente y lo que recibe viaja en el HTML. */
  firma: string | null;
}) {
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });
  const [texto, setTexto] = useState("");
  const [publicando, setPublicando] = useState(false);
  const [fallo, setFallo] = useState<FalloPublicar | null>(null);
  /** El comentario junto al que se explica por qué no se pudo votar: falta
   *  ingresar, o la cuenta está bloqueada. */
  const [avisoVoto, setAvisoVoto] = useState<{
    id: string;
    motivo: "ingreso" | "bloqueado";
  } | null>(null);
  /** Lo que se anuncia al lector de pantalla. La región está SIEMPRE montada
   *  (ver abajo): una que aparece ya con su texto adentro muchas veces no se
   *  anuncia, y quien vota sin ver la pantalla tocaba el botón y no escuchaba
   *  nada. */
  const [anuncio, setAnuncio] = useState("");

  const ingreso = rutaDeIngreso(`/nota/${notaSlug}#columna-lector`);

  function avisarVoto(id: string, motivo: "ingreso" | "bloqueado") {
    setAvisoVoto({ id, motivo });
    // Vaciar y volver a escribir: así un segundo toque se anuncia de nuevo.
    setAnuncio("");
    setTimeout(() =>
      setAnuncio(
        motivo === "bloqueado"
          ? "Tu cuenta no puede votar en el diario."
          : "Para votar, ingresá con Ciudadano Digital. El enlace quedó debajo del comentario.",
      ),
    );
  }

  /* Al volver del ingreso con `#columna-lector`, bajar hasta acá. El ancla del
     navegador no alcanza: la nota llega por partes, y cuando el navegador la
     busca la columna todavía no se reveló. Cuando esto corre, ya está. */
  useEffect(() => {
    if (window.location.hash === "#columna-lector") {
      document.getElementById("columna-lector")?.scrollIntoView();
    }
  }, []);

  useEffect(() => {
    let activo = true;
    fetchComentarios(notaSlug)
      .then((comentarios) => {
        if (!activo) return;
        setEstado({ fase: "listo", comentarios });
        /* Al volver del ingreso, el texto que había quedado guardado. Va acá,
           cuando el formulario ya se puede usar, y no en el estado inicial:
           sessionStorage no existe en el servidor, y leerlo al dibujar daría
           un HTML distinto del de la hidratación. */
        if (firma) {
          const borrador = sacarBorrador(notaSlug, firma);
          if (borrador) setTexto((actual) => actual || borrador);
        }
      })
      .catch(() => {
        if (activo) setEstado({ fase: "error" });
      });
    return () => {
      activo = false;
    };
  }, [notaSlug, firma]);

  function reintentar() {
    setEstado({ fase: "cargando" });
    fetchComentarios(notaSlug)
      .then((comentarios) => setEstado({ fase: "listo", comentarios }))
      .catch(() => setEstado({ fase: "error" }));
  }

  async function publicar(e: React.FormEvent) {
    e.preventDefault();
    const limpio = texto.trim();
    if (!firma || !limpio || publicando || estado.fase !== "listo") return;
    setPublicando(true);
    setFallo(null);

    // Optimistic UI: se muestra ya mismo y se confirma con el server
    const optimista: ComentarioPublico = {
      id: `optimista-${Date.now()}`,
      notaSlug,
      autor: firma,
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
      if (res.status === 401 || res.status === 403) {
        setEstado({ fase: "listo", comentarios: previos });
        setTexto(limpio);
        if (res.status === 401) guardarBorrador(notaSlug, firma, limpio);
        setFallo(res.status === 401 ? "sesion" : "bloqueado");
        return;
      }
      if (!res.ok) throw new Error();
      const data: { comentario: ComentarioPublico } = await res.json();
      setEstado({ fase: "listo", comentarios: [data.comentario, ...previos] });
      // Si este texto había quedado guardado de un intento anterior, ya salió:
      // no tiene que volver a aparecer en el formulario.
      olvidarBorrador(notaSlug);
    } catch {
      setEstado({ fase: "listo", comentarios: previos });
      setTexto(limpio);
      setFallo("red");
    } finally {
      setPublicando(false);
    }
  }

  async function votar(comentario: ComentarioPublico, valor: 1 | -1) {
    if (estado.fase !== "listo") return;
    if (!firma) {
      avisarVoto(comentario.id, "ingreso");
      return;
    }
    // Toggle mutuamente excluyente: repetir el voto lo quita
    const objetivo: 1 | -1 | null = comentario.miVoto === valor ? null : valor;

    const aplicar = (c: ComentarioPublico): ComentarioPublico => {
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
      if (res.status === 401 || res.status === 403) {
        // Se le venció la sesión —lo mismo que a quien nunca ingresó— o la
        // cuenta está bloqueada. Antes el voto subía y bajaba sin explicar.
        setEstado({ fase: "listo", comentarios: previos });
        avisarVoto(comentario.id, res.status === 401 ? "ingreso" : "bloqueado");
        return;
      }
      if (!res.ok) throw new Error();
      const data: { comentario: ComentarioPublico } = await res.json();
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
      <p role="status" aria-live="polite" className="sr-only">
        {anuncio}
      </p>
      <div className="rule-double mb-7 py-2.5 text-center">
        <h2
          id="columna-lector"
          className="volanta text-ink"
        >
          Columna del lector
        </h2>
      </div>

      {firma ? (
        /* Sumá tu opinión */
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
            <strong className="not-italic text-ink">{firma}</strong>
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
            {fallo ? (
              <p role="alert" className="font-sans text-xs text-red-700 dark:text-red-400">
                {fallo === "sesion" ? (
                  <>
                    Tu sesión venció. Tu texto quedó guardado:{" "}
                    <Link href={ingreso} className="underline">
                      ingresá de nuevo
                    </Link>{" "}
                    y publicalo.
                  </>
                ) : fallo === "bloqueado" ? (
                  "Tu cuenta no puede comentar en el diario."
                ) : (
                  "No se pudo publicar. Tu texto quedó guardado, probá de nuevo."
                )}
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
      ) : (
        <div className="border border-line bg-paper-2 p-5 text-center">
          <p className="volanta text-ink">Sumá tu opinión</p>
          <p className="mx-auto mt-2 max-w-md text-pretty font-serif text-[0.95rem] leading-relaxed text-ink-2">
            Para opinar y votar, ingresá con tu cuenta de Ciudadano Digital.
            Leer las notas y los comentarios no lo pide.
          </p>
          <Link
            href={ingreso}
            className="pressable mt-4 inline-flex items-center gap-2 bg-ink px-5 py-2.5 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-paper hover:bg-accent hover:text-accent-contrast"
          >
            <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
            Ingresar para opinar
          </Link>
        </div>
      )}

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
                      va en TODAS las firmas por igual. La firma ya viene
                      abreviada y normalizada del servidor. */}
                  <span className="font-semibold uppercase tracking-[0.1em] text-ink">
                    {c.autor}
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
                {/* Sin role=status: lo anuncia la región de arriba, y con
                    las dos se leería dos veces. */}
                {avisoVoto?.id === c.id && (
                  <p className="mt-2.5 font-sans text-[0.72rem] text-ink-2">
                    {avisoVoto.motivo === "bloqueado" ? (
                      "Tu cuenta no puede votar en el diario."
                    ) : (
                      <>
                        Para votar,{" "}
                        <Link href={ingreso} className="enlace font-medium">
                          ingresá con Ciudadano Digital
                        </Link>
                        .
                      </>
                    )}
                  </p>
                )}
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
