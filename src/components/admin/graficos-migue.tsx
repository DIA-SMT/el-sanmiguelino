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
 * siempre lo mismo —`text-panel-xs`, el escalón más chico de la escala del
 * panel— y además acompañan el tamaño de letra que la persona haya configurado
 * en el navegador, cosa que un `<text>` del SVG no hace.
 *
 * **Y salen de la escala `text-panel-*`, no de un número escrito a mano.** Este
 * archivo tenía once tamaños arbitrarios —0,6875 / 0,72 / 0,75 / 0,78 / 0,8rem
 * para textos que hacen lo mismo—, o sea cinco tamaños para tres jerarquías. Lo
 * único que sigue en píxeles son los dos `<text>` de adentro del anillo, y ahí
 * está escrito por qué.
 *
 * **Sobre qué superficie viven.** El anillo funciona sobre cualquiera: no pinta
 * fondo, el hueco entre porciones es la tarjeta vista a través del SVG. La
 * línea sí necesita saberlo, porque los puntos llevan un anillo del color de la
 * superficie para despegarse donde las dos curvas se tocan. Ese color sale de
 * `--fondo-grafico`, con `--panel-tarjeta` como valor por defecto: si estos
 * gráficos se meten en una tarjeta `bg-panel-tarjeta-2` esa tarjeta tiene que
 * declarar `--fondo-grafico: var(--panel-tarjeta-2)` o los marcadores quedan
 * con un halo del color equivocado.
 *
 * **Y de qué color es todo lo que no son datos.** La grilla, los ejes, los
 * rótulos, la tabla y la leyenda usan los tokens `--panel-*`, no los del
 * diario. No es prolijidad: `--hairline` y `--ink-3` son beige y tinta cálida,
 * calculados para papel crema, y sobre el gris azulado del panel se veían
 * sucios, como una mancha amarillenta. Los colores de los DATOS
 * —`--grafico-*`— sí siguen siendo los mismos: son la identidad de cada
 * resultado y tienen que querer decir lo mismo acá que en la tabla de abajo.
 *
 * **La paleta está revalidada contra las superficies nuevas** con el validador
 * de la skill `dataviz`, porque cambiaron las dos: en claro se validó sobre
 * papel crema (#fcfaf4) y ahora la tarjeta es blanca (#ffffff); en oscuro se
 * validó sobre #141922 y ahora la tarjeta es #161b24.
 *
 *   claro  (#0a5ce8 #22a7f5 #b8860b #c2410c) sobre #ffffff → todo PASA.
 *          Banda de luminosidad, piso de croma, separación daltónica (el peor
 *          par adyacente, naranja↔oro, ΔE 9,4 en deuteranopía) y piso de visión
 *          normal (ΔE 15,5). Único aviso: el celeste del "índice" da 2,65:1
 *          contra el blanco, abajo de 3:1.
 *   oscuro (#2570cc #30a5a6 #b98e1b #c83c25) sobre #161b24 → todo PASA, sin
 *          avisos: los cuatro pasan 3:1 y el peor par adyacente da ΔE 10,7.
 *
 * El aviso del celeste no es nuevo ni empeoró —sobre el papel crema daba 2,54:1
 * y sobre blanco da 2,65:1, o sea que mejoró— y ya tiene su compensación
 * escrita: la leyenda del anillo lleva etiqueta, número y porcentaje, así que
 * ninguna porción se lee sólo por el color. Si algún día se saca esa leyenda,
 * hay que oscurecer el celeste primero.
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
 * tienen que desaparecer contra el fondo. No se escribe `--panel-tarjeta` a
 * secas: eso ataría el componente a una sola de las superficies del panel. La
 * tarjeta que lo contenga puede declarar `--fondo-grafico` y el gráfico la
 * sigue; el valor por defecto es la tarjeta, que es donde viven hoy.
 */
const FONDO = "var(--fondo-grafico, var(--panel-tarjeta))";

/**
 * El guía vertical que aparece al pasar el mouse por una columna.
 *
 * No es `--panel-borde`: ése es el filete de la grilla, y el guía tiene que
 * ganarle para que se vea cuál columna se está mirando. Tampoco es
 * `--panel-tinta-3` entero, que competiría con las dos curvas. El panel tiene
 * un solo token de filete —el diario tenía dos, `--hairline` y `--line`—, así
 * que el escalón del medio se arma acá, rebajando la tinta apagada.
 *
 * Queda en #abb0bc sobre la tarjeta clara (2,17:1) y en #535b6a sobre la
 * oscura (2,53:1). La grilla da 1,23:1 y 1,26:1, y las curvas 4,97:1 y 5,36:1:
 * el guía queda justo en el medio, que es donde tiene que estar.
 */
const GUIA = "color-mix(in srgb, var(--panel-tinta-3) 55%, transparent)";

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

/**
 * Rótulo del eje y etiqueta de punta: siempre en unidades de la página, nunca
 * en unidades del SVG.
 *
 * Es `text-panel-xs` y no los 0,6875rem que decía antes a mano. La diferencia
 * es medio píxel, y a cambio el texto más chico del gráfico es exactamente el
 * mismo que el de la cabecera de una tabla y el de una píldora, en vez de un
 * sexto tamaño que sólo existe acá.
 *
 * `leading-none` sigue mandando sobre el interlineado del escalón: en Tailwind
 * v4 el `text-*` deja el suyo detrás de `--tw-leading`, así que la clase de
 * interlineado lo pisa sin importar en qué orden estén escritas. Hace falta
 * porque estos rótulos van centrados sobre una coordenada y un interlineado de
 * 1,35 los correría de su marca.
 */
const ROTULO = "font-sans text-panel-xs leading-none";

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
 * El total va en tinta apagada (`--panel-tinta-3`) y "sin respuesta" en color:
 * la que importa es la segunda, el total es el contexto que la hace legible.
 * Quince sin respuesta sobre veinte consultas es un desastre; sobre mil, no es
 * nada. Por eso el total no se lleva uno de los cuatro colores de resultado: no
 * es un resultado, es el denominador. La tinta apagada es lo bastante fuerte
 * para un trazo de 2px —4,97:1 contra la tarjeta clara, 5,36:1 contra la
 * oscura, y hace falta 3:1— sin robarle la atención a la curva que sí importa.
 */
export function LineaActividad({
  serie,
}: {
  serie: { dia: string; total: number; sinRespuesta: number }[];
}) {
  const n = serie.length;

  if (n === 0) {
    return (
      // `rounded-panel-2` es el radio de lo que se apoya DENTRO de una tarjeta,
      // que es donde vive este cartel. Los 0,5rem que decía antes no eran
      // ningún escalón: quedaban 1,6px por debajo del vecino más parecido.
      <p className="rounded-panel-2 border border-panel-borde bg-panel-tarjeta-2 px-4 py-6 font-sans text-panel-sm text-panel-tinta-3">
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
        <ClaveLinea color="var(--panel-tinta-3)" texto="Consultas" />
        <ClaveLinea color="var(--grafico-alerta)" texto="Sin respuesta" />
      </ul>

      {/* El `pt-2` no es aire decorativo: los rótulos van centrados sobre su
          coordenada, así que el de arriba de todo asoma media línea por encima
          de la caja del dibujo y sin ese respiro el contenedor con `overflow-x`
          sacaría también una barra vertical. */}
      {/*
       * `min-w-0` no es decoración: sin él este envoltorio no scrollea nunca.
       *
       * El hijo de abajo declara un ancho mínimo (unos 800px) para que cada día
       * conserve su columna de 24px de área sensible. Pero un hijo de grid o de
       * flex arranca con `min-width: auto`, o sea que se NIEGA a encogerse por
       * debajo de su contenido: la columna del grid crecía hasta 804px, la
       * grilla entera pasaba de 1078 a 1268, y el panel terminaba con 158px de
       * desplazamiento horizontal en una pantalla de 1440. El `overflow-x-auto`
       * estaba puesto y no se usaba, porque nunca había nada que recortar.
       *
       * Con `min-w-0` el envoltorio puede achicarse hasta lo que le den y el
       * scroll pasa a ser suyo, que es donde tiene que estar: se desplaza el
       * gráfico, no la página.
       */}
      <div className="mt-2 min-w-0 overflow-x-auto pt-2">
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
                    className="stroke-panel-borde"
                    strokeWidth={1}
                  />
                ))}

              {/* El área es un lavado del 10%, nunca un bloque saturado. */}
              <path d={area} fill="var(--panel-tinta-3)" fillOpacity={0.1} />
              <path
                d={trazo("total")}
                fill="none"
                stroke="var(--panel-tinta-3)"
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
                fill="var(--panel-tinta-3)"
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
                      stroke={GUIA}
                      className="opacity-0 group-hover:opacity-100"
                      strokeWidth={1}
                      pointerEvents="none"
                    />
                    <circle
                      cx={x(i)}
                      cy={y(d.total)}
                      r={4}
                      fill="var(--panel-tinta-3)"
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

              {/* La línea de base. Va del mismo filete que la grilla y no de
                  uno más oscuro como antes: el diario tenía dos tokens de
                  filete (`--hairline` y `--line`) y el panel tiene uno solo.
                  No se pierde nada —el eje no es un dato, es el marco— y de
                  paso queda como lo dibujan los tableros que copiamos: grilla y
                  ejes al mismo peso, un escalón sobre la superficie. */}
              <line
                x1={IZQ}
                x2={DER}
                y1={INF}
                y2={INF}
                className="stroke-panel-borde"
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
                className={`pointer-events-none absolute right-full mr-1.5 -translate-y-1/2 tabular-nums text-panel-tinta-3 ${ROTULO}`}
              >
                {v}
              </span>
            ))}

            {marcas.map((i) => (
              <span
                key={i}
                aria-hidden="true"
                style={{ left: enPorciento(x(i), ANCHO) }}
                className={`pointer-events-none absolute top-full mt-1.5 whitespace-nowrap text-panel-tinta-3 ${ROTULO} ${
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
                className={`pointer-events-none absolute left-full ml-1.5 -translate-y-1/2 font-semibold tabular-nums text-panel-tinta-3 ${ROTULO}`}
              >
                {ultimo.total}
              </span>
            )}
            {rotularSin && (
              <span
                aria-hidden="true"
                style={{ top: enPorciento(ySin, ALTO) }}
                className={`pointer-events-none absolute left-full ml-1.5 -translate-y-1/2 font-semibold tabular-nums text-panel-tinta ${ROTULO}`}
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
      <details className="mt-3 border-t border-panel-borde pt-2">
        <summary className="cursor-pointer font-sans text-panel-xs text-panel-tinta-3 hover:text-panel-tinta-2">
          Ver los números día por día
        </summary>
        {/* La tabla va un escalón MÁS GRANDE que el rótulo que la despliega
            —`text-panel-sm` contra `text-panel-xs`—, que es la misma relación
            que tienen `TABLA.tabla` y `TABLA.cabecera` en las tablas del panel.
            Antes eran casi el mismo tamaño (0,72 y 0,75rem), y esto no es un
            apéndice del gráfico: es el único camino al dato exacto para quien
            no puede leer el dibujo, así que si alguno de los dos textos tiene
            que ser el chico, es el rótulo. */}
        <table className="mt-2 w-full border-collapse font-sans text-panel-sm">
          <caption className="sr-only">
            Consultas por día y cuántas quedaron sin respuesta
          </caption>
          <thead>
            <tr className="border-b border-panel-borde text-left">
              <th scope="col" className="py-1.5 pr-3 font-semibold text-panel-tinta-2">
                Día
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-semibold text-panel-tinta-2">
                Consultas
              </th>
              <th scope="col" className="py-1.5 text-right font-semibold text-panel-tinta-2">
                Sin respuesta
              </th>
            </tr>
          </thead>
          <tbody>
            {serie.map((d) => (
              <tr key={d.dia} className="border-b border-panel-borde last:border-0">
                <th scope="row" className="py-1 pr-3 font-normal text-panel-tinta-2">
                  {diaLargo(d.dia)}
                </th>
                <td className="py-1 pr-3 text-right tabular-nums text-panel-tinta">
                  {d.total}
                </td>
                <td className="py-1 text-right tabular-nums text-panel-tinta">
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
    <li className="flex items-center gap-2 font-sans text-panel-sm text-panel-tinta-2">
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
 * claro el celeste del "índice" da 2,65:1 contra la tarjeta blanca, por debajo
 * de 3:1, y eso sólo es aceptable si el dato se puede leer sin distinguir el
 * color. La leyenda es esa vía. Si alguna vez se saca, hay que oscurecer el
 * celeste. (En oscuro no hace falta: ahí los cuatro pasan 3:1 contra la
 * tarjeta. Ver la cabecera del archivo para la validación completa.)
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
            sería --panel-borde, o sea un borde alrededor de cada marca
            esperando a que alguien oscurezca ese token. Sin pista, el hueco es
            el fondo de la tarjeta visto a través del SVG, sea cual sea esa
            superficie. */}
        {total === 0 && (
          <circle
            cx={CENTRO}
            cy={CENTRO}
            r={R}
            fill="none"
            className="stroke-panel-borde"
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
            se comparan en columna, y este no está en ninguna.

            **Estos dos son los únicos tamaños del archivo que NO salen de la
            escala `text-panel-*`, y es a propósito.** Son los dos textos que
            viven ADENTRO del SVG, y ahí un tamaño en `rem` no hace lo mismo que
            en la página: el `rem` sigue la letra que la persona configuró en el
            navegador, pero el agujero del anillo mide 164px fijos y no la
            sigue. Con la letra al 150% un `text-panel-xl` se comería el rótulo
            de abajo y con el 200% se saldría del anillo. En píxeles los dos
            quedan clavados a la geometría que los contiene, que es de lo único
            que dependen. Es la contracara de la decisión de la cabecera del
            archivo: lo que puede ser HTML es HTML y sí acompaña la letra del
            navegador; lo que no puede, se ata al dibujo.

            Y el 28px tampoco tendría escalón: el mayor de la escala es 22px, y
            este es el número que hace legible a todas las porciones. Es el
            mismo caso que el número de `TarjetaDato`, que por lo mismo va en
            `text-3xl`: no es texto, es un dato mostrado, y hay uno solo. */}
        <text
          x={CENTRO}
          y={total >= 1000 ? 82 : 80}
          textAnchor="middle"
          className="fill-panel-tinta font-sans text-[28px] font-bold"
        >
          {total}
        </text>
        <text
          x={CENTRO}
          y={100}
          textAnchor="middle"
          className="fill-panel-tinta-3 font-sans text-[11px]"
        >
          {total === 1 ? "pregunta" : "preguntas"}
        </text>
      </svg>

      <div className="min-w-0 flex-1">
        {total === 0 ? (
          <p className="font-sans text-panel-sm text-panel-tinta-3">
            Todavía no hay preguntas para contar. El anillo se llena solo cuando
            los vecinos empiecen a preguntar.
          </p>
        ) : (
          <ul className="w-full">
            {leyenda.map((d) => (
              <li
                key={d.clave}
                className="flex items-baseline gap-2.5 border-b border-panel-borde py-1.5 last:border-0"
              >
                {/* La esquina apenas redondeada no es adorno: en el panel no
                    hay una sola esquina recta, y un cuadradito de 10px con
                    punta viva al lado de tarjetas de 12px de radio se lee como
                    de otro juego.

                    Los 2px son el único radio del archivo que no es un escalón,
                    y no hay escalón que sirva: el más chico de los tres
                    (`rounded-panel-3`) mide 7,2px, y sobre un cuadrado de 10px
                    eso ya no es una esquina redondeada, es un círculo. La marca
                    de la leyenda tiene que repetir la forma del segmento del
                    anillo, que es un arco de punta recta. */}
                <span
                  aria-hidden="true"
                  className="relative top-[1px] h-2.5 w-2.5 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: d.color }}
                />
                <span className="min-w-0 flex-1 font-sans text-panel-sm text-panel-tinta-2">
                  {d.etiqueta}
                </span>
                <span className="font-sans text-panel-sm font-semibold tabular-nums text-panel-tinta">
                  {d.valor}
                </span>
                <span className="w-10 text-right font-sans text-panel-xs tabular-nums text-panel-tinta-3">
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
