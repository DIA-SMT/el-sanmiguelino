"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { guardarNotaAction } from "@/app/admin/acciones";
import type { BloqueNota, NotaCompleta } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Editor de una nota.
 *
 * El cuerpo se edita como una **lista de bloques tipados**, no como un campo
 * de texto rico. Es a propósito: el diario tiene cinco formas —párrafo,
 * subtítulo, cita, destacado y ficha— y cada una se maqueta distinto en la
 * hoja. Un editor de texto libre obligaría a adivinar cuál es cuál al
 * renderizar, y a la primera nota pegada desde Word el diario se llena de
 * negritas y tamaños que no existen en el sistema.
 *
 * Los bloques se mueven con botones y no arrastrando. No es pereza: la WCAG
 * 2.2 (SC 2.5.7) exige que todo lo que se hace arrastrando se pueda hacer con
 * un solo puntero, así que el arrastre sería trabajo extra sobre esto mismo,
 * no en lugar de esto.
 */

const TIPOS: { valor: BloqueNota["tipo"]; nombre: string; ayuda: string }[] = [
  { valor: "parrafo", nombre: "Párrafo", ayuda: "Texto corrido de la nota." },
  {
    valor: "subtitulo",
    nombre: "Subtítulo",
    ayuda: "Corta la nota en secciones.",
  },
  {
    valor: "cita",
    nombre: "Cita",
    ayuda: "Lo que dijo alguien, con su nombre y cargo.",
  },
  {
    valor: "destacado",
    nombre: "Destacado",
    ayuda: "Una frase de la propia nota, subrayada. Sin autor.",
  },
  {
    valor: "ficha",
    nombre: "Ficha de datos",
    ayuda: "Recuadro con entradas, para consultar y no para leer de corrido.",
  },
];

function bloqueVacio(tipo: BloqueNota["tipo"]): BloqueNota {
  switch (tipo) {
    case "cita":
      return { tipo: "cita", texto: "", autor: "" };
    case "ficha":
      return { tipo: "ficha", titulo: "", entradas: [{ lead: "", texto: "" }] };
    default:
      return { tipo, texto: "" };
  }
}

const campo =
  "w-full border border-line bg-chrome px-3 py-2 font-sans text-[0.88rem] text-ink transition-colors placeholder:text-ink-3 focus:border-accent focus:outline-none";
const etiqueta =
  "block font-sans text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-2";

