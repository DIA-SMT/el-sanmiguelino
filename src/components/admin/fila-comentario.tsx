"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Ban,
  EyeOff,
  RotateCcw,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import {
  cambiarBloqueoAction,
  eliminarComentarioAction,
  moderarComentarioAction,
} from "@/app/admin/acciones";
import { nombreDeDiario } from "@/lib/auth/cidituc/nombre";
import {
  Aviso,
  ChipFiltro,
  Pildora,
  clasesDeBoton,
  clasesDeCampo,
} from "@/components/admin/piezas";
import { cn, tiempoRelativo } from "@/lib/utils";
import { MOTIVOS_DE_BAJA, type ComentarioModerable } from "@/lib/types";

/**
 * Un comentario en la pantalla de moderación.
 *
 * **Tiene tres estados y no dos**, y el del medio es el que faltaba. Antes sólo
 * se podía dejar publicado o bajar, así que un comentario que había que mirar
 * con calma —una agresión, algo que puede tener el dato de un vecino— obligaba
 * a elegir entre dejarlo a la vista o resolverlo de apuro. "Mandar a revisión"
 * lo saca del diario y no decide nada más: desde ahí se publica de nuevo o se
 * da de baja.
 *
 * **Dar de baja pide un motivo de una lista.** El campo libre solo hacía que la
 * misma razón quedara escrita de cinco maneras, y una moderación que no se
 * puede contar tampoco se puede sostener pareja. El detalle libre sigue estando
 * al lado, para lo que la lista no cubre; lo que ya no se puede es bajar algo
 * sin decir de qué se trata.
 *
 * **Borrar es lo último y es otra cosa.** Sólo aparece sobre un comentario que
 * ya está de baja, y el orden importa: primero queda escrito por qué se lo sacó
 * y recién después se decide que el diario no tiene por qué conservar eso para
 * siempre. Es la única acción del panel que destruye la palabra de un vecino,
 * así que pide un segundo paso y dice qué se pierde.
 *
 * La fila cambia de superficie según el estado —blanca si está publicado,
 * hundida si no— y por eso todo lo que apoya adentro (las píldoras, los chips y
 * los avisos) recibe ese estado como prop en vez de traer un fondo fijo. Es el
 * criterio de siempre: **el relleno de lo que apoya es el contrario del de
 * abajo**, o desaparece.
 */

/** Qué se ve arriba de la fila y sobre qué apoya lo de adentro. Una tabla en
 *  vez de tres `if` desparramados: los tres estados se leen de un vistazo y
 *  sumar un cuarto es una línea. */
const ESTADOS = {
  publicado: { pildora: null, tono: null, superficie: "tarjeta" },
  en_revision: {
    pildora: "En revisión",
    tono: "var(--grafico-diario)",
    superficie: "hundida",
  },
  oculto: {
    pildora: "De baja",
    tono: "var(--grafico-alerta)",
    superficie: "hundida",
  },
} as const;

/**
 * Quién escribió, como lo ve la moderación.
 *
 * `null` cuando esa persona no está en el padrón: los comentarios de la época
 * del login de mentira traen `usuarioId` que no corresponden a nadie de
 * Cidituc, así que no hay a quién bloquear y el botón no se ofrece.
 */
export interface AutorDelComentario {
  bloqueado: boolean;
  /** Es quien está moderando. Nadie se bloquea a sí mismo. */
  soyYo: boolean;
}

type Ceremonia = "ninguna" | "bajar" | "borrar" | "bloquear";

