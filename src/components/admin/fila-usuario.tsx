"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, ShieldCheck, Undo2 } from "lucide-react";
import {
  cambiarBloqueoAction,
  cambiarRolAction,
} from "@/app/admin/acciones";
import { Aviso, Pildora, clasesDeBoton } from "@/components/admin/piezas";
import { nombreDeDiario } from "@/lib/auth/cidituc/nombre";
import type { UsuarioDelPanel } from "@/lib/repos/usuarios";
import { cn, tiempoRelativo } from "@/lib/utils";

/**
 * Una persona en la lista de usuarios.
 *
 * Los botones **explican**, no impiden: las reglas de quién puede quedar sin
 * permiso viven adentro de `repos/usuarios.ts`, en la misma transacción que la
 * escritura. Si acá se deshabilita algo es para que el administrador entienda
 * por qué, no para que la regla se cumpla — una invariante puesta en la pantalla
 * se pierde en el primer punto de entrada que se agregue.
 *
 * Por eso el error del servidor se muestra tal cual: es la única forma de que
 * "es el último administrador" llegue a la pantalla, porque acá no se recalcula.
 */
export function FilaUsuario({
  usuario,
  yo,
}: {
  usuario: UsuarioDelPanel;
  /** El `id_persona` de quien está mirando, para no ofrecerle bloquearse. */
  yo: string;
}) {
  const router = useRouter();
  const [enCurso, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const esAdmin = usuario.rol === "admin";
  const superficie = usuario.bloqueado ? "hundida" : "tarjeta";
  const boton = clasesDeBoton({ tamano: "chico", sobre: superficie });
  const soyYo = usuario.id === yo;

  function ejecutar(accion: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    iniciar(async () => {
      const res = await accion();
      if (!res.ok) {
        setError(res.error ?? "No se pudo guardar.");
        return;
      }
      router.refresh();
    });
  }

  return (
    /* El filete de la izquierda existe en las dos ramas —transparente cuando la
       cuenta está activa— para que el texto de todas las filas arranque en la
       misma columna y la lista no se corra de a dos píxeles. Es el mismo recurso
       que usa la fila de comentarios. */
    <li
      className={cn(
        "border-l-2 px-4 py-3.5 sm:px-5",
        usuario.bloqueado
          ? "border-l-[var(--grafico-alerta)] bg-panel-tarjeta-2"
          : "border-l-transparent",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-panel-base font-semibold text-panel-tinta">
          {nombreDeDiario(usuario.nombre)}
        </span>

        {esAdmin && (
          <Pildora tono="var(--grafico-acento)" sobre={superficie} enfasis>
            Administra
          </Pildora>
        )}
        {usuario.bloqueado && (
          <Pildora tono="var(--grafico-alerta)" sobre={superficie} enfasis>
            Bloqueada
          </Pildora>
        )}

        <span className="text-panel-xs text-panel-tinta-3">
          Entró {tiempoRelativo(usuario.ultimoIngreso)}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={enCurso}
            onClick={() =>
              ejecutar(() =>
                cambiarRolAction(usuario.id, esAdmin ? "lector" : "admin"),
              )
            }
            className={boton}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {esAdmin ? "Quitar administración" : "Hacer administradora"}
          </button>

          <button
            type="button"
            /* Deshabilitado sólo para uno mismo, y sólo para BLOQUEAR: el
               servidor lo rechaza igual, esto es para que no haya que apretar
               para enterarse. Degradarse sí se puede, si queda otro. */
            disabled={enCurso || (soyYo && !usuario.bloqueado)}
            title={
              soyYo && !usuario.bloqueado
                ? "No podés bloquearte a vos mismo"
                : undefined
            }
            onClick={() =>
              ejecutar(() =>
                cambiarBloqueoAction(usuario.id, !usuario.bloqueado),
              )
            }
            className={boton}
          >
            {usuario.bloqueado ? (
              <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Ban className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {usuario.bloqueado ? "Permitir de nuevo" : "Bloquear"}
          </button>
        </div>
      </div>

      {usuario.cambiadoPor && usuario.cambiadoEn && (
        /* El id de quien lo cambió y no su nombre: es el rastro, y el nombre de
           un administrador puede cambiar en Cidituc. Mismo criterio que la baja
           de un comentario. */
        <p className="mt-1.5 text-panel-xs text-panel-tinta-3">
          Último cambio {tiempoRelativo(usuario.cambiadoEn)}, por{" "}
          {usuario.cambiadoPor}
        </p>
      )}

      {error && (
        <div className="mt-2.5">
          <Aviso icono={Ban} tono="var(--grafico-alerta)" sobre="tarjeta" rol="alert">
            {error}
          </Aviso>
        </div>
      )}
    </li>
  );
}
