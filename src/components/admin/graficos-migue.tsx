/**
 * Los dos gráficos del tablero de Migue, en SVG a mano.
 *
 * Sin librerías: son dos formas simples y una dependencia de gráficos pesa más
 * que el código que reemplaza. Y sin `"use client"`: los dos se dibujan enteros
 * en el servidor, así que no viajan ni un kilobyte de JavaScript al navegador
 * por mostrar un gráfico en una pantalla que ve una persona por día.
 *
 * Eso obliga a resolver el hover sin JavaScript, y se puede: la capa de hover
 * es un `<g class="group">` por día con un rectángulo transparente que abarca
 * toda la altura del gráfico; el guía vertical y los puntos aparecen con
 * `group-hover`, que es CSS puro, y el número exacto lo da un `<title>` nativo.
 * Además hay una tabla desplegable con todos los valores, porque un tooltip
 * nunca puede ser la única forma de leer un dato: el `<title>` no aparece con
 * el teclado.
 *
 * **Los textos no van adentro del SVG.** Un `<text>` dentro de un viewBox que
 * se estira mide unidades de usuario, no píxeles: el mismo rótulo salía a 17px
 * en escritorio y a 5px en un teléfono. Los rótulos del eje y las etiquetas de
 * punta son HTML posicionado en porcentajes alrededor del dibujo, así que miden
 * siempre lo mismo (0,6875rem = 11px con la tipografía por defecto) y además
 * acompañan el tamaño de letra que la persona haya configurado en el navegador,
 * cosa que un `<text>` del SVG no hace.
 *
 * **Sobre qué superficie viven.** El anillo funciona sobre cualquiera: no pinta
 * fondo, el hueco entre porciones es la tarjeta vista a través del SVG. La
 * línea sí necesita saberlo, porque los puntos llevan un anillo del color de la
 * superficie para despegarse donde las dos curvas se tocan. Ese color sale de
 * `--fondo-grafico`, con `--paper` como valor por defecto: si estos gráficos se
 * meten en una tarjeta `bg-paper-2` —el gesto natural, los recuadros de dato
 * del tablero son así— esa tarjeta tiene que declarar
 * `--fondo-grafico: var(--paper-2)` o los marcadores quedan con un halo claro.
 *
 * No se anima nada. No es por `prefers-reduced-motion` —que igual quedaría
 * respetado—: es que una barra que crece sola no agrega ninguna información y
 * retrasa la lectura del número.
 */

import type { ResultadoConsulta } from "@/lib/repos/migue";

/* ==========================================================================
   Cosas compartidas
   ========================================================================== */

/**
 * Un color por resultado. Los mismos tokens que usa la tabla de consultas: si
 * el naranja quiere decir "sin respuesta" en el anillo, tiene que querer decir
 * lo mismo abajo.
 *
 * El saludo va en `null` y no es un olvido: no es una pregunta, queda fuera de
 * los gráficos. Está escrito igual para que se vea que la decisión se tomó.
 *
 * Los valores viven en globals.css (bloque claro y los dos bloques oscuros).
 * La paleta oscura no es la clara aclarada: en nocturno la banda de
 * luminosidad usable es angosta y la diferencia hay que pagarla con tono, por
 * eso el "índice" ahí es verde-azulado y no un celeste.
 */
const COLOR: Record<string, string | null> = {
  nota: "var(--grafico-nota)",
  indice: "var(--grafico-indice)",
  diario: "var(--grafico-diario)",
  saludo: null,
  sin_respuesta: "var(--grafico-alerta)",
};

/**
 * El color de la superficie sobre la que está el gráfico, para los recortes que
 * tienen que desaparecer contra el fondo. No es `--paper` a secas: eso ataría
 * el componente a una sola de las tres superficies del panel. La tarjeta que lo
 * contenga puede declarar `--fondo-grafico` y el gráfico la sigue.
 */
const FONDO = "var(--fondo-grafico, var(--paper))";

/** El orden de los segmentos del anillo y de la leyenda. Es fijo: el color
 *  sigue al resultado, nunca a su puesto en el ranking. Si un mes hay más
 *  "sin respuesta" que "nota", el naranja no se muda al primer lugar. */
const ORDEN: ResultadoConsulta[] = ["nota", "indice", "diario", "sin_respuesta"];

const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

