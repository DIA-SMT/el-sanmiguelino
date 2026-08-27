import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * La cara de Migue.
 *
 * El archivo viene recortado a la cabeza y con el fondo blanco ya sacado —con
 * relleno desde los bordes, para no comerse la camisa clara ni la credencial—.
 * Que tenga alfa no es un detalle: sin eso, en el tema oscuro el avatar sería
 * un cuadrado blanco flotando.
 *
 * El `alt` va vacío a propósito en casi todos los usos: la cara acompaña a un
 * texto que ya dice "Migue", y un lector de pantalla que anuncia "Migue" dos
 * veces seguidas estorba más de lo que ayuda. Cuando la imagen es lo único que
 * identifica al asistente —el botón flotante—, ahí sí lleva descripción, y va
 * en el `aria-label` del botón.
 */
export function RetratoMigue({
  className,
  sizes = "48px",
  prioridad,
}: {
  className?: string;
  sizes?: string;
  prioridad?: boolean;
}) {
  return (
    <Image
      src="/migue/retrato.webp"
      alt=""
      width={320}
      height={320}
      sizes={sizes}
      preload={prioridad}
      className={cn("shrink-0 rounded-full object-cover", className)}
    />
  );
}

/**
 * Migue entero, para cuando hay lugar: la bienvenida del chat.
 *
 * El ancho sale del archivo y no de un número redondo: `trim()` recorta la
 * figura a lo que ocupa de verdad, así que cambia si cambia el recorte del
 * fondo. Si no coincide con el archivo, Next sirve la imagen con otra relación
 * de aspecto.
 */
export function CuerpoMigue({ className }: { className?: string }) {
  return (
    <Image
      src="/migue/cuerpo.webp"
      alt=""
      width={388}
      height={900}
      sizes="120px"
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
