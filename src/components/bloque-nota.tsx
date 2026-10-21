import { InteractivoIncrustado } from "@/components/interactivo-incrustado";
import { urlIncrustable } from "@/lib/interactivos";
import { FiguraNota } from "@/components/figura-nota";
import { CitaPersona } from "@/components/cita-persona";
import { cn } from "@/lib/utils";
import type { BloqueNota } from "@/lib/types";

/**
 * Un bloque del cuerpo de una nota, como lo ve el lector.
 *
 * Vivía adentro de la página de la nota; está acá para poder dibujarlo solo
 * —con datos armados, para probar un recuadro o una cita sin tocar la base—.
 */
export function Bloque({
  bloque,
  notaSlug,
  indice,
}: {
  bloque: BloqueNota;
  /** De qué nota y en qué lugar del cuerpo: el interactivo se pide por eso, no
   *  por su dirección (ver `src/app/interactivo/route.ts`). */
  notaSlug: string;
  indice: number;
}) {
  switch (bloque.tipo) {
    case "subtitulo":
      return (
        <h2 className="mb-3 mt-7 flex items-baseline gap-2.5 font-sans text-[0.72rem] font-bold uppercase tracking-[0.18em] text-ink first:mt-0">
          <span
            aria-hidden="true"
            className="h-[2px] w-4 shrink-0 translate-y-[-0.25em] bg-accent"
          />
          {bloque.texto}
        </h2>
      );
    case "cita":
      return (
        <CitaPersona
          texto={bloque.texto}
          autor={bloque.autor}
          cargo={bloque.cargo}
          retrato={bloque.retrato}
          className="my-7"
        />
      );
    case "destacado": {
      /* Una frase del propio texto, subrayada. En el impreso es un filete
         grueso arriba y la frase en la sans del diario, más grande que el
         cuerpo pero sin llegar al titular. Sin comillas ni autor: no es una
         cita, es el redactor levantando la voz sobre su propia idea.

         Acepta hasta un par de párrafos —cada renglón es uno— y el estilo lo
         elige la redacción. Antes el texto se pintaba entero en un solo <p>:
         los puntos y aparte desaparecían y todo salía en negrita, que es lo
         que reportaron. */
      const parrafos = bloque.texto
        .split(/\n+/)
        .map((p) => p.trim())
        .filter(Boolean);
      /* Negrita es UN solo peso, el de siempre (500), venga de donde venga.

         Estuvo en tres: ausente 500, `true` 600 y `false` 400. Eso hacía que
         apagar y volver a prender "Negrita" en un destacado publicado lo
         dejara más grueso que antes —de 500 a 600— con el botón exactamente
         igual que al empezar: la pantalla escondía la diferencia. 500 es,
         además, lo que la redacción llamaba negrita cuando reportó que salía
         "en negrita sola". Sólo `false` lo baja a normal. */
      const peso = bloque.negrita === false ? "font-normal" : "font-medium";
      const letra = cn(
        "font-sans text-[1.12rem] leading-[1.35] text-ink",
        peso,
        bloque.cursiva && "italic",
      );

      /* Un solo párrafo se dibuja con el MISMO elemento y las mismas clases de
         siempre. No es prolijidad: los trece destacados publicados son de un
         párrafo, y así salen idénticos sin depender de que un envoltorio nuevo
         no les cambie nada. */
      if (parrafos.length <= 1) {
        return (
          <p className={cn("my-7 border-t-2 border-ink pt-4", letra)}>
            {parrafos[0] ?? bloque.texto}
          </p>
        );
      }
      return (
        <div className="my-7 border-t-2 border-ink pt-4">
          {parrafos.map((p, i) => (
            <p key={i} className={cn(letra, i > 0 && "mt-3")}>
              {p}
            </p>
          ))}
        </div>
      );
    }
    case "ficha":
      /* Recuadro de datos. El marco de esquinas redondeadas es del impreso y
         es el único lugar del diario donde hay una curva: todo lo demás son
         filetes rectos. Va entero en la sans, incluido el cuerpo, porque no es
         texto para leer de corrido sino para consultar.

         Cruza todas las columnas porque es un PANEL, no un ítem de la
         columna: encerrado en una sola, su texto se parte en tiras de cuatro
         palabras y se vuelve ilegible. En el papel ocupa el ancho de la página.

         **El texto corre, no se encasilla.** Antes cada entrada era una celda
         de una grilla de dos: una sola entrada larga —"El exilio, sus viajes y
         redacción de las Bases"— llenaba la izquierda y dejaba medio recuadro
         en blanco, y dos entradas desparejas, lo mismo debajo de la corta. Con
         columnas de texto el contenido se reparte parejo entre las dos.

         Con foto, el recuadro la lleva al costado y el texto la rodea: sigue
         al lado mientras dura la foto y después toma todo el ancho. Así no
         queda hueco ni del lado de la foto ni del lado del texto. */
      return (
        <section className="my-8 rounded-2xl border border-ink px-5 py-5 [column-span:all] sm:px-7 sm:py-6">
          <h2 className="titular text-[1.3rem] text-ink">{bloque.titulo}</h2>
          {bloque.foto && (
            <FiguraNota
              src={bloque.foto.src}
              alt={bloque.foto.alt}
              epigrafe={bloque.foto.epigrafe ?? ""}
              credito={bloque.foto.credito}
              className="mt-4 md:float-right md:mb-3 md:ml-8 md:w-[44%]"
              sizes="(min-width: 1100px) 480px, (min-width: 768px) 44vw, 100vw"
            />
          )}
          <dl
            className={cn(
              "mt-4",
              // Sin foto, dos columnas parejas. Con foto, una sola que la
              // rodea: columnas y un flotante no se llevan.
              !bloque.foto && "gap-x-9 [column-rule:1px_solid_var(--hairline)] sm:columns-2",
            )}
          >
            {bloque.entradas.map((e, j) => (
              <div
                key={j}
                className={cn(
                  "[&:not(:first-child)]:mt-4",
                  // Una entrada corta no se parte entre columnas —un año
                  // de un lado y su dato del otro no se lee—; una larga sí,
                  // o volvería a quedar una columna llena y otra vacía.
                  e.texto.length < 320
                    ? "[break-inside:avoid]"
                    : "[break-inside:auto]",
                )}
              >
                <dt className="font-sans text-[0.85rem] font-semibold leading-snug text-ink [break-after:avoid]">
                  {e.lead}
                </dt>
                <dd className="mt-1 font-sans text-[0.82rem] leading-[1.55] text-ink-2">
                  {e.texto}
                </dd>
              </div>
            ))}
          </dl>
          {/* El recuadro termina debajo de la foto aunque el texto sea corto. */}
          {bloque.foto && <div className="clear-both" aria-hidden="true" />}
        </section>
      );
    case "foto":
      /* Una foto dentro del cuerpo. NO cruza las columnas: se queda en la suya
         y deja que el multicol la acomode. Es lo que convierte una página de
         galería del impreso —seis fotos con su epígrafe— en dos filas de tres
         sin una sola línea de layout propia.

         La excepción es la infografía (`anchoCompleto`), que sí las cruza y va
         del ancho de la nota: metida en una columna de 340px, sus rótulos
         quedan en tres píxeles y el gráfico deja de decir lo que dice. Y va sin
         el recorte 8:5, porque en un gráfico lo que se recorta es información y
         no aire. */
      return bloque.anchoCompleto ? (
        <FiguraNota
          src={bloque.src}
          alt={bloque.alt}
          epigrafe={bloque.epigrafe ?? ""}
          credito={bloque.credito}
          className="figura-ancha"
          sinRecorte
          sizes="(min-width: 1100px) 1100px, 100vw"
        />
      ) : (
        <FiguraNota
          src={bloque.src}
          alt={bloque.alt}
          epigrafe={bloque.epigrafe ?? ""}
          credito={bloque.credito}
          className="my-6"
          sizes="(min-width: 1100px) 340px, (min-width: 768px) 50vw, 100vw"
        />
      );
    case "lista":
      /* La enumeración del impreso: un ítem por renglón.
         En la página 4 son los nombres de las 67 plazas, que al costado del
         mapa van uno debajo del otro y en la web terminaban en un párrafo
         corrido de 1.515 caracteres.

         **Se parte entre columnas a propósito.** `.note-columns > *` trae
         `break-inside: avoid-column` para que una foto o una ficha no queden
         cortadas al medio, pero una lista de sesenta y siete nombres que no se
         puede partir arma una columna altísima al lado de dos vacías. Una lista
         fluye como el texto, que es lo que hace el papel. */
      return (
        <div className="my-5 [break-inside:auto]">
          {bloque.titulo ? (
            /* El título de una lista es un subtítulo y tiene el mismo
               problema: la lista se parte entre columnas a propósito (ver
               arriba), así que sin esto el título podía quedar solo al pie de
               una y sus ítems arrancar en la otra. La regla de `globals.css`
               no lo alcanza porque no es un <h2> hijo directo de las columnas. */
            <p className="volanta mb-2 text-ink [break-after:avoid]">
              {bloque.titulo}
            </p>
          ) : null}
          <ul className="grid gap-y-1">
            {bloque.items.map((item, i) => (
              <li
                key={i}
                className="font-serif text-[0.92rem] leading-[1.45] text-ink"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      );
    case "interactivo": {
      /* Un interactivo del Portal de Datos —la línea de tiempo, el mapa de
         esculturas—, a todo el ancho de la nota como la infografía: metido en
         una columna de 340px no se puede usar.

         La dirección se vuelve a mirar acá, no sólo al guardar: los scripts de
         digitalización escriben en la base sin pasar por la acción del panel.
         Si no es de un sitio habilitado, no se dibuja ni el recuadro ni el
         enlace —una dirección que no se validó no se ofrece—, y queda el
         título solo, para que la nota no tenga un hueco sin explicación.

         El pie —descripción, enlace y pantalla completa— lo arma el propio
         `InteractivoIncrustado`: depende de cosas que sólo se saben en el
         navegador (el ancho, la señal, si se puede poner en pantalla
         completa). */
      const url = urlIncrustable(bloque.url);
      return (
        <figure className="figura-ancha">
          {url ? (
            <InteractivoIncrustado
              url={url}
              notaSlug={notaSlug}
              indice={indice}
              titulo={bloque.titulo}
              descripcion={bloque.descripcion}
              alto={bloque.alto}
            />
          ) : (
            <figcaption className="mt-2.5 font-sans text-[0.74rem] leading-snug text-ink-3">
              {bloque.descripcion && (
                <span className="block text-pretty text-ink-2">
                  {bloque.descripcion}
                </span>
              )}
              <span className="mt-1 block">{bloque.titulo}</span>
            </figcaption>
          )}
        </figure>
      );
    }
    default:
      return (
        <p className="texto-diario font-serif text-[0.97rem] leading-[1.72] text-ink">
          {bloque.texto}
        </p>
      );
  }
}