const MESES_LARGOS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * "2026-08-28" → "28 ago".
 *
 * Se parte el texto a mano en vez de hacer `new Date(dia)`. No es capricho:
 * `new Date("2026-08-28")` se interpreta como medianoche UTC, y al formatearla
 * en la zona del navegador (Tucumán, UTC−3) da el 27. El día ya viene calculado
 * en hora de Tucumán del lado del servidor; volver a pasarlo por una zona
 * horaria sólo puede romperlo.
 */
function diaCorto(dia: string): string {
  const [, mes, num] = dia.split("-");
  return `${Number(num)} ${MESES[Number(mes) - 1] ?? ""}`;
}

/** "2026-08-28" → "28 de agosto". Para el texto que se lee en voz alta. */
function diaLargo(dia: string): string {
  const [, mes, num] = dia.split("-");
  return `${Number(num)} de ${MESES_LARGOS[Number(mes) - 1] ?? ""}`;
}

/** Una coordenada del viewBox pasada a porcentaje de la caja, para colgar los
 *  rótulos HTML del dibujo. Sirve porque el SVG va con `h-auto w-full`: el alto
 *  y el ancho renderizados son proporcionales al viewBox, así que un porcentaje
 *  cae siempre en el mismo punto del gráfico, mida lo que mida la pantalla. */
function enPorciento(valor: number, base: number): string {
  return `${((valor / base) * 100).toFixed(3)}%`;
}

/**
 * El techo del eje Y, redondeado a un número que se pueda decir.
 *
 * La condición que manda es que `techo / 2` —la marca del medio— sea entero:
 * el eje no puede decir "2,5 consultas". Por eso se descarta todo candidato
 * impar.
 *
 * Las bases 1,2 y 1,4 no son adorno ni las agregó un capricho: sin ellas no
 * había ningún candidato entre 10 y 20 —el 15 lo descarta el filtro de pares—,
 * así que cualquier mes con picos de 11 o 12 consultas por día se dibujaba
 * contra un techo de 20, o sea con la curva aplastada en la mitad de abajo del
 * área. Ésa es exactamente la escala de los primeros meses de Migue.
 *
 * Ninguna de las tres bases fraccionarias ensucia las magnitudes chicas: con
 * magnitud 1 dan 1,2 / 1,4 / 1,5 y el filtro de pares las descarta solas. El
 * 1,5 recién empieza a servir en el 150, donde la mitad cae en 75; sin él un
 * pico de 120 se dibujaría contra un techo de 200, con la mitad del gráfico
 * vacío.
 *
 * Con `max = 0` devuelve 1: sin esto la escala dividiría por cero y una serie
 * entera plana en cero saldría en NaN.
 */
function techoLindo(max: number): number {
  if (max <= 1) return 1;
  const magnitud = 10 ** Math.floor(Math.log10(max));
  for (const base of [1, 1.2, 1.4, 1.5, 2, 3, 4, 5, 6, 8, 10]) {
    const candidato = base * magnitud;
    if (candidato >= max && candidato % 2 === 0) return candidato;
  }
  return 10 * magnitud;
}

/* ==========================================================================
   A) La línea de actividad
   ========================================================================== */

/** Rótulo del eje y etiqueta de punta: siempre 11px, nunca unidades del SVG. */
const ROTULO = "font-sans text-[0.6875rem] leading-none";

/** Lo que se le reserva a los números del eje Y y a las etiquetas de punta, en
 *  píxeles. Tienen que coincidir con las clases `w-10` y `w-11` de abajo,
 *  porque entran en la cuenta del ancho mínimo. */
const ESPACIO_EJE_Y = 40;
const ESPACIO_PUNTAS = 44;

/** El mínimo para poder apuntarle a la columna de un día. */
const COLUMNA_MINIMA = 24;

/**
 * Actividad diaria: cuántas consultas hubo por día y cuántas quedaron sin
 * respuesta.
 *
 * **Dos series en un solo eje, no dos ejes.** Las dos miden lo mismo
 * —consultas— así que comparten escala sin inventar nada; un segundo eje con
 * su propia escala haría parecer que las curvas se cruzan o se separan cuando
 * eso sólo dependería de dónde arrancamos cada regla. Además "sin respuesta"
 * es un subconjunto de "total": que una vaya siempre por debajo de la otra es
 * información de verdad, y el espacio entre las dos es exactamente lo que
 * Migue sí supo contestar.
 *
 * El total va en tinta apagada y "sin respuesta" en color: la que importa es
 * la segunda, el total es el contexto que la hace legible. Quince sin
 * respuesta sobre veinte consultas es un desastre; sobre mil, no es nada.
 * Por eso el total no se lleva uno de los cuatro colores de resultado: no es
 * un resultado, es el denominador.
 */