export function FilaComentario({
  comentario,
  tituloNota,
  seccionNota,
  autor,
}: {
  comentario: ComentarioModerable;
  tituloNota?: string;
  seccionNota?: string;
  autor: AutorDelComentario | null;
}) {
  const router = useRouter();
  const [enCurso, iniciar] = useTransition();
  const [ceremonia, setCeremonia] = useState<Ceremonia>("ninguna");
  const [motivo, setMotivo] = useState<string>(MOTIVOS_DE_BAJA[0]);
  const [detalle, setDetalle] = useState("");
  const [error, setError] = useState<string | null>(null);

  /* El estado puede llegar con un texto que esta pantalla todavía no conoce
     —en la base es una columna de texto, justamente para poder sumar casos sin
     migrar—, así que lo desconocido se dibuja como publicado en vez de romper
     la fila. */
  const estado = ESTADOS[comentario.estado] ?? ESTADOS.publicado;
  const superficie = estado.superficie;
  const publicado = comentario.estado === "publicado";
  const deBaja = comentario.estado === "oculto";

  const boton = clasesDeBoton({ tamano: "chico", sobre: superficie });
  const botonDestructivo = clasesDeBoton({
    tono: "destructivo",
    tamano: "chico",
    sobre: superficie,
  });
  const botonQuieto = clasesDeBoton({ tono: "fantasma", tamano: "chico" });
  /* Los botones de las ceremonias apoyan sobre el bloque blanco que se abre
     dentro de la fila, no sobre la fila: ahí el relleno del control es el
     contrario y se hunde. */
  const botonConfirmar = clasesDeBoton({
    tono: "destructivo",
    tamano: "chico",
    sobre: "tarjeta",
  });

  function cerrar() {
    setCeremonia("ninguna");
    setDetalle("");
    setMotivo(MOTIVOS_DE_BAJA[0]);
  }

  /** Todo lo que esta fila hace pasa por acá: una sola forma de mostrar el
   *  error y una sola de refrescar. El error del servidor se muestra tal cual
   *  llega, porque es la única manera de que "primero hay que darlo de baja"
   *  aparezca en la pantalla — acá no se recalcula ninguna regla. */
  function ejecutar(accion: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    iniciar(async () => {
      const res = await accion();
      if (!res.ok) {
        setError(res.error ?? "No se pudo guardar.");
        return;
      }
      cerrar();
      router.refresh();
    });
  }

  const moderar = (accion: "bajar" | "restituir" | "revisar") =>
    ejecutar(() =>
      moderarComentarioAction(
        comentario.id,
        accion,
        accion === "bajar" ? motivo : undefined,
        accion === "bajar" ? detalle : undefined,
      ),
    );

  return (
    /* El filete de la izquierda existe en las tres ramas —transparente cuando
       está publicado— para que el texto de todas las filas arranque en la misma
       columna y la lista no se corra de a dos píxeles. El color va por `style`
       y no por clase porque los tokens de los gráficos quedaron a propósito
       afuera de `@theme`: se usan como `var()`. */
    <li
      className={cn(
        "border-l-2 px-5 py-4",
        publicado ? "border-l-transparent" : "bg-panel-tarjeta-2",
      )}
      style={estado.tono ? { borderLeftColor: estado.tono } : undefined}
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
        {estado.pildora && (
          <Pildora tono={estado.tono} sobre={superficie} enfasis>
            {estado.pildora}
          </Pildora>
        )}
        {autor?.bloqueado && (
          <Pildora tono="var(--grafico-alerta)" sobre={superficie}>
            Cuenta bloqueada
          </Pildora>
        )}
      </div>

      {tituloNota && (
        <p className="mt-1 min-w-0 text-panel-sm text-panel-tinta-3">
          sobre <span className="text-panel-tinta-2">{tituloNota}</span>
        </p>
      )}

      {/* Nunca tachado, en ninguno de los tres estados: el moderador necesita
          leer exactamente lo que se dijo para decidir si lo restituye o si lo
          borra, y tachado eso se lee peor. Que no esté publicado lo dicen la
          píldora y el fondo, que no le pelean a la lectura. */}
      <p
        className={cn(
          "mt-2 max-w-3xl text-panel-base",
          publicado ? "text-panel-tinta" : "text-panel-tinta-2",
        )}
      >
        {comentario.texto}
      </p>

      {!publicado && comentario.ocultadoEn && (
        <p className="mt-2 text-panel-xs text-panel-tinta-3">
          {deBaja ? "Dado de baja" : "En revisión desde"}{" "}
          {tiempoRelativo(comentario.ocultadoEn)}
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

        {ceremonia === "ninguna" && (
          <>
            {/* Publicar de nuevo es la misma acción para los dos estados que no
                están publicados, porque hace exactamente lo mismo. */}
            {!publicado && (
              <button
                type="button"
                onClick={() => moderar("restituir")}
                disabled={enCurso}
                className={boton}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                {enCurso ? "Publicando…" : "Publicar de nuevo"}
              </button>
            )}

            {/* Revisar, sólo desde publicado: es el paso previo a decidir, y
                sobre algo que ya está fuera del diario no significa nada. */}
            {publicado && (
              <button
                type="button"
                onClick={() => moderar("revisar")}
                disabled={enCurso}
                className={boton}
                title="Lo saca del diario mientras lo decidís"
              >
                <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                Mandar a revisión
              </button>
            )}

            {!deBaja && (
              <button
                type="button"
                onClick={() => {
                  setCeremonia("bajar");
                  setError(null);
                }}
                className={botonDestructivo}
              >
                <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                Dar de baja
              </button>
            )}

            {/* Borrar, sólo sobre lo que ya está de baja. El servidor lo exige
                igual; acá no se dibuja para no ofrecer un botón cuyo único
                destino posible es un cartel de error. */}
            {deBaja && (
              <button
                type="button"
                onClick={() => {
                  setCeremonia("borrar");
                  setError(null);
                }}
                className={botonDestructivo}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Borrar
              </button>
            )}

            {/* Bloquear a quien escribió, desde el comentario mismo. Una
                agresión no es un problema del texto sino de quien lo escribió, y
                hasta ahora había que anotarse el nombre e ir a buscarlo a
                Usuarios. Sólo aparece si esa persona está en el padrón, si no
                está ya bloqueada y si no sos vos. */}
            {autor && !autor.bloqueado && !autor.soyYo && (
              <button
                type="button"
                onClick={() => {
                  setCeremonia("bloquear");
                  setError(null);
                }}
                className={boton}
              >
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                Bloquear a quien lo escribió
              </button>
            )}
          </>
        )}
      </div>

      {/* --- La baja, con su motivo ---------------------------------------- */}
      {ceremonia === "bajar" && (
        <div className="mt-3 grid gap-2.5 rounded-panel-2 bg-panel-tarjeta p-3.5">
          <p className="text-panel-sm font-medium text-panel-tinta-2">
            ¿Por qué se da de baja?
          </p>
          {/* Chips y no un desplegable: son cinco y tienen que verse los cinco.
              Es el mismo control con el que se filtra arriba, así que el motivo
              se elige igual que se filtra. */}
          <div className="flex flex-wrap gap-panel-controles">
            {MOTIVOS_DE_BAJA.map((m) => (
              <ChipFiltro
                key={m}
                activo={motivo === m}
                superficie="tarjeta"
                onClick={() => setMotivo(m)}
              >
                {m}
              </ChipFiltro>
            ))}
          </div>
          <label className="grid gap-1.5">
            <span className="text-panel-sm font-medium text-panel-tinta-2">
              Detalle (opcional, queda guardado junto al motivo)
            </span>
            <input
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              maxLength={300}
              placeholder="Lo que haga falta aclarar"
              className={clasesDeCampo("tarjeta")}
            />
          </label>
          <div className="flex flex-wrap items-center gap-panel-controles">
            <button
              type="button"
              onClick={() => moderar("bajar")}
              disabled={enCurso}
              className={botonConfirmar}
            >
              <Ban className="h-3.5 w-3.5" aria-hidden="true" />
              {enCurso ? "Bajando…" : "Confirmar la baja"}
            </button>
            <button type="button" onClick={cerrar} className={botonQuieto}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* --- El borrado ---------------------------------------------------- */}
      {ceremonia === "borrar" && (
        <div className="mt-3 grid gap-2.5 rounded-panel-2 bg-panel-tarjeta p-3.5">
          <Aviso
            icono={AlertTriangle}
            tono="var(--grafico-alerta)"
            sobre="tarjeta"
            rol="alert"
          >
            {/* Se dice QUÉ se pierde. Un "¿estás seguro?" no informa nada:
                quien apretó ya cree que sí. */}
            Borrarlo lo saca de la base para siempre, con sus{" "}
            <strong className="font-semibold text-panel-tinta">
              {comentario.likes + comentario.dislikes}{" "}
              {comentario.likes + comentario.dislikes === 1 ? "voto" : "votos"}
            </strong>{" "}
            y con el rastro de la baja: no va a quedar registro de que existió,
            ni de quién lo bajó ni por qué. No hay papelera.
          </Aviso>
          <div className="flex flex-wrap items-center gap-panel-controles">
            <button
              type="button"
              onClick={() =>
                ejecutar(() => eliminarComentarioAction(comentario.id))
              }
              disabled={enCurso}
              className={botonConfirmar}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              {enCurso ? "Borrando…" : "Borrarlo para siempre"}
            </button>
            <button type="button" onClick={cerrar} className={botonQuieto}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* --- El bloqueo de quien escribió ---------------------------------- */}
      {ceremonia === "bloquear" && (
        <div className="mt-3 grid gap-2.5 rounded-panel-2 bg-panel-tarjeta p-3.5">
          <Aviso
            icono={ShieldAlert}
            tono="var(--grafico-alerta)"
            sobre="tarjeta"
            rol="alert"
          >
            Bloquear a{" "}
            <strong className="font-semibold text-panel-tinta">
              {nombreDeDiario(comentario.usuarioNombre)}
            </strong>{" "}
            le corta comentar y votar en el pedido siguiente y no le deja abrir
            una sesión nueva. Este comentario no cambia de estado: si además hay
            que sacarlo, se lo da de baja aparte. Se desbloquea desde Usuarios.
          </Aviso>
          <div className="flex flex-wrap items-center gap-panel-controles">
            <button
              type="button"
              onClick={() =>
                ejecutar(() => cambiarBloqueoAction(comentario.usuarioId, true))
              }
              disabled={enCurso}
              className={botonConfirmar}
            >
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              {enCurso ? "Bloqueando…" : "Confirmar el bloqueo"}
            </button>
            <button type="button" onClick={cerrar} className={botonQuieto}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        /* El cartel del sistema, que es el que resuelve el color: la fórmula de
           mezcla se calcula contra `--panel-tinta`, que sigue al tema de verdad
           —el del toggle del panel— y no a la preferencia del sistema
           operativo. `sobre` va invertido respecto de la fila por lo mismo que
           las píldoras: en una fila hundida el aviso flota. */
        <div className="mt-2">
          <Aviso
            icono={AlertTriangle}
            tono="var(--grafico-alerta)"
            sobre={publicado ? "tarjeta" : "pagina"}
            rol="alert"
          >
            {error}
          </Aviso>
        </div>
      )}
    </li>
  );
}
