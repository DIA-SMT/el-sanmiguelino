import { useEffect, useEffectEvent, type RefObject } from "react";

export type DireccionPagina = "adelante" | "atras";

/** Al soltar, dx tiene que superarle a dy por este factor. Es holgado a
 *  propósito: un swipe con el pulgar describe un arco y sale bastante
 *  diagonal. La primera criba la hace el navegador, que con `touch-action:
 *  pan-y` se queda con los desplazamientos verticales antes de que lleguen
 *  acá. */
const RATIO_HORIZONTAL = 1.2;
/** Más lento que esto no es un gesto: es alguien seleccionando texto. */
const DURACION_MAXIMA_MS = 1000;
/**
 * Franja que el sistema se reserva para su propia navegación.
 *
 * **Son LOS DOS bordes, no sólo el izquierdo.** Estuvo sólo el izquierdo, con la
 * idea de que ahí vive el "atrás" de iOS. Pero iOS usa el borde DERECHO para
 * "adelante", y avanzar de página es justamente arrastrar de derecha a
 * izquierda: el gesto más natural para pasar de hoja arranca en la franja que
 * Safari se queda. Se filmó en un iPhone: el deslizamiento recién se tomaba a
 * la tercera o cuarta.
 */
const BORDE_DEL_SISTEMA = 24;
/** Recorrido mínimo antes de decidir si el gesto es horizontal o vertical.
 *  En un dedo real el primer `pointermove` ya viene con un salto grande, así
 *  que decidir demasiado temprano trababa el gesto en el eje equivocado. */
const ZONA_MUERTA = 14;
/** Ventana en la que se descarta el click que sigue a un gesto completado. */
const GRACIA_CLICK_MS = 500;

/** Trackpad: cuánto desplazamiento horizontal acumulado pasa de página. */
const UMBRAL_RUEDA = 120;
/** Trackpad: dx tiene que superarle a dy por este factor. Más flojo que en el
 *  dedo porque dos dedos sobre un trackpad salen bastante más derechos. */
const RATIO_RUEDA = 1.5;
/** Trackpad: silencio que marca el fin de un gesto. Por debajo de esto todavía
 *  puede ser la inercia del mismo envión. */
const PAUSA_FIN_GESTO_MS = 220;
/** Ruido: por debajo de esto el deltaX es temblor de un scroll vertical. */
const RUIDO_RUEDA = 2;
/** Los deltas en modo "líneas" o "páginas" vienen en otra escala. */
const ESCALA_DELTA = [1, 16, 100];

/** Cuánto hay que arrastrar para pasar de página: proporcional a la pantalla,
 *  pero con piso y techo para que en un celular no sea imposible y en un
 *  monitor no sea un temblor. */
function umbral(ancho: number): number {
  return Math.min(140, Math.max(56, ancho * 0.14));
}

/** El dedo es de otro: hay un diálogo abierto (el chat de Migue), o el gesto
 *  arrancó dentro de algo que ya se desplaza solo en horizontal, como la barra
 *  de secciones. */
