"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  EyeOff,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { moderarComentarioAction } from "@/app/admin/acciones";
import { nombreDeDiario } from "@/lib/auth/cidituc/nombre";
import {
  Aviso,
  Pildora,
  clasesDeBoton,
  clasesDeCampo,
} from "@/components/admin/piezas";
import { cn, tiempoRelativo } from "@/lib/utils";
import type { ComentarioModerable } from "@/lib/types";

/**
 * Un comentario en la pantalla de moderación.
 *
 * Dar de baja pide un motivo antes de ejecutar. No es burocracia: el motivo
 * queda guardado con el comentario junto a quién lo bajó y cuándo, y es lo
 * único que después permite explicarle a un vecino por qué su comentario no
 * está. Se puede dejar vacío —hay casos obvios— pero hay que pasar por el
 * paso, que es lo que convierte la baja en una decisión y no en un reflejo.
 *
 * Un comentario de baja **se sigue viendo**, y se tiene que ver de baja: fondo
 * hundido, filete al costado, píldora que lo dice con todas las letras y el
 * rastro de quién y cuándo. Lo que ya no lleva es el texto tachado: el
 * moderador necesita leer exactamente lo que se dijo para decidir si lo
 * restituye, y tachado eso se lee peor. Que no esté publicado lo dicen la
 * píldora y el fondo, que no le pelean a la lectura.
 *
 * La fila cambia de superficie según el estado —blanca si está publicado,
 * hundida si está de baja— y por eso todo lo que apoya adentro (las píldoras y
 * el aviso de error) recibe ese estado como prop en vez de traer un fondo
 * fijo. Es el mismo criterio de siempre: **el relleno de lo que apoya es el
 * contrario del de abajo**, o desaparece. Antes la píldora traía
 * `bg-panel-tarjeta` clavado y en la fila publicada, que también es blanca, se
 * la comía el fondo.
 */
