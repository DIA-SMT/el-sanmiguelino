"use client";

import { useId } from "react";
import { LoaderCircle, Square, Volume2 } from "lucide-react";
import { useLecturaEnVoz, type FuenteDeAudio } from "@/lib/voz/usar-voz";
import { cn } from "@/lib/utils";

/**
 * "Escuchar el resumen".
 *
 * Vive en la franja de metadatos, al lado de "3 min", y no en la fila de
 * Compartir del final: la franja ya contesta "¿cuánto me lleva esto?" y la
 * decisión de escuchar en vez de leer se toma **antes** de leer. Abajo de la
 * nota el control llega tarde, cuando el lector ya hizo el trabajo.
 *
 * **Si no hay ninguna voz en español instalada, el botón no se dibuja.** Pasa en
 * Androids pelados y en Windows recién instalados sin el paquete de idioma. Un
 * motor inglés leyendo "San Miguel de Tucumán" es literalmente ininteligible:
 * es peor que no ofrecer nada, y en un sitio municipal se lee como que el diario
 * está roto. La ausencia del control es una degradación honesta; un botón que
 * produce ruido, no. El costo es un saltito: en Chrome la lista de voces llega
 * un cuadro después del primer pintado, así que el botón aparece con un
 * instante de retraso. No se le reserva el espacio, porque dejar el hueco en los
 * dispositivos donde el botón nunca va a aparecer es peor que el saltito.
 *
 * **Nunca arranca solo.** Ni acá ni en la tapa. Satisface el criterio 1.4.2 de
 * WCAG por construcción, y de paso `speak()` sin gesto del usuario falla en
 * silencio en varios navegadores.
 *
 * Con `fuente`, antes de hablar se busca el mp3 con la voz de Migue. **El
 * botón se sigue dibujando según la voz del navegador y no según el mp3**, y
 * es a propósito: saber si el mp3 existe cuesta un pedido al servidor, y
 * pedirlo en cada pintado de cada nota para decidir si dibujar un botón es
 * mucho más caro que el botón. Un dispositivo sin voces en español se queda
 * sin control aunque el mp3 exista; es el caso raro —Androids pelados,
 * Windows recién instalados— y la alternativa es peor.
 */
export function BotonEscuchar({
  texto,
  fuente,
  etiqueta = "Escuchar el resumen",
  descripcion = "el resumen de esta nota",
  separador = false,
}: {
  /** El texto ya armado. Llega listo a propósito: `leer()` tiene que poder
   *  llamarse sin nada asincrónico en el medio. Ver `usar-voz.ts`. */
  texto: string;
  /**
   * Qué es lo que se escucha, para poder buscar el mp3 con la voz de Migue.
   *
   * Sin esto habla el navegador y nada cambia respecto de antes: por eso no
   * tiene valor por omisión propio y es opcional. Las páginas que lo pasen
   * suenan con la voz de Migue; las que no, con la del sistema.
   */
  fuente?: FuenteDeAudio;
  etiqueta?: string;
  /** Cómo se nombra lo que se va a leer, para el lector de pantalla. */
  descripcion?: string;
  /** Dibuja el "·" de la franja de metadatos delante del botón.
   *
   *  Lo dibuja ESTE componente y no la página porque el botón puede no
   *  aparecer: un separador puesto afuera quedaría colgado al final de la
   *  franja, apuntando a nada, justo en los dispositivos sin voz. */
  separador?: boolean;
}) {
  const { disponible, leyendo, preparando, leer, detener } = useLecturaEnVoz();
  const idAviso = useId();

  if (!disponible) return null;

  /*
   * Tres caras, un solo estado.
   *
   * "Preparando" no es un modo aparte del botón: mientras se genera el mp3 la
   * lectura YA está en curso —`leyendo` es true— y el click sigue siendo
   * Detener. Sólo cambia lo que dice, porque generar el audio puede tardar
   * unos segundos y un botón que no acusa recibo del click se aprieta dos
   * veces.
   */
  const Icono = preparando ? LoaderCircle : leyendo ? Square : Volume2;

  return (
    <>
      {separador && (
        <span aria-hidden="true" className="text-line">
          ·
        </span>
      )}
      <button
        type="button"
        onClick={() => (leyendo ? detener() : leer(texto, fuente))}
        aria-pressed={leyendo}
        /*
         * El label EMPIEZA por la palabra que se ve. Es el criterio 2.5.3 de
         * WCAG (Label in Name) y acá se estaba rompiendo con `preparando`: el
         * botón mostraba "Preparando" y el nombre accesible decía "Detener la
         * lectura en voz alta", sin la palabra visible adentro. Quien maneja el
         * diario por voz —Voice Control de iOS, Voice Access de Android,
         * Dragon— lee el botón y dice "tocar Preparando", y el comando no
         * enganchaba con nada: el control quedaba inalcanzable justo durante
         * los segundos en que hace falta arrepentirse. Con "Detener" y
         * "Escuchar" no pasaba porque el texto visible sí estaba en el label.
         */
        aria-label={
          preparando
            ? "Preparando la lectura, tocá para cancelar"
            : leyendo
              ? "Detener la lectura en voz alta"
              : `Escuchar ${descripcion}`
        }
        aria-describedby={idAviso}
        className="pressable inline-flex h-8 items-center gap-1.5 border border-line bg-chrome px-2.5 font-sans text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-ink-2 hover:border-ink hover:text-ink"
      >
        <Icono
          className={cn(
            "h-3 w-3",
            // El giro se apaga con "reducir movimiento": el cambio de texto ya
            // dice lo mismo, así que no se pierde información.
            preparando && "animate-spin motion-reduce:animate-none",
          )}
          aria-hidden="true"
        />
        {preparando ? "Preparando" : leyendo ? "Detener" : etiqueta}
      </button>

      {/*
       * El aviso se lee ANTES de apretar, no después.
       *
       * No hay forma de detectar un lector de pantalla y no hay que intentar
       * adivinarlo: se resuelve avisando. Quien ya está escuchando NVDA o
       * VoiceOver tiene que enterarse de que apretar esto le va a superponer una
       * segunda voz encima de la que está usando.
       */}
      {/* Dice "en voz alta" y ya no "con la voz del navegador": cuál de las
          dos voces suena lo decide el servidor recién al apretar, y prometer
          de antemano una que puede no ser la que se escuche es peor que no
          nombrarla. */}
      <span id={idAviso} className="sr-only">
        Lee {descripcion} en voz alta. Si ya usás un lector de pantalla, las dos
        voces se van a superponer.
      </span>

      {/*
       * Una sola región viva, siempre montada, con textos cortos. Siempre
       * montada porque una región que aparece recién cuando tiene algo que decir
       * a veces no se anuncia; corta porque se lee encima de la otra voz.
       */}
      <p role="status" aria-live="polite" className="sr-only">
        {preparando ? "Preparando la lectura" : leyendo ? "Leyendo en voz alta" : ""}
      </p>
    </>
  );
}