export function LineaActividad({
  serie,
}: {
  serie: { dia: string; total: number; sinRespuesta: number }[];
}) {
  const n = serie.length;

  if (n === 0) {
    return (
      <p className="border border-hairline px-4 py-6 font-sans text-[0.8rem] text-ink-3">
        Todavía no hay días para graficar.
      </p>
    );
  }

  // Geometría del área de trazado, y nada más. El viewBox ya no reserva franjas
  // para los rótulos —esos son HTML y viven afuera del SVG—, así que acá adentro
  // sólo hay dibujo.
  const ANCHO = 720;
  const ALTO = 194;
  const IZQ = 12; // aire para el radio del primer punto, que si no queda cortado
  const DER = 708;
  const SUP = 10;
  const INF = 190; // línea de base

  const techo = techoLindo(
    Math.max(0, ...serie.map((d) => Math.max(d.total, d.sinRespuesta))),
  );
  const y = (v: number) => INF - (v / techo) * (INF - SUP);

  // Con un solo día no hay paso que calcular (dividiría por cero) y tampoco hay
  // línea que dibujar. Se lo pone en el centro y se lo estira 18px para cada
  // lado: así el área y el trazo existen, se ven, y el resto del código sigue
  // siendo el mismo.
  const centro = (IZQ + DER) / 2;
  const paso = n > 1 ? (DER - IZQ) / (n - 1) : 0;
  const x = (i: number) => (n > 1 ? IZQ + i * paso : centro);

  const puntos =
    n > 1
      ? serie.map((d, i) => ({ x: x(i), d }))
      : [
          { x: centro - 18, d: serie[0] },
          { x: centro + 18, d: serie[0] },
        ];

  const trazo = (campo: "total" | "sinRespuesta") =>
    puntos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${y(p.d[campo])}`).join(" ");

  const area = `${trazo("total")} L${puntos[puntos.length - 1].x} ${INF} L${puntos[0].x} ${INF} Z`;

  // Ancho mínimo del gráfico, en píxeles de verdad. La columna de hover de cada
  // día tiene que quedar en 24px o más —abajo de eso no se le puede apuntar—, y
  // la del primer y el último día valen `IZQ + paso/2` porque el borde del
  // viewBox les recorta la mitad de afuera. Si el contenedor no da ese ancho, el
  // gráfico se corre en horizontal como la tabla de consultas: achicarlo
  // cambiaría el tamaño del dibujo, nunca el del dedo.
  const columnaChica = n > 1 ? Math.min(paso, IZQ + paso / 2) : ANCHO;
  const anchoMinimo =
    Math.ceil((COLUMNA_MINIMA * ANCHO) / columnaChica) +
    ESPACIO_EJE_Y +
    ESPACIO_PUNTAS;

  // Las marcas del eje X: primera, última y un par en el medio. Treinta fechas
  // encimadas no se leen, y el gráfico no es un calendario.
  const salto = n > 1 ? Math.max(1, Math.ceil((n - 1) / 3)) : 1;
  const marcas: number[] = [];
  for (let i = 0; i < n - 1; i += salto) marcas.push(i);
  // La anteúltima marca se descarta si le queda pegada a la última.
  if (marcas.length && n - 1 - marcas[marcas.length - 1] < salto / 2) marcas.pop();
  if (n > 1) marcas.push(n - 1);
  if (n === 1) marcas.push(0);

  const ticksY = techo === 1 ? [0, 1] : [0, techo / 2, techo];

  const ultimo = serie[n - 1];
  const yTotal = y(ultimo.total);
  const ySin = y(ultimo.sinRespuesta);
  // Las dos etiquetas de punta no se apilan cuando las curvas se juntan:
  // separarlas a la fuerza las despega de su línea y se leen como ruido. Si
  // chocan gana la que importa, y la otra queda en la tabla.
  //
  // El umbral está en unidades del viewBox y las etiquetas miden 11px fijos,
  // así que la cuenta se hace en el caso más apretado: el gráfico en su ancho
  // mínimo, donde 1 unidad ≈ 1px. Más ancho, las curvas se separan y sobra.
  const chocan = Math.abs(yTotal - ySin) < 16;
  const rotularSin = ultimo.sinRespuesta > 0;
  const rotularTotal = !(chocan && rotularSin);

  const totalPeriodo = serie.reduce((s, d) => s + d.total, 0);
  const sinPeriodo = serie.reduce((s, d) => s + d.sinRespuesta, 0);
  const pico = serie.reduce((a, b) => (b.total > a.total ? b : a), serie[0]);

  const resumen =
    `Actividad diaria de ${n} ${n === 1 ? "día" : "días"}: ` +
    `${totalPeriodo} ${totalPeriodo === 1 ? "consulta" : "consultas"} en total, ` +
    `${sinPeriodo} sin respuesta. ` +
    (totalPeriodo > 0
      ? `El día de más movimiento fue el ${diaLargo(pico.dia)}, con ${pico.total}.`
      : "Ningún día tuvo consultas.");

  return (
    <figure className="m-0">
      {/* Dos series, así que la leyenda va sí o sí: la identidad de una curva
          no puede depender de acordarse de qué color era cuál. */}
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
        <ClaveLinea color="var(--ink-3)" texto="Consultas" />
        <ClaveLinea color="var(--grafico-alerta)" texto="Sin respuesta" />
      </ul>

      {/* El `pt-2` no es aire decorativo: los rótulos van centrados sobre su
          coordenada, así que el de arriba de todo asoma media línea por encima
          de la caja del dibujo y sin ese respiro el contenedor con `overflow-x`
          sacaría también una barra vertical. */}
      <div className="mt-2 overflow-x-auto pt-2">
        <div className="flex items-start" style={{ minWidth: `${anchoMinimo}px` }}>
          {/* Los números del eje y las etiquetas de punta se cuelgan de la caja
              del dibujo con `right-full` / `left-full`; estas dos columnas son
              el lugar donde caen. */}
          <div className="w-10 shrink-0" aria-hidden="true" />

          <div className="relative min-w-0 flex-1">
            <svg
              viewBox={`0 0 ${ANCHO} ${ALTO}`}
              className="block h-auto w-full"
              role="img"
              aria-label={resumen}
            >
              {/* Grilla recesiva: filete de 1px, sólido, un paso por encima del
                  fondo. Punteada leería como "proyección" y esto son datos.
                  El 0 queda afuera —aunque el eje Y sí muestre el número—:
                  ahí abajo ya pinta la línea de base, y las dos superpuestas
                  daban un filete de 1,5px y más oscuro que el resto. */}
              {ticksY
                .filter((v) => v !== 0)
                .map((v) => (
                  <line
                    key={v}
                    x1={IZQ}
                    x2={DER}
                    y1={y(v)}
                    y2={y(v)}
                    className="stroke-hairline"
                    strokeWidth={1}
                  />
                ))}

              {/* El área es un lavado del 10%, nunca un bloque saturado. */}
              <path d={area} fill="var(--ink-3)" fillOpacity={0.1} />
              <path
                d={trazo("total")}
                fill="none"
                stroke="var(--ink-3)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <path
                d={trazo("sinRespuesta")}
                fill="none"
                stroke="var(--grafico-alerta)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {/* Punta de cada serie, con anillo del color de la superficie para
                  que se distinga donde las dos curvas se tocan. */}
              <circle
                cx={x(n - 1)}
                cy={yTotal}
                r={4}
                fill="var(--ink-3)"
                stroke={FONDO}
                strokeWidth={2}
              />
              {rotularSin && (
                <circle
                  cx={x(n - 1)}
                  cy={ySin}
                  r={4}
                  fill="var(--grafico-alerta)"
                  stroke={FONDO}
                  strokeWidth={2}
                />
              )}

              {/* Capa de hover, sin JavaScript. Cada día tiene una columna
                  transparente de alto completo: el lector apunta a una fecha, no
                  a una línea de 2px, así que el blanco de la columna vale más que
                  el ancho del punto. El `<title>` es el que dice el número. */}
              {serie.map((d, i) => {
                const ancho = n > 1 ? paso : DER - IZQ;
                // Las columnas de las puntas se recortan contra el borde del
                // viewBox en vez de asomarse por afuera: media columna perdida
                // es mejor que una mitad invisible que igual no recibe el mouse.
                const x0 = Math.max(0, x(i) - ancho / 2);
                const x1 = Math.min(ANCHO, x(i) + ancho / 2);
                return (
                  <g key={d.dia} className="group">
                    <title>
                      {`${diaLargo(d.dia)}: ${d.total} ${
                        d.total === 1 ? "consulta" : "consultas"
                      }, ${d.sinRespuesta} sin respuesta`}
                    </title>
                    <rect
                      x={x0}
                      y={SUP}
                      width={x1 - x0}
                      height={INF - SUP}
                      fill="transparent"
                      pointerEvents="all"
                    />
                    <line
                      x1={x(i)}
                      x2={x(i)}
                      y1={SUP}
                      y2={INF}
                      className="stroke-line opacity-0 group-hover:opacity-100"
                      strokeWidth={1}
                      pointerEvents="none"
                    />
                    <circle
                      cx={x(i)}
                      cy={y(d.total)}
                      r={4}
                      fill="var(--ink-3)"
                      stroke={FONDO}
                      className="opacity-0 group-hover:opacity-100"
                      strokeWidth={2}
                      pointerEvents="none"
                    />
                    <circle
                      cx={x(i)}
                      cy={y(d.sinRespuesta)}
                      r={4}
                      fill="var(--grafico-alerta)"
                      stroke={FONDO}
                      className="opacity-0 group-hover:opacity-100"
                      strokeWidth={2}
                      pointerEvents="none"
                    />
                  </g>
                );
              })}

              <line
                x1={IZQ}
                x2={DER}
                y1={INF}
                y2={INF}
                className="stroke-line"
                strokeWidth={1}
              />
            </svg>

            {/* Todos los rótulos van con `aria-hidden`: el gráfico entero ya se
                anuncia con el `aria-label` del SVG y el dato exacto está en la
                tabla de abajo. Sueltos serían tres números y cuatro fechas sin
                contexto en medio de la lectura. */}
            {ticksY.map((v) => (
              <span
                key={v}
                aria-hidden="true"
                style={{ top: enPorciento(y(v), ALTO) }}
                className={`pointer-events-none absolute right-full mr-1.5 -translate-y-1/2 tabular-nums text-ink-3 ${ROTULO}`}
              >
                {v}
              </span>
            ))}

            {marcas.map((i) => (
              <span
                key={i}
                aria-hidden="true"
                style={{ left: enPorciento(x(i), ANCHO) }}
                className={`pointer-events-none absolute top-full mt-1.5 whitespace-nowrap text-ink-3 ${ROTULO} ${
                  n === 1 || (i !== 0 && i !== n - 1)
                    ? "-translate-x-1/2"
                    : i === 0
                      ? "translate-x-0"
                      : "-translate-x-full"
                }`}
              >
                {diaCorto(serie[i].dia)}
              </span>
            ))}

            {rotularTotal && (
              <span
                aria-hidden="true"
                style={{ top: enPorciento(yTotal, ALTO) }}
                className={`pointer-events-none absolute left-full ml-1.5 -translate-y-1/2 font-semibold tabular-nums text-ink-3 ${ROTULO}`}
              >
                {ultimo.total}
              </span>
            )}
            {rotularSin && (
              <span
                aria-hidden="true"
                style={{ top: enPorciento(ySin, ALTO) }}
                className={`pointer-events-none absolute left-full ml-1.5 -translate-y-1/2 font-semibold tabular-nums text-ink ${ROTULO}`}
              >
                {ultimo.sinRespuesta}
              </span>
            )}
          </div>

          <div className="w-11 shrink-0" aria-hidden="true" />
        </div>
        {/* La fila de fechas está posicionada por fuera de la caja del dibujo,
            así que no ocupa lugar: se lo reservamos acá. */}
        <div className="h-5" aria-hidden="true" />
      </div>

      {/* El gemelo en texto. El `<title>` del SVG no existe para el teclado ni
          para quien lee con lector de pantalla punto por punto, así que el dato
          exacto tiene que estar acá. Va plegado para no tapar el gráfico. */}
      <details className="mt-3 border-t border-hairline pt-2">
        <summary className="cursor-pointer font-sans text-[0.72rem] text-ink-3 hover:text-ink-2">
          Ver los números día por día
        </summary>
        <table className="mt-2 w-full border-collapse font-sans text-[0.75rem]">
          <caption className="sr-only">
            Consultas por día y cuántas quedaron sin respuesta
          </caption>
          <thead>
            <tr className="border-b border-hairline text-left">
              <th scope="col" className="py-1.5 pr-3 font-semibold text-ink-2">
                Día
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-semibold text-ink-2">
                Consultas
              </th>
              <th scope="col" className="py-1.5 text-right font-semibold text-ink-2">
                Sin respuesta
              </th>
            </tr>
          </thead>
          <tbody>
            {serie.map((d) => (
              <tr key={d.dia} className="border-b border-hairline last:border-0">
                <th scope="row" className="py-1 pr-3 font-normal text-ink-2">
                  {diaLargo(d.dia)}
                </th>
                <td className="py-1 pr-3 text-right tabular-nums text-ink">
                  {d.total}
                </td>
                <td className="py-1 text-right tabular-nums text-ink">
                  {d.sinRespuesta}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** La clave de la leyenda de una línea es una línea, no un cuadradito: repite
 *  la marca que hay en el gráfico. */
function ClaveLinea({ color, texto }: { color: string; texto: string }) {
  return (
    <li className="flex items-center gap-2 font-sans text-[0.75rem] text-ink-2">
      <span
        aria-hidden="true"
        className="h-0.5 w-4 shrink-0"
        style={{ backgroundColor: color }}
      />
      {texto}
    </li>
  );
}

/* ==========================================================================
   B) El anillo de resultados
   ========================================================================== */

/**
 * Cómo terminó cada consulta.
 *
 * Es un anillo y no un torta porque el agujero del medio es donde va el total,
 * que es el número que hace falta para leer cualquiera de las porciones. Y es
 * un anillo y no barras porque acá la pregunta es de parte-sobre-todo —"qué
 * proporción no supimos contestar"— con cuatro categorías, que es exactamente
 * el caso en el que un anillo se lee de un vistazo.
 *
 * La leyenda lleva etiqueta, número y porcentaje. No es redundancia: en modo
 * claro el celeste del "índice" queda por debajo de 3:1 contra el papel, y eso
 * sólo es aceptable si el dato se puede leer sin distinguir el color. La
 * leyenda es esa vía. Si alguna vez se saca, hay que oscurecer el celeste.
 *
 * El viewBox mide lo mismo que el ancho en pantalla, así que **una unidad es un
 * píxel** y todo lo que dicen los comentarios de acá abajo es literal. Antes el
 * dibujo era de 200 unidades metido en 164px: cada medida salía multiplicada
 * por 0,82 y el rótulo de "preguntas" terminaba en 9px, más chico que cualquier
 * otro rótulo del panel.
 */
export function AnilloResultados({
  datos,
}: {
  datos: { clave: string; etiqueta: string; valor: number }[];
}) {
  // Se ordena por el orden canónico, no por valor, y se dejan afuera las claves
  // sin color: hoy es sólo el saludo, que no es una pregunta y no tiene por qué
  // competir en el gráfico con las que sí lo son.
  const porClave = new Map(datos.map((d) => [d.clave, d]));
  const trozos = ORDEN.flatMap((clave) => {
    const d = porClave.get(clave);
    const color = COLOR[clave];
    if (!d || !color) return [];
    return [{ clave, etiqueta: d.etiqueta, valor: d.valor, color }];
  });

  const total = trozos.reduce((s, d) => s + d.valor, 0);

  const CAJA = 164;
  const CENTRO = CAJA / 2;
  const R = 62;
  const GROSOR = 22;
  const VUELTA = 2 * Math.PI * R;
  const HUECO = 2; // los 2px de superficie que separan un segmento del otro

  // Los que valen cero no se dibujan: un segmento de largo cero no es nada, y
  // la leyenda ya los nombra.
  const conValor = trozos.filter((d) => d.valor > 0);

  // El inicio de cada segmento es la suma de los anteriores, calculada sin
  // acumulador mutable: reasignar una variable adentro del `map` del render está
  // prohibido y además hacía que un segmento recortado por el mínimo se metiera
  // adentro del siguiente. Son cuatro porciones: la suma repetida no cuesta
  // nada. Con `total === 0` la lista está vacía y nunca se divide por cero.
  const segmentos = conValor.map((d, i) => {
    const inicio = conValor
      .slice(0, i)
      .reduce((s, previo) => s + (previo.valor / total) * VUELTA, 0);
    const largo = (d.valor / total) * VUELTA;
    // Sin mínimo artificial. Una consulta sobre mil trescientas mide 0,35px: la
    // raya de 1px que se dibujaba antes decía "acá hay algo del ancho de un
    // píxel" cuando no lo había, no se podía apuntar igual, y le robaba el lugar
    // al vecino. El dato no se pierde: la leyenda lo lleva con etiqueta, número
    // y porcentaje. Lo honesto es que la porción desaparezca del anillo.
    return { ...d, inicio, dash: Math.max(0, largo - HUECO) };
  });

  const leyenda = trozos.map((d) => ({
    ...d,
    porcentaje: total > 0 ? Math.round((d.valor / total) * 100) : 0,
  }));

  const resumen =
    total === 0
      ? "Cómo terminó cada consulta: todavía no hay preguntas para contar."
      : `Cómo terminó cada consulta, sobre ${total} ${
          total === 1 ? "pregunta" : "preguntas"
        }: ` +
        leyenda
          .map((d) => `${d.etiqueta}, ${d.valor} (${d.porcentaje} por ciento)`)
          .join("; ") +
        ".";

  return (
    <figure className="m-0 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <svg
        viewBox={`0 0 ${CAJA} ${CAJA}`}
        className="h-auto w-[164px] shrink-0"
        role="img"
        aria-label={resumen}
      >
        {/* La pista se dibuja sólo cuando no hay nada que contar: el anillo
            vacío dice "no hubo preguntas" mucho mejor que un hueco en la
            página. Con datos NO va, y es a propósito: una pista debajo se
            asomaría por los 2px de hueco entre porciones y el color del hueco
            sería --hairline, o sea un borde alrededor de cada marca esperando a
            que alguien oscurezca ese token. Sin pista, el hueco es el fondo de
            la tarjeta visto a través del SVG, sea cual sea esa superficie. */}
        {total === 0 && (
          <circle
            cx={CENTRO}
            cy={CENTRO}
            r={R}
            fill="none"
            className="stroke-hairline"
            strokeWidth={GROSOR}
          />
        )}

        {/* Rotado −90° para arrancar arriba, que es donde el ojo empieza. Los
            segmentos se dibujan con guiones sobre un mismo círculo. */}
        <g transform={`rotate(-90 ${CENTRO} ${CENTRO})`}>
          {segmentos.map((s) => (
            <circle
              key={s.clave}
              cx={CENTRO}
              cy={CENTRO}
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={GROSOR}
              strokeDasharray={`${s.dash} ${VUELTA - s.dash}`}
              strokeDashoffset={-s.inicio}
              strokeLinecap="butt"
            >
              <title>{`${s.etiqueta}: ${s.valor}`}</title>
            </circle>
          ))}
        </g>

        {/* El número del centro va con cifras proporcionales, sin tabular-nums:
            a este tamaño las cifras de ancho fijo hacen que un "121" se vea
            desarmado. La regla de la casa —tabulares— es para los números que
            se comparan en columna, y este no está en ninguna. */}
        <text
          x={CENTRO}
          y={total >= 1000 ? 82 : 80}
          textAnchor="middle"
          className="fill-ink font-sans text-[28px] font-bold"
        >
          {total}
        </text>
        <text
          x={CENTRO}
          y={100}
          textAnchor="middle"
          className="fill-ink-3 font-sans text-[11px]"
        >
          {total === 1 ? "pregunta" : "preguntas"}
        </text>
      </svg>

      <div className="min-w-0 flex-1">
        {total === 0 ? (
          <p className="font-sans text-[0.8rem] text-ink-3">
            Todavía no hay preguntas para contar. El anillo se llena solo cuando
            los vecinos empiecen a preguntar.
          </p>
        ) : (
          <ul className="w-full">
            {leyenda.map((d) => (
              <li
                key={d.clave}
                className="flex items-baseline gap-2.5 border-b border-hairline py-1.5 last:border-0"
              >
                <span
                  aria-hidden="true"
                  className="relative top-[1px] h-2.5 w-2.5 shrink-0"
                  style={{ backgroundColor: d.color }}
                />
                <span className="min-w-0 flex-1 font-sans text-[0.78rem] text-ink-2">
                  {d.etiqueta}
                </span>
                <span className="font-sans text-[0.8rem] font-semibold tabular-nums text-ink">
                  {d.valor}
                </span>
                <span className="w-10 text-right font-sans text-[0.72rem] tabular-nums text-ink-3">
                  {d.porcentaje}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </figure>
  );
}
