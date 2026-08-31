"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus } from "lucide-react";
import { guardarEdicionAction } from "@/app/admin/acciones";
import {
  Aviso,
  SeccionPanel,
  clasesDeBoton,
  clasesDeCampo,
} from "@/components/admin/piezas";
import { cn } from "@/lib/utils";

/* Sin versalitas ni tracking ancho: la etiqueta de un campo se lee, no se
   declama. Las versalitas son del diario. El tamaño es `text-panel-sm`, el
   paso de la escala que le toca a las etiquetas —y el mismo que usan las del
   formulario de la ficha de edición, que antes decía 0.75rem porque cada
   archivo eligió el suyo—. */
const etiqueta = "block font-sans text-panel-sm font-medium text-panel-tinta-2";

/**
 * Alta de la edición del mes que viene.
 *
 * La fecha es opcional a propósito: se puede crear septiembre hoy, cargarle las
 * notas durante tres semanas y recién al final ponerle la fecha. Sin fecha no
 * sale nunca sola, que es exactamente lo que uno quiere de una edición en
 * preparación.
 *
 * Cerrado es una tarjeta de borde punteado al final de la lista, y no un botón
 * sólido arriba de todo. El punteado dice lo que es: **un lugar vacío que
 * todavía no tiene edición**, en la fila donde va a aparecer la que se cree. Un
 * borde lleno ahí competiría con las ediciones de verdad, que sí existen.
 *
 * Los campos salen de `clasesDeCampo()` y no de una constante local: el mismo
 * input estaba escrito cinco veces en el panel con cinco fondos y cuatro
 * tamaños de letra, y el borde de todos era `--panel-borde` —1,23:1—, que en
 * un campo vacío es el único límite del control y no llega al 3:1 que pide
 * WCAG 1.4.11. La pieza usa `--panel-borde-campo`, que sí.
 */
export function NuevaEdicion({ siguienteNumero }: { siguienteNumero: number }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [enCurso, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mes, setMes] = useState("");
  const [slug, setSlug] = useState("");
  const [numero, setNumero] = useState(String(siguienteNumero));
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [publicaEn, setPublicaEn] = useState("");

  /* El formulario vive dentro de una `SeccionPanel`, o sea sobre la tarjeta
     blanca: los campos se hunden. */
  const campo = clasesDeCampo("tarjeta");

  function crear() {
    setError(null);
    iniciar(async () => {
      try {
        const res = await guardarEdicionAction({
          slug,
          mes,
          numero: Number(numero),
          anio: Number(anio),
          publicaEn,
          esNueva: true,
        });
        if (!res.ok) {
          setError(res.error ?? "No se pudo crear.");
          return;
        }
        setAbierto(false);
        setMes("");
        setSlug("");
        setPublicaEn("");
        router.refresh();
      } catch {
        setError("No se pudo hablar con el servidor.");
      }
    });
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="pressable flex w-full items-center justify-center gap-2 rounded-panel border border-dashed border-panel-borde bg-panel-tarjeta px-4 py-5 font-sans text-panel-sm font-semibold text-panel-tinta-2 hover:border-accent hover:bg-panel-wash hover:text-accent"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Edición nueva
      </button>
    );
  }

  return (
    <SeccionPanel
      id="edicion-nueva"
      titulo="Edición nueva"
      bajada="Se puede crear vacía y cargarle las notas durante semanas."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={etiqueta}>Mes</span>
          <input
            value={mes}
            onChange={(e) => {
              setMes(e.target.value);
              // El slug se propone solo desde el mes, y se puede corregir.
              if (!slug || slug === proponerSlug(mes)) {
                setSlug(proponerSlug(e.target.value));
              }
            }}
            className={cn(campo, "mt-1.5")}
            placeholder="Septiembre de 2026"
          />
        </label>
        <label>
          <span className={etiqueta}>Slug</span>
          {/* El slug es lo único que se escribe en monoespaciada: es una parte
              de la URL, no una frase. Va un paso más abajo en la escala
              porque una monoespaciada al mismo tamaño se ve más grande que la
              de al lado. */}
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={cn(campo, "mt-1.5 font-mono text-panel-sm")}
            placeholder="septiembre-2026"
          />
        </label>
        <label>
          <span className={etiqueta}>Número</span>
          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            inputMode="numeric"
            className={cn(campo, "mt-1.5")}
          />
        </label>
        <label>
          <span className={etiqueta}>Año</span>
          <input
            value={anio}
            onChange={(e) => setAnio(e.target.value)}
            inputMode="numeric"
            className={cn(campo, "mt-1.5")}
          />
        </label>
        <label className="sm:col-span-2">
          <span className={etiqueta}>Sale el (hora de Tucumán)</span>
          <input
            type="datetime-local"
            value={publicaEn}
            onChange={(e) => setPublicaEn(e.target.value)}
            className={cn(campo, "mt-1.5 w-auto")}
          />
          <span className="mt-1.5 block font-sans text-panel-sm text-panel-tinta-3">
            Se puede dejar vacía y ponerla después. Sin fecha, la edición no
            sale sola: es lo que permite prepararla con semanas de anticipación.
          </span>
        </label>
      </div>

      {error && (
        /* Mismo cartel que en la ficha de cada edición, y ahora literalmente el
           mismo: el rojo va en el filete y el icono, la palabra va en tinta del
           panel, así el aviso pasa AA en claro y en oscuro sin depender del
           rojo. `sobre="tarjeta"` porque apoya dentro de la sección. */
        <div className="mt-4">
          <Aviso
            icono={AlertTriangle}
            tono="var(--grafico-alerta)"
            sobre="tarjeta"
            rol="alert"
          >
            {error}
          </Aviso>
        </div>
      )}

      {/* Los dos botones del formulario, `normal` (36px): son la acción de una
          pantalla, no la que se repite en cada fila de una lista. Salían de una
          constante local `BOTON` a la que después se le pegaba el tono con
          `cn()`, que es justamente lo que se comía el `text-panel-sm` —para
          tailwind-merge sin configurar, `panel-sm` no es un talle, así que
          clasifica la clase como color de texto y la tira contra el color del
          tono—. Ahora el tono viene adentro de la pieza y no hay nada que
          fusionar. */}
      <div className="mt-4 flex flex-wrap items-center gap-panel-controles">
        <button
          type="button"
          onClick={crear}
          disabled={enCurso}
          className={clasesDeBoton({ tono: "primario" })}
        >
          {enCurso ? "Creando…" : "Crear edición"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className={clasesDeBoton({ tono: "fantasma" })}
        >
          Cancelar
        </button>
      </div>
    </SeccionPanel>
  );
}

function proponerSlug(mes: string): string {
  return mes
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\bde\b/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