function esZonaAjena(objetivo: EventTarget | null): boolean {
  if (!(objetivo instanceof Element)) return false;
  if (objetivo.closest("[role='dialog']")) return true;

  for (let n: Element | null = objetivo; n; n = n.parentElement) {
    const { overflowX } = getComputedStyle(n);
    if (
      (overflowX === "auto" || overflowX === "scroll") &&
      n.scrollWidth > n.clientWidth + 1
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Pasar de página deslizando, como en el impreso. Escucha dos entradas:
 *
 * - **Dedo** (Pointer Events), que cubre igual el celular y la pantalla táctil
 *   de una notebook.
 * - **Trackpad**, con el gesto de dos dedos en horizontal, que llega como
 *   `wheel` con `deltaX`.
 *
 * Deliberadamente **no** escucha el arrastre del mouse: arrastrar con el mouse
 * es seleccionar texto, y para eso ya están las flechas y el teclado.
 *
 * En los dos casos el sentido es el mismo: los dedos van hacia la izquierda
 * para avanzar, como cuando se corre la hoja de un diario.
 *
 * `pistaAtras` y `pistaAdelante` son los cantos de la hoja que se iluminan
 * mientras el dedo arrastra. Se les escribe la opacidad directo en el DOM en
 * vez de pasar por estado de React: son hasta 60 actualizaciones por segundo y
 * no vale re-renderizar el árbol por cada una.
 */
export function useDeslizarPaginas({
  hayDestino,
  alPasar,
  pistaAtras,
  pistaAdelante,
}: {
  hayDestino: (direccion: DireccionPagina) => boolean;
  alPasar: (direccion: DireccionPagina) => void;
  pistaAtras: RefObject<HTMLElement | null>;
  pistaAdelante: RefObject<HTMLElement | null>;
}) {
  // Los callbacks se rehacen en cada render, pero el efecto tiene que montarse
  // una sola vez: si no, cada navegación vuelve a suscribir cinco listeners.
  // `useEffectEvent` da una identidad estable que igual ve los props frescos.
  const destinoVigente = useEffectEvent((direccion: DireccionPagina) =>
    hayDestino(direccion),
  );
  const pasarVigente = useEffectEvent((direccion: DireccionPagina) =>
    alPasar(direccion),
  );

  useEffect(() => {
    let puntero: number | null = null;
    let x0 = 0;
    let y0 = 0;
    let t0 = 0;
    let eje: "horizontal" | "vertical" | null = null;
    let recienPasada = false;

    function pintar(direccion: DireccionPagina | null, avance: number) {
      const atras = pistaAtras.current;
      const adelante = pistaAdelante.current;
      if (atras) {
        atras.style.opacity = direccion === "atras" ? String(avance) : "0";
      }
      if (adelante) {
        adelante.style.opacity = direccion === "adelante" ? String(avance) : "0";
      }
    }

    function soltar() {
      puntero = null;
      eje = null;
      pintar(null, 0);
    }

    function alApoyar(e: PointerEvent) {
      if (e.pointerType === "mouse") return;
      // Un segundo dedo (pinch, o el pulgar apoyado) cancela el gesto en curso
      if (puntero !== null || !e.isPrimary) {
        soltar();
        return;
      }
      if (e.clientX <= BORDE_DEL_SISTEMA) return;
      if (e.clientX >= window.innerWidth - BORDE_DEL_SISTEMA) return;
      if (esZonaAjena(e.target)) return;

      puntero = e.pointerId;
      x0 = e.clientX;
      y0 = e.clientY;
      t0 = e.timeStamp;
      eje = null;
    }

    function alMover(e: PointerEvent) {
      if (e.pointerId !== puntero) return;
      const dx = e.clientX - x0;
      const dy = e.clientY - y0;

      if (eje === null) {
        if (Math.abs(dx) < ZONA_MUERTA && Math.abs(dy) < ZONA_MUERTA) return;
        // Para fijar el eje basta cuál manda; el filtro fino va al soltar.
        eje = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }
      if (eje !== "horizontal") {
        pintar(null, 0);
        return;
      }

      // El canto no se ilumina si el gesto todavía no cumple lo que se le va a
      // exigir al soltar: prometer un giro que después no pasa es peor que no
      // avisar nada.
      if (Math.abs(dx) < Math.abs(dy) * RATIO_HORIZONTAL) {
        pintar(null, 0);
        return;
      }

      const direccion: DireccionPagina = dx < 0 ? "adelante" : "atras";
      if (!destinoVigente(direccion)) {
        pintar(null, 0);
        return;
      }

      /*
       * Desde acá el gesto ES NUESTRO, y hay que decírselo al navegador.
       *
       * `touch-action: pan-y` ya le avisa que el horizontal no es un paneo suyo,
       * pero eso no cubre las navegaciones por borde de iOS ni el cambio de
       * pestaña: cuando el sistema decide quedarse con el arrastre, manda
       * `pointercancel`, deja de mandar `pointermove` y el `pointerup` nunca
       * llega. El lector arrastró, no pasó nada, y tiene que volver a intentar —
       * que es exactamente lo que se filmó: el gesto entraba recién a la tercera.
       *
       * Este `preventDefault` sólo corre cuando ya se cumplen las tres
       * condiciones (eje horizontal fijado, ratio holgado, y hay página a dónde
       * ir), así que el scroll vertical nunca lo ve. Por eso el listener de
       * `pointermove` dejó de ser `passive`: sin eso el navegador ignora el
       * `preventDefault` y encima avisa por consola.
       *
       * NO ESTÁ VERIFICADO EN UN iPHONE: es una mitigación razonada. Si el gesto
       * sigue costando, el siguiente sospechoso es la inercia del scroll, que en
       * iOS sigue corriendo después de soltar.
       */
      e.preventDefault();

      pintar(direccion, Math.min(1, Math.abs(dx) / umbral(window.innerWidth)));
    }

    function alLevantar(e: PointerEvent) {
      if (e.pointerId !== puntero) return;
      const dx = e.clientX - x0;
      // `dy` ya no se lee acá: el eje se decidió en `alMover` y no se vuelve a
      // discutir al soltar. Ver el comentario de abajo.
      const dt = e.timeStamp - t0;
      const horizontal = eje === "horizontal";
      soltar();

      if (!horizontal || dt > DURACION_MAXIMA_MS) return;
      if (Math.abs(dx) < umbral(window.innerWidth)) return;
      /*
       * **Acá NO se vuelve a exigir el ratio, y eso es el arreglo.**
       *
       * Estaba `if (Math.abs(dx) < Math.abs(dy) * RATIO_HORIZONTAL) return;` y
       * descartaba gestos legítimos. El eje ya se fijó en `alMover`, cuando el
       * recorrido pasó la zona muerta y `|dx| > |dy|`: ahí se decidió que el
       * gesto era horizontal. Volver a medir sobre el recorrido COMPLETO castiga
       * al pulgar, que describe un arco: arrastrar 60px horizontales y 50
       * verticales da `60 < 50 × 1.2 = 60` y el giro no pasaba, aunque el gesto
       * hubiera arrancado clarísimamente horizontal. Con el pulgar de una mano
       * sosteniendo el teléfono ese arco es la norma, no la excepción.
       *
       * Lo que sí se sigue exigiendo es lo que de verdad distingue un gesto de
       * un accidente: que el eje se haya fijado en horizontal, que el recorrido
       * horizontal supere el umbral, y que haya durado menos de un segundo.
       *
       * `RATIO_HORIZONTAL` se conserva para `alMover`, donde decide si se
       * ilumina el canto: ahí sirve para no PROMETER un giro que no va a pasar,
       * y errar de más sólo cuesta un brillo que no se enciende.
       */

      const direccion: DireccionPagina = dx < 0 ? "adelante" : "atras";
      if (!destinoVigente(direccion)) return;

      recienPasada = true;
      window.setTimeout(() => {
        recienPasada = false;
      }, GRACIA_CLICK_MS);
      pasarVigente(direccion);
    }

    /** Un gesto que arrancó sobre un enlace no debe además abrirlo. */
    function tragarClick(e: MouseEvent) {
      if (!recienPasada) return;
      recienPasada = false;
      e.preventDefault();
      e.stopPropagation();
    }

    // --- Trackpad -------------------------------------------------------
    let acumulado = 0;
    let ultimoRodar = 0;
    /** true desde que el envión ya pasó de página hasta que termina: la
     *  inercia del trackpad sigue mandando eventos y sin esto un solo gesto
     *  pasaba tres páginas. */
    let envionUsado = false;
    let apagarPista: number | undefined;

    function alRodar(e: WheelEvent) {
      if (e.ctrlKey) return; // pinch para hacer zoom
      const escala = ESCALA_DELTA[e.deltaMode] ?? 1;
      const dx = e.deltaX * escala;
      const dy = e.deltaY * escala;

      // Scroll vertical (o casi): no es nuestro. Sin preventDefault, o
      // rompemos el scroll de toda la página.
      if (Math.abs(dx) < RUIDO_RUEDA || Math.abs(dx) <= Math.abs(dy) * RATIO_RUEDA) {
        acumulado = 0;
        return;
      }
      if (esZonaAjena(e.target)) return;

      // Desde acá el gesto es nuestro. Hay que frenar el "atrás/adelante" que
      // el navegador hace con el mismo movimiento, o navegan las dos cosas.
      e.preventDefault();

      if (e.timeStamp - ultimoRodar > PAUSA_FIN_GESTO_MS) {
        acumulado = 0;
        envionUsado = false;
      }
      ultimoRodar = e.timeStamp;

      window.clearTimeout(apagarPista);
      apagarPista = window.setTimeout(() => {
        acumulado = 0;
        envionUsado = false;
        pintar(null, 0);
      }, PAUSA_FIN_GESTO_MS);

      if (envionUsado) return;

      acumulado += dx;
      const direccion: DireccionPagina = acumulado > 0 ? "adelante" : "atras";
      if (!destinoVigente(direccion)) {
        pintar(null, 0);
        return;
      }
      pintar(direccion, Math.min(1, Math.abs(acumulado) / UMBRAL_RUEDA));

      if (Math.abs(acumulado) < UMBRAL_RUEDA) return;
      acumulado = 0;
      envionUsado = true;
      pintar(null, 0);
      pasarVigente(direccion);
    }

    // `pointerdown` y `pointerup` van passive: no cancelan nada.
    //
    // `pointermove` NO puede ir passive, y es a propósito: necesita
    // `preventDefault()` para quedarse con el gesto una vez que ya decidió que
    // es horizontal (ver adentro). El scroll vertical sigue funcionando igual,
    // porque en ese caso la función sale antes de llegar al `preventDefault`.
    window.addEventListener("pointerdown", alApoyar, { passive: true });
    window.addEventListener("pointermove", alMover, { passive: false });
    window.addEventListener("pointerup", alLevantar, { passive: true });
    window.addEventListener("pointercancel", soltar, { passive: true });
    window.addEventListener("click", tragarClick, true);
    // El de rueda no puede ser passive porque necesita preventDefault; por eso
    // descarta el caso vertical en las dos primeras líneas y sale.
    window.addEventListener("wheel", alRodar, { passive: false });

    return () => {
      window.removeEventListener("pointerdown", alApoyar);
      window.removeEventListener("pointermove", alMover);
      window.removeEventListener("pointerup", alLevantar);
      window.removeEventListener("pointercancel", soltar);
      window.removeEventListener("click", tragarClick, true);
      window.removeEventListener("wheel", alRodar);
      window.clearTimeout(apagarPista);
    };
  }, [pistaAtras, pistaAdelante]);
}