export function FilaComentario({
  comentario,
  tituloNota,
  seccionNota,
}: {
  comentario: ComentarioModerable;
  tituloNota?: string;
  seccionNota?: string;
}) {
  const router = useRouter();
  const [enCurso, iniciar] = useTransition();
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const oculto = comentario.estado === "oculto";
  /** Sobre qué apoya lo que va adentro de la fila. */
  const superficie = oculto ? "hundida" : "tarjeta";

  /* Los botones de la fila salen de la pieza y ya no de dos constantes de este
     archivo. Los tres son `chico` —32px, por encima del piso de 24×24 de WCAG
     2.5.8— porque se repiten en cada comentario de una lista larga, y ahí un
     botón de 36px empuja la fila, que es lo que se lee.

     `sobre={superficie}` es lo que antes estaba clavado: `BOTON_SUAVE` traía
     `bg-panel-tarjeta` fijo, así que en la fila publicada —que también es
     blanca— el botón era del mismo color que lo que tenía abajo y su único
     límite era un `border-panel-borde` de 1,23:1. O sea: un texto con un borde
     que no se ve (WCAG 1.4.11). La pieza le pone el relleno contrario del de
     la fila y el filete de control. */
  const botonSuave = clasesDeBoton({ tamano: "chico", sobre: superficie });

  function moderar(accion: "bajar" | "restituir") {
    setError(null);
    iniciar(async () => {
      const res = await moderarComentarioAction(
        comentario.id,
        accion,
        accion === "bajar" ? motivo : undefined,
      );
      if (!res.ok) {
        setError(res.error ?? "No se pudo moderar.");
        return;
      }
      setPidiendoMotivo(false);
      setMotivo("");
      router.refresh();
    });
  }

  return (
    /* El filete de la izquierda existe en las dos ramas —transparente cuando
       está publicado— para que el texto de todas las filas arranque en la
       misma columna y la lista no se corra de a dos píxeles. */
    <li
      className={cn(
        "border-l-2 px-5 py-4",
        oculto
          ? "border-l-[var(--grafico-alerta)] bg-panel-tarjeta-2"
          : "border-l-transparent",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Acá el nombre se ve crudo, sin la versalita del diario que disimula
            las mayúsculas. Es el lugar donde más se nota lo que quedó guardado
            antes de que existiera `nombreDeDiario`. */}
        <span className="text-panel-base font-semibold text-panel-tinta">
          {nombreDeDiario(comentario.usuarioNombre)}
        </span>
        <span className="text-panel-xs text-panel-tinta-3">
          {tiempoRelativo(comentario.fecha)}
        </span>
        {seccionNota && <Pildora sobre={superficie}>{seccionNota}</Pildora>}
        {oculto && (
          /* Sin el icono de ojo tachado que tenía antes: la píldora del
             sistema ya trae su punto de color, y el ojo decía exactamente lo
             mismo dos veces. `enfasis` es lo que la hace encontrable de un
             vistazo, que era para lo que estaba el icono. */
          <Pildora tono="var(--grafico-alerta)" sobre={superficie} enfasis>
            De baja
          </Pildora>
        )}
      </div>

      {tituloNota && (
        <p className="mt-1 min-w-0 text-panel-sm text-panel-tinta-3">
          sobre <span className="text-panel-tinta-2">{tituloNota}</span>
        </p>
      )}

      <p
        className={cn(
          "mt-2 max-w-3xl text-panel-base",
          oculto ? "text-panel-tinta-2" : "text-panel-tinta",
        )}
      >
        {comentario.texto}
      </p>

      {oculto && comentario.ocultadoEn && (
        <p className="mt-2 text-panel-xs text-panel-tinta-3">
          Dado de baja {tiempoRelativo(comentario.ocultadoEn)}
          {comentario.ocultadoPor ? ` por ${comentario.ocultadoPor}` : ""}
          {comentario.motivoBaja ? ` · ${comentario.motivoBaja}` : ""}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="inline-flex items-center gap-3 text-panel-xs tabular-nums text-panel-tinta-3">
          <span className="inline-flex items-center gap-1">
            <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
            {comentario.likes}
          </span>
          <span className="inline-flex items-center gap-1">
            <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
            {comentario.dislikes}
          </span>
        </span>

        {oculto ? (
          <button
            type="button"
            onClick={() => moderar("restituir")}
            disabled={enCurso}
            className={botonSuave}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {enCurso ? "Restituyendo…" : "Restituir"}
          </button>
        ) : pidiendoMotivo ? (
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-panel-controles">
            {/* El placeholder no es una etiqueta: desaparece apenas se escribe
                y no lo lee nadie que no lo vea. */}
            <input
              aria-label="Motivo de la baja"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo (queda guardado; puede ir vacío)"
              /* El campo del sistema, con tres ajustes de acomodo: `w-auto`
                 para poder crecer con `flex-1` en vez del `w-full` que trae, y
                 `py-1.5` para quedar a la altura de los botones de 32 px con
                 los que comparte la línea. */
              className={cn(
                clasesDeCampo(superficie),
                "min-h-8 w-auto min-w-0 flex-1 py-1.5",
              )}
            />
            {/* Destructivo, y esto es un cambio de significado, no de piel:
                confirmar una baja venía con el azul sólido del acento, o sea
                exactamente igual que un "Guardar". El tono avisa por dos
                canales —filete rojo y tinta plena contra la `tinta-2` del
                secundario vecino— y por eso la palabra sigue diciendo qué
                hace: un botón destructivo que dice "Aceptar" es rojo y nada
                más. */}
            <button
              type="button"
              onClick={() => moderar("bajar")}
              disabled={enCurso}
              className={`${clasesDeBoton({
                tono: "destructivo",
                tamano: "chico",
                sobre: superficie,
              })} shrink-0`}
            >
              {enCurso ? "Bajando…" : "Confirmar baja"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPidiendoMotivo(false);
                setMotivo("");
              }}
              className={`${clasesDeBoton({
                tono: "fantasma",
                tamano: "chico",
              })} shrink-0`}
            >
              Cancelar
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setPidiendoMotivo(true)}
            className={botonSuave}
          >
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
            Dar de baja
          </button>
        )}
      </div>

      {error && (
        /* El cartel del sistema, que es el que resuelve el color: acá había un
           rojo literal de Tailwind (el 700, con el 400 colgado de la variante
           `dark:`), el último color literal que quedaba en el panel. Esa
           variante mira la preferencia del SISTEMA OPERATIVO y no el toggle
           del panel, que escribe `:root[data-theme="dark"]`: con el SO en
           claro y el panel en oscuro —el caso normal, nadie cambia la
           preferencia del SO para trabajar de noche— ganaba el rojo oscuro
           sobre la fila oscura, 2,4:1.
           `Aviso` pinta el filete y el icono con la fórmula de mezcla
           contra `--panel-tinta`, que sigue al tema de verdad, y deja la
           palabra en tinta del panel.
           `sobre` va invertido respecto de la fila por lo mismo que las
           píldoras: en la fila de baja, que ya es hundida, el aviso flota. */
        <div className="mt-2">
          <Aviso
            icono={AlertTriangle}
            tono="var(--grafico-alerta)"
            sobre={oculto ? "pagina" : "tarjeta"}
            rol="alert"
          >
            {error}
          </Aviso>
        </div>
      )}
    </li>
  );
}
