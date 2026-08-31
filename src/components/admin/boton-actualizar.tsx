"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { clasesDeBoton } from "@/components/admin/piezas";

/**
 * La hora de Tucumán, con segundos: "14:32:05".
 *
 * La zona va **fijada**, no la del navegador, y la decisión es a propósito: un
 * admin que mire desde otro huso ve la hora de Tucumán, no la suya. El resto de
 * la pantalla —las fechas de la tabla, la hora de la edición— sale de
 * `src/lib/fecha-edicion.ts`, que usa esta misma zona; si el cartel usara la
 * local, "Actualizado: 19:40" quedaría al lado de una consulta "de las 15:38" y
 * las dos horas dejarían de poder restarse, que es lo único que uno hace con
 * ellas. Y cuando dos personas en husos distintos miran el mismo tablero,
 * conviene que digan el mismo número.
 *
 * Los segundos van porque el botón sirve justamente para distinguir dos cargas
 * seguidas.
 */
function horaDeTucuman(): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Tucuman",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

/**
 * "Actualizar", con la hora de la última carga.
 *
 * El tablero de Migue se mira mientras pasan cosas —alguien está preguntándole
 * al diario ahora mismo— y sin este botón no hay forma de saber si lo que se ve
 * es de hace diez segundos o de hace media hora.
 *
 * `router.refresh()` de `next/navigation` vuelve a pedir la ruta al servidor y
 * rearma los Server Components sin perder el estado de los Client Components
 * (el filtro de la tabla no se borra) ni la posición del scroll. Confirmado
 * contra `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md`
 * en esta versión: sigue en la lista de `useRouter()`, con esa firma y sin nota
 * de deprecación. Ojo con lo que sí aclara esa doc —limpia la caché de cliente
 * de la ruta, **no** la del servidor—; acá alcanza porque la página lee la base
 * sin cachear.
 *
 * Y no confundirlo con el `refresh()` de `next/cache`, que en esta versión
 * existe y se parece: ese es **solo** para Server Actions y tira error si lo
 * llamás desde un Client Component. El de acá es el método del router.
 *
 * TRAMPA, y es la razón por la que la hora arranca en null: si el texto se
 * arma durante el render, el servidor escribe una hora y el cliente escribe
 * otra —siempre distintas, aunque sea por un segundo— y React tira error de
 * hidratación. La hora se decide **después de montar**, en un efecto, así que
 * el HTML del servidor y el primer render del cliente dicen exactamente lo
 * mismo: nada. Es el mismo problema que resuelve `ThemeToggle` con su
 * placeholder hasta hidratar.
 */
export function BotonActualizar() {
  const router = useRouter();
  const [enCurso, iniciar] = useTransition();
  const [actualizado, setActualizado] = useState<string | null>(null);

  /*
   * Se dispara al montar (sella la carga inicial) y cada vez que una
   * actualización termina. Depender de `enCurso` en vez de sellar la hora al
   * apretar el botón importa: la hora que vale es la de los datos que llegaron,
   * no la del click. En una recarga lenta serían cosas bien distintas.
   *
   * La marca se toma en un `queueMicrotask` y **no** en un
   * `requestAnimationFrame`. Escrito acá porque el rAF parece lo natural —"la
   * hora del cuadro en que se pintan los datos"— y ya estuvo puesto así una
   * vez: con la pestaña en segundo plano el navegador no pinta, así que el rAF
   * queda encolado y recién corre cuando la pestaña vuelve a verse. El cartel
   * sellaba la hora de *volver a mirar*, no la de los datos. Abrir
   * /admin/migue con ctrl+click a las 15:20 y volver a las 15:40 daba
   * "Actualizado: 15:40:00" arriba de datos de las 15:20: veinte minutos de
   * mentira en el único cartel que existe para no mentir sobre eso. En chico
   * pasaba lo mismo apretando Actualizar y minimizando mientras cargaba.
   *
   * `setTimeout(…, 0)` también corre con la pestaña oculta y serviría, pero los
   * navegadores estiran los timers de las pestañas de fondo hasta un segundo o
   * más; el microtask corre ya, apenas termina el commit.
   *
   * El microtask además esquiva, igual que el rAF,
   * `react-hooks/set-state-in-effect` —que está prendida y rechaza un
   * `setState` sincrónico en el cuerpo del efecto porque encadena renders—:
   * adentro de un callback diferido ya no lo es.
   *
   * Un microtask no se cancela, así que la limpieza baja una bandera y el
   * callback la mira antes de escribir. Hace falta de verdad: en desarrollo,
   * StrictMode monta, limpia y vuelve a montar antes de que corra ninguno de
   * los dos microtasks encolados, y sin la bandera el del efecto viejo también
   * escribiría.
   */
  useEffect(() => {
    if (enCurso) return;
    let vigente = true;
    queueMicrotask(() => {
      if (vigente) setActualizado(horaDeTucuman());
    });
    return () => {
      vigente = false;
    };
  }, [enCurso]);

  /*
   * `tono="primario"` porque es la única acción de la pantalla: va sólida y no
   * en contorno, que en un banner con un solo botón se lee como
   * "deshabilitado". El par `bg-accent` + `text-accent-contrast` ya está medido
   * (5.66:1 en claro, 8.31:1 en oscuro) y vive en la pieza, junto con el hover
   * a `accent-strong`, que en cada tema se mueve para el lado que conserva ese
   * contraste contra el mismo texto.
   *
   * Este archivo era el último del panel que escribía su botón a mano, y lo
   * escribía en números crudos: `rounded-[0.6rem]`, `text-[0.8rem]` y
   * `disabled:opacity-60`. Los tres coincidían con el sistema —0.6rem es
   * `rounded-panel-2` y 0.8rem es `text-panel-sm`— así que no se veía, y esa es
   * justamente la trampa: el día que el token se mueva, este botón se queda
   * quieto y nadie va a saber por qué. La opacidad del deshabilitado sí cambia,
   * de 60 a 50, que es la de los otros cinco botones del panel.
   *
   * El icono va `h-4`, que es el tamaño que le corresponde al botón normal (el
   * chico lleva `h-3.5`): antes era el del chico dentro de un botón de 36px,
   * así que quedaba flotando lejos de su palabra.
   *
   * Sin `focus:outline-none` en ninguna parte —tampoco lo trae la pieza—: el
   * anillo de la casa (`:focus-visible`, 2px de acento con 3px de offset) tiene
   * que verse también sobre el degradé del banner, y acá se ve porque el botón
   * deja aire alrededor.
   */
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        onClick={() => iniciar(() => router.refresh())}
        disabled={enCurso}
        aria-busy={enCurso}
        className={clasesDeBoton({ tono: "primario" })}
      >
        <RefreshCw
          className={enCurso ? "h-4 w-4 animate-spin" : "h-4 w-4"}
          aria-hidden="true"
        />
        {enCurso ? "Actualizando…" : "Actualizar"}
      </button>

      {/*
       * La hora ocupa su lugar desde el primer pintado aunque todavía no exista
       * (el `aria-hidden` con la cadena más larga posible), para que el botón no
       * se corra solo al hidratar. Se anuncia sola al cambiar: es un dato de
       * contexto, no un aviso.
       */}
      <span className="relative font-sans text-panel-xs tabular-nums text-panel-tinta-3">
        <span aria-hidden="true" className="invisible">
          Actualizado: 00:00:00
        </span>
        <span className="absolute inset-0" aria-live="polite">
          {actualizado ? `Actualizado: ${actualizado}` : ""}
        </span>
      </span>
    </div>
  );
}