export function EditorNota({
  nota,
  secciones,
}: {
  /** La nota a editar, o null para una nota nueva. */
  nota: NotaCompleta | null;
  /** Las secciones que ya existen en la edición, para no inventar nombres
   *  nuevos por un error de tipeo. Igual se puede escribir una. */
  secciones: string[];
}) {
  const router = useRouter();
  const [guardando, iniciarGuardado] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  const slugOriginal = nota?.slug;
  const [slug, setSlug] = useState(nota?.slug ?? "");
  const [seccion, setSeccion] = useState(nota?.seccion ?? "");
  const [titulo, setTitulo] = useState(nota?.titulo ?? "");
  const [bajada, setBajada] = useState(nota?.bajada ?? "");
  const [imagenSrc, setImagenSrc] = useState(nota?.imagen?.src ?? "");
  const [imagenAlt, setImagenAlt] = useState(nota?.imagen?.alt ?? "");
  const [imagenEpigrafe, setImagenEpigrafe] = useState(
    nota?.imagen?.epigrafe ?? "",
  );
  const [cuerpo, setCuerpo] = useState<BloqueNota[]>(
    nota?.cuerpo ?? [{ tipo: "parrafo", texto: "" }],
  );

  function editarBloque(i: number, cambios: Partial<BloqueNota>) {
    setCuerpo((prev) =>
      prev.map((b, k) => (k === i ? ({ ...b, ...cambios } as BloqueNota) : b)),
    );
  }

  function mover(i: number, delta: number) {
    const destino = i + delta;
    if (destino < 0 || destino >= cuerpo.length) return;
    setCuerpo((prev) => {
      const copia = [...prev];
      [copia[i], copia[destino]] = [copia[destino], copia[i]];
      return copia;
    });
  }

  function guardar() {
    setError(null);
    setGuardado(false);
    iniciarGuardado(async () => {
      const res = await guardarNotaAction({
        slug,
        slugOriginal,
        seccion,
        titulo,
        bajada,
        cuerpo,
        imagen: imagenAlt.trim()
          ? { src: imagenSrc, alt: imagenAlt, epigrafe: imagenEpigrafe }
          : undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "No se pudo guardar.");
        return;
      }
      setGuardado(true);
      // Si el slug cambió, la URL del editor apunta a una nota que ya no
      // existe con ese nombre; hay que llevar al usuario a la nueva.
      if (res.slug && res.slug !== slugOriginal) {
        router.replace(`/admin/nota/${res.slug}`);
      }
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
      className="pb-24"
    >
      <section className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={etiqueta}>Título</span>
          <textarea
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            rows={2}
            className={cn(campo, "mt-1.5 resize-y font-semibold")}
            placeholder="El titular tal como va en la tapa"
          />
        </label>

        <label className="sm:col-span-2">
          <span className={etiqueta}>Bajada</span>
          <textarea
            value={bajada}
            onChange={(e) => setBajada(e.target.value)}
            rows={3}
            className={cn(campo, "mt-1.5 resize-y")}
            placeholder="Las dos o tres líneas que resumen la nota"
          />
        </label>

        <label>
          <span className={etiqueta}>Sección</span>
          <input
            list="secciones-existentes"
            value={seccion}
            onChange={(e) => setSeccion(e.target.value)}
            className={cn(campo, "mt-1.5")}
            placeholder="Cultura"
          />
          <datalist id="secciones-existentes">
            {secciones.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>

        <label>
          <span className={etiqueta}>Slug (la dirección de la nota)</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={cn(campo, "mt-1.5 font-mono text-[0.8rem]")}
            placeholder="plan-bacheo-integral"
          />
          <span className="mt-1 block font-sans text-[0.7rem] text-ink-3">
            Sólo minúsculas, números y guiones. Si lo cambiás, los comentarios
            de la nota lo siguen.
          </span>
        </label>
      </section>

      <section className="mt-8 border-t border-hairline pt-6">
        <h2 className="font-sans text-[0.8rem] font-bold uppercase tracking-[0.14em] text-ink">
          Foto
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label>
            <span className={etiqueta}>Archivo</span>
            <input
              value={imagenSrc}
              onChange={(e) => setImagenSrc(e.target.value)}
              className={cn(campo, "mt-1.5 font-mono text-[0.8rem]")}
              placeholder="/notas/plaza-independencia.webp"
            />
            <span className="mt-1 block font-sans text-[0.7rem] text-ink-3">
              Por ahora la ruta de un archivo ya subido. La carga desde el panel
              llega con el Storage.
            </span>
          </label>
          <label>
            <span className={etiqueta}>Texto alternativo</span>
            <input
              value={imagenAlt}
              onChange={(e) => setImagenAlt(e.target.value)}
              className={cn(campo, "mt-1.5")}
              placeholder="Qué se ve en la foto, para quien no puede verla"
            />
            <span className="mt-1 block font-sans text-[0.7rem] text-ink-3">
              Sin esto no hay foto: es lo que lee un lector de pantalla.
            </span>
          </label>
          <label className="sm:col-span-2">
            <span className={etiqueta}>Epígrafe</span>
            <input
              value={imagenEpigrafe}
              onChange={(e) => setImagenEpigrafe(e.target.value)}
              className={cn(campo, "mt-1.5")}
              placeholder="La línea que va debajo de la foto, a la vista de todos"
            />
          </label>
        </div>
      </section>

      <section className="mt-8 border-t border-hairline pt-6">
        <h2 className="font-sans text-[0.8rem] font-bold uppercase tracking-[0.14em] text-ink">
          Cuerpo · {cuerpo.length} bloques
        </h2>

        <ol className="mt-4 space-y-3">
          {cuerpo.map((bloque, i) => (
            <li
              key={i}
              className="border border-line bg-paper-2 px-4 py-3.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2">
                  <span className="font-sans text-[0.7rem] tabular-nums text-ink-3">
                    {i + 1}
                  </span>
                  <select
                    value={bloque.tipo}
                    onChange={(e) =>
                      setCuerpo((prev) =>
                        prev.map((b, k) =>
                          k === i
                            ? bloqueVacio(
                                e.target.value as BloqueNota["tipo"],
                              )
                            : b,
                        ),
                      )
                    }
                    className="border border-line bg-chrome px-2 py-1 font-sans text-[0.75rem] font-semibold text-ink"
                  >
                    {TIPOS.map((t) => (
                      <option key={t.valor} value={t.valor}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-center gap-1">
                  <BotonIcono
                    titulo="Subir"
                    onClick={() => mover(i, -1)}
                    disabled={i === 0}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </BotonIcono>
                  <BotonIcono
                    titulo="Bajar"
                    onClick={() => mover(i, 1)}
                    disabled={i === cuerpo.length - 1}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </BotonIcono>
                  <BotonIcono
                    titulo="Eliminar bloque"
                    onClick={() =>
                      setCuerpo((prev) => prev.filter((_, k) => k !== i))
                    }
                    disabled={cuerpo.length === 1}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </BotonIcono>
                </div>
              </div>

              <p className="mt-1.5 font-sans text-[0.7rem] text-ink-3">
                {TIPOS.find((t) => t.valor === bloque.tipo)?.ayuda}
              </p>

              <CamposBloque
                bloque={bloque}
                onCambio={(c) => editarBloque(i, c)}
              />
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={() =>
            setCuerpo((prev) => [...prev, { tipo: "parrafo", texto: "" }])
          }
          className="pressable mt-4 inline-flex items-center gap-2 border border-ink px-4 py-2 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink hover:bg-ink hover:text-paper"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Agregar bloque
        </button>
      </section>

      {/* La barra de guardar queda fija: el cuerpo de una nota es largo y no
          se debería tener que volver arriba para grabar. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink bg-chrome/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p
            role="status"
            aria-live="polite"
            className="min-w-0 flex-1 font-sans text-[0.78rem]"
          >
            {error ? (
              <span className="inline-flex items-start gap-2 text-red-700 dark:text-red-400">
                <TriangleAlert
                  className="mt-[0.15em] h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                {error}
              </span>
            ) : guardado ? (
              <span className="inline-flex items-center gap-2 text-ink-2">
                <Check className="h-4 w-4 text-accent" aria-hidden="true" />
                Guardado. Ya está en el diario.
              </span>
            ) : (
              <span className="text-ink-3">
                Los cambios se publican al guardar: no hay borradores todavía.
              </span>
            )}
          </p>
          <button
            type="submit"
            disabled={guardando}
            className="pressable inline-flex shrink-0 items-center gap-2 bg-accent px-6 py-2.5 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-accent-contrast hover:bg-accent-strong disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </form>
  );
}

function BotonIcono({
  titulo,
  onClick,
  disabled,
  children,
}: {
  titulo: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={titulo}
      title={titulo}
      className="pressable flex h-7 w-7 items-center justify-center border border-line text-ink-2 hover:border-ink hover:text-ink disabled:opacity-30 disabled:hover:border-line"
    >
      {children}
    </button>
  );
}

/** Los campos que cambian según el tipo. Vive aparte para que el `switch` esté
 *  en un solo lugar y no repartido por el render. */
function CamposBloque({
  bloque,
  onCambio,
}: {
  bloque: BloqueNota;
  onCambio: (cambios: Partial<BloqueNota>) => void;
}) {
  if (bloque.tipo === "ficha") {
    return (
      <div className="mt-3 space-y-3">
        <input
          value={bloque.titulo}
          onChange={(e) => onCambio({ titulo: e.target.value })}
          className={cn(campo, "font-semibold")}
          placeholder="Título del recuadro"
        />
        {bloque.entradas.map((entrada, j) => (
          <div key={j} className="border-l-2 border-line pl-3">
            <div className="flex items-center gap-2">
              <input
                value={entrada.lead}
                onChange={(e) =>
                  onCambio({
                    entradas: bloque.entradas.map((x, k) =>
                      k === j ? { ...x, lead: e.target.value } : x,
                    ),
                  })
                }
                className={cn(campo, "font-semibold")}
                placeholder="Encabezado de la entrada"
              />
              <button
                type="button"
                aria-label={`Quitar la entrada ${j + 1}`}
                onClick={() =>
                  onCambio({
                    entradas: bloque.entradas.filter((_, k) => k !== j),
                  })
                }
                disabled={bloque.entradas.length === 1}
                className="pressable flex h-8 w-8 shrink-0 items-center justify-center border border-line text-ink-2 hover:border-ink disabled:opacity-30"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <textarea
              value={entrada.texto}
              onChange={(e) =>
                onCambio({
                  entradas: bloque.entradas.map((x, k) =>
                    k === j ? { ...x, texto: e.target.value } : x,
                  ),
                })
              }
              rows={2}
              className={cn(campo, "mt-1.5 resize-y")}
              placeholder="El dato"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            onCambio({ entradas: [...bloque.entradas, { lead: "", texto: "" }] })
          }
          className="pressable inline-flex items-center gap-1.5 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-accent hover:text-accent-strong"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          Agregar entrada
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <textarea
        value={bloque.texto}
        onChange={(e) => onCambio({ texto: e.target.value })}
        rows={bloque.tipo === "subtitulo" ? 1 : 4}
        className={cn(campo, "resize-y")}
        placeholder={
          bloque.tipo === "cita"
            ? "Lo que dijo, entre comillas no: las pone el diario"
            : bloque.tipo === "subtitulo"
              ? "El subtítulo"
              : "El texto"
        }
      />
      {bloque.tipo === "cita" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={bloque.autor}
            onChange={(e) => onCambio({ autor: e.target.value })}
            className={campo}
            placeholder="Quién lo dijo"
          />
          <input
            value={bloque.cargo ?? ""}
            onChange={(e) => onCambio({ cargo: e.target.value })}
            className={campo}
            placeholder="Su cargo (opcional)"
          />
        </div>
      )}
    </div>
  );
}
