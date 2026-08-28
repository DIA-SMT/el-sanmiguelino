"use client";

import { useId, useMemo, useState } from "react";
import { Info, Search, ShieldCheck } from "lucide-react";
import type { ResultadoEnTablero, ResumenMigue } from "@/lib/repos/migue";

/**
 * Los nombres legibles de cada resultado. Están acá repetidos y no importados
 * del tablero a propósito: los del tablero están en plural porque rotulan un
 * conteo ("Respondidas con una nota"), y acá rotulan **una** fila. Compartir la
 * constante obligaría a elegir un número y una de las dos pantallas quedaría
 * mal escrita.
 *
 * `otro` no es un resultado que alguien escriba: es el cajón de los que la
 * pantalla todavía no conoce. En la base `resultado` es TEXTO y no enum
 * justamente para poder sumar casos sin una migración con lock, así que un
 * valor nuevo —"derivado", mañana— es algo esperable y no un error. Sin este
 * cajón la celda salía como un recuadro con filete y nada adentro.
 */
const NOMBRES: Record<ResultadoEnTablero, string> = {
  nota: "Respondida con una nota",
  indice: "Pidieron el índice",
  diario: "Sobre el diario",
  saludo: "Saludo",
  leer: "Le leyó la página",
  sin_respuesta: "Sin respuesta",
  otro: "Otro resultado",
};

/**
 * Un color por resultado, los mismos que usan los gráficos del tablero: si un
 * naranja quiere decir "sin respuesta" arriba, tiene que querer decir lo mismo
 * acá abajo o la pantalla enseña dos idiomas.
 *
 * El saludo no tiene color, y no es que falte: no es una pregunta, queda fuera
 * de los gráficos, y pintarlo lo pondría a competir con los que sí importan.
 * Va en tinta apagada. `otro` tampoco: no se le puede prometer un color a algo
 * que todavía no sabemos qué es.
 */
const COLORES: Record<ResultadoEnTablero, string | null> = {
  nota: "var(--grafico-nota)",
  indice: "var(--grafico-indice)",
  diario: "var(--grafico-diario)",
  saludo: null,
  /* Tampoco tiene color, y por el mismo motivo que el saludo: no es una
     pregunta que Migue contestó, es una orden que ejecutó. Que no compita en
     el gráfico con las que sí miden si el diario cubre lo que la gente busca. */
  leer: null,
  sin_respuesta: "var(--grafico-alerta)",
  otro: null,
};

/**
 * El orden de los chips: primero las tres formas de contestar, después lo que
 * no es una pregunta —el saludo y la lectura en voz alta—, después lo que falló
 * —que es lo que se busca— y al final el cajón de lo desconocido.
 *
 * **Están TODOS los resultados, y tiene que seguir siendo así.** Esta tabla
 * lista todas las consultas, así que si a esta lista le falta uno, sus filas
 * quedan sin chip y las cuentas de los chips dejan de sumar lo que dice
 * "Todas": el lector ve 11 arriba y 8 repartidos abajo, sin nada que explique
 * la diferencia. Pasó exactamente eso al sumar `leer`. El anillo del tablero sí
 * deja resultados afuera, pero ese es otro criterio y vive en su archivo.
 */
const ORDEN: ResultadoEnTablero[] = [
  "nota",
  "indice",
  "diario",
  "saludo",
  "leer",
  "sin_respuesta",
  "otro",
];

/**
 * El casillero del tablero al que va a parar un `resultado`.
 *
 * Todo lo que la pantalla no conoce cae en "otro" **antes** de contarse, y no
 * después: si cada texto nuevo se contara en su propia clave, los chips
 * dejarían de sumar lo que dice "Todas" y el "12 de 380" no cerraría. El borde
 * de tipos ya manda "otro" desde `migue.ts`, pero la columna es texto libre y
 * este es el único lugar donde una cadena inesperada puede entrar a la vista.
 */
function claveDe(resultado: string): ResultadoEnTablero {
  return resultado in NOMBRES ? (resultado as ResultadoEnTablero) : "otro";
}

/**
 * Fecha compacta para una tabla densa: "28/08, 14:32".
 *
 * La zona va fijada a Tucumán —no a la del navegador— porque el diario es de
 * acá y las horas se comparan entre sí.
 *
 * **El patrón se arma a mano y no se le pide a ICU.** Antes esto era un
 * `format()` con `day: "2-digit"` y `month: "2-digit"`, y ICU descarta ese
 * pedido cuando el skeleton también trae hora y minuto: `resolvedOptions()`
 * devuelve `numeric` y el 5 de septiembre salía "5/9, 08:03". Dos problemas.
 * Uno de forma: "5/9" y "28/10" no tienen la misma cantidad de dígitos, así que
 * la columna baila y `tabular-nums` no la salva. El otro es el serio: fijar la
 * zona y el locale garantiza el mismo INSTANTE de los dos lados, no el mismo
 * PATRÓN —el patrón lo elige el ICU de cada lado, y el node del servidor y el
 * ICU del navegador no son la misma versión—. Bastaba con que uno resolviera
 * `2-digit` y el otro `numeric` para tener disparidad de hidratación en TODAS
 * las filas. Con `formatToParts` y el relleno explícito, la cadena la escribe
 * este archivo y no la tabla de patrones de nadie.
 *
 * Por lo mismo va `hourCycle: "h23"` y no `hour12: false`: `hour12` deja que el
 * locale elija entre h23 y h24, y a las 00:15 h24 escribe "24:15".
 */
const PARTES_FECHA = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Tucuman",
  day: "numeric",
  month: "numeric",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

function fechaCorta(iso: string): string {
  const partes = new Map(
    PARTES_FECHA.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  const dia = (partes.get("day") ?? "").padStart(2, "0");
  const mes = (partes.get("month") ?? "").padStart(2, "0");
  const hora = (partes.get("hour") ?? "").padStart(2, "0");
  const minuto = (partes.get("minute") ?? "").padStart(2, "0");
  return `${dia}/${mes}, ${hora}:${minuto}`;
}

/** Los miles con punto, que es como se leen acá. El agrupado de números es lo
 *  único de `Intl` que esta pantalla sí le confía a ICU: no hay skeleton que
 *  negociar, "1.348" es "1.348" en cualquier versión. */
const NUMERO = new Intl.NumberFormat("es-AR");

/** Para buscar sin que el acento decida: "cuando" encuentra "cuándo". Se saca
 *  el diacrítico descomponiendo en NFD; nadie escribe con acento en un
 *  buscador. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * La tabla de consultas de Migue.
 *
 * **No tiene ninguna columna de datos personales, y eso no es una omisión de
 * diseño: no hay a quién mostrar.** El registro `ConsultaMigue` a propósito no
 * guarda quién preguntó (ver el comentario del modelo en `prisma/schema.prisma`
 * y "El registro no guarda quién preguntó" en `docs/panel-administracion.md`).
 * Atar cada pregunta a un vecino identificado convertiría un registro de
 * calidad en un historial de consultas de una persona ante el municipio. Por eso
 * la pantalla lo dice en voz alta en vez de dejar el hueco: quien mire la tabla
 * buscando la columna "usuario" tiene que encontrar la razón, no el vacío.
 *
 * **`consultas` puede venir recortada, y por eso hace falta `total`.**
 * `resumenMigue` corta la lista en 200 filas: en un mes de 1.348 consultas, la
 * cabecera y el anillo dicen 1.348 y esta tabla sabe de 200. Sin el total, la
 * misma pantalla mostraba dos universos distintos sin decir cuál era cuál —el
 * chip "Sin respuesta" en 31 tres centímetros abajo de una leyenda que decía
 * 137— y no había forma de saber que no era un error de cuentas. Con el total,
 * cada número dice de qué conjunto habla.
 *
 * **El filtrado es en memoria**, sobre las consultas que ya llegaron. No hay
 * fetch, no hay estado en la URL y no hay `useSearchParams`: con la URL de por
 * medio cada tecla del buscador sería una navegación —y una vuelta al
 * servidor—, y `useSearchParams` además obliga a envolver todo en un `Suspense`
 * para poder prerenderizar. Para el tamaño real de este registro no compra
 * nada.
 *
 * Hasta cuándo sirve: el tope de 200 filas ya es la primera señal de que este
 * diseño se está quedando corto —el buscador no ve el mes entero—. **El día que
 * haga falta buscar sobre las 1.348**, o mirar más de un mes, o compartir un
 * filtro por link, hay que paginar en el servidor con el filtro en la URL.
 */
export function ConsultasMigue({
  consultas,
  titulos,
  total,
}: {
  consultas: ResumenMigue["ultimas"];
  titulos: Record<string, string>;
  /** El total de la ventana de 30 días, que puede ser MAYOR que
   *  consultas.length porque la tabla viene recortada al tope. */
  total: number;
}) {
  const idBuscador = useId();
  const idTabla = useId();
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<ResultadoEnTablero | null>(null);

  /* `>` y no `!==`: si algún día el total llegara mal y fuera menor que lo que
   * hay en la mano, el cartel diría "las últimas 200 de 3", que es peor que no
   * decir nada. Recortado es solamente cuando faltan filas. */
  const recortada = total > consultas.length;

  const porBusqueda = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return consultas;
    return consultas.filter((c) => normalizar(c.pregunta).includes(q));
  }, [consultas, busqueda]);

  /*
   * Las cuentas de los chips se calculan sobre lo que quedó del buscador, no
   * sobre el total. Así cada chip promete lo que va a pasar si se lo aprieta:
   * si dice 3, quedan 3 filas. Contar sobre el total daría números que no
   * cierran con la tabla apenas hay algo escrito arriba.
   *
   * El `?? 0` no sobra aunque el objeto arranque con las seis claves en cero:
   * `resultado` es texto en la base, y antes un valor no previsto hacía
   * `undefined + 1` y dejaba la clave en NaN. Los cinco chips seguían contando
   * bien pero ya no sumaban lo que decía "Todas".
   */
  const cuentas = useMemo(() => {
    const m: Record<string, number> = {
      nota: 0,
      indice: 0,
      diario: 0,
      saludo: 0,
      sin_respuesta: 0,
      otro: 0,
    };
    for (const c of porBusqueda) {
      const clave = claveDe(c.resultado);
      m[clave] = (m[clave] ?? 0) + 1;
    }
    return m;
  }, [porBusqueda]);

  const filtradas = useMemo(
    () =>
      filtro
        ? porBusqueda.filter((c) => claveDe(c.resultado) === filtro)
        : porBusqueda,
    [porBusqueda, filtro],
  );

  const hayFiltro = busqueda.trim() !== "" || filtro !== null;

  return (
    <section aria-labelledby="consultas-migue">
      <h2
        id="consultas-migue"
        className="font-sans text-[0.95rem] font-bold text-ink"
      >
        Todas las consultas
      </h2>

      {/* Controles: una sola fila arriba de la tabla. Envuelve en pantallas
          angostas, pero es una fila. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="relative min-w-[13rem] flex-1 sm:max-w-xs">
          <label
            htmlFor={idBuscador}
            className="sr-only"
          >
            Buscar en el texto de las preguntas
          </label>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3"
            aria-hidden="true"
          />
          {/*
           * Sin `focus:outline-none`. En Tailwind v4 esa utilidad emite
           * `outline-style: none` —ya no el outline transparente de v3— y sale
           * en la capa `utilities`, que le gana al
           * `:focus-visible { outline: 2px solid var(--accent) }` de la capa
           * `base` sin importar la especificidad: al tabular hasta acá no
           * aparecía el anillo de acento que sí aparece en todos los demás
           * controles del panel. El borde de acento se queda porque suma; el
           * anillo lo pone la casa.
           */}
          <input
            id={idBuscador}
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en las preguntas"
            className="w-full border border-line bg-chrome py-1.5 pl-8 pr-2.5 font-sans text-[0.78rem] text-ink placeholder:text-ink-3 focus:border-accent"
          />
        </div>

        {/* gap-2 y no gap-1: el foco de la casa es un outline de 2px con 3px de
            offset, o sea 5px de sangrado por lado. Con 4px de separación el
            anillo del chip enfocado se metía adentro del vecino y, al envolver,
            se superponía con la fila de abajo. */}
        <div className="flex flex-wrap gap-2">
          <Chip
            nombre="Todas"
            cuenta={porBusqueda.length}
            color={null}
            activo={filtro === null}
            onClick={() => setFiltro(null)}
          />
          {/* El cajón de lo desconocido sólo se muestra si hay alguna: un chip
              "Otro resultado 0" es una pregunta sin respuesta para quien mira. */}
          {ORDEN.filter((r) => r !== "otro" || cuentas.otro > 0).map((r) => (
            <Chip
              key={r}
              nombre={NOMBRES[r]}
              cuenta={cuentas[r]}
              color={COLORES[r]}
              activo={filtro === r}
              onClick={() => setFiltro(filtro === r ? null : r)}
            />
          ))}
        </div>
      </div>

      {/*
       * El contador siempre dice "N de M", incluso sin filtro. Si sólo
       * apareciera al filtrar, ver 12 filas de 380 y no notar el cartel sería
       * un error de lectura caro. Es además la región viva: al filtrar, el
       * lector de pantalla escucha cuántas quedaron sin tener que recorrer la
       * tabla.
       *
       * Cuando la lista viene recortada el denominador **no** es el total del
       * mes, y eso se escribe con todas las letras en vez de dejarlo implícito:
       * el error que se está arreglando acá era exactamente ese, dos números
       * distintos para la misma cosa a tres centímetros uno del otro.
       */}
      <p
        aria-live="polite"
        className="mt-3 font-sans text-[0.72rem] tabular-nums text-ink-3"
      >
        {recortada ? (
          <>
            {NUMERO.format(filtradas.length)} de las{" "}
            {NUMERO.format(consultas.length)} que trae la tabla ·{" "}
            {NUMERO.format(total)} en los últimos 30 días
          </>
        ) : (
          <>
            {NUMERO.format(filtradas.length)} de {NUMERO.format(total)}{" "}
            {total === 1 ? "consulta" : "consultas"}
          </>
        )}
        {hayFiltro ? " · hay un filtro puesto" : ""}
      </p>

      {recortada && (
        <p className="mt-3 flex items-start gap-2 border border-line bg-paper-2 px-3 py-2 font-sans text-[0.72rem] leading-relaxed text-ink-2">
          <Info className="mt-px h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden="true" />
          <span>
            Las últimas{" "}
            <strong className="tabular-nums text-ink">
              {NUMERO.format(consultas.length)}
            </strong>{" "}
            de{" "}
            <strong className="tabular-nums text-ink">
              {NUMERO.format(total)}
            </strong>{" "}
            · los chips y el buscador trabajan sobre estas{" "}
            <span className="tabular-nums">
              {NUMERO.format(consultas.length)}
            </span>
            . Los números de arriba del tablero —el anillo y la cabecera— son de
            las {NUMERO.format(total)}.
          </span>
        </p>
      )}

      <p className="mt-3 flex items-start gap-2 border border-hairline bg-paper-2 px-3 py-2 font-sans text-[0.72rem] leading-relaxed text-ink-2">
        <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden="true" />
        <span>
          No hay columna de quién preguntó porque{" "}
          <strong className="text-ink">el registro no lo guarda</strong>. Se
          anota la pregunta, cómo terminó y dónde estaba el lector; nada que
          permita armar el historial de consultas de una persona ante el
          municipio.
        </span>
      </p>

      {consultas.length === 0 ? (
        <p className="mt-6 font-sans text-[0.85rem] text-ink-3">
          Todavía no hay consultas registradas en este período.
        </p>
      ) : filtradas.length === 0 ? (
        // Dos vacíos distintos: "no hay nada" y "no hay nada que coincida" son
        // cosas diferentes y confundirlas manda a buscar un error que no existe.
        // Y un tercero: "no hay nada que coincida ENTRE LAS QUE TRAJIMOS", que
        // no es lo mismo que "no hay nada que coincida en el mes".
        <div className="mt-6">
          <p className="font-sans text-[0.85rem] text-ink-3">
            {recortada
              ? `Ninguna de las ${NUMERO.format(consultas.length)} consultas que trae la tabla coincide con este filtro. Puede haber otras entre las ${NUMERO.format(total)} del período.`
              : `Ninguna de las ${NUMERO.format(total)} consultas coincide con este filtro.`}
          </p>
          <button
            type="button"
            onClick={() => {
              setBusqueda("");
              setFiltro(null);
            }}
            className="pressable mt-3 border border-line px-3 py-1.5 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ink-2 hover:border-ink hover:text-ink"
          >
            Limpiar el filtro
          </button>
        </div>
      ) : (
        // El desborde es de la tabla, no de la página: con el ancho suelto, en
        // un teléfono se scrollea el documento entero al costado y se pierde la
        // navegación del panel.
        //
        // `tabIndex={0}` + `role="region"` con nombre: la tabla mide 54rem y
        // adentro no hay un solo elemento enfocable —`Referencia` devuelve
        // `span`, nunca `a`—, así que en un viewport angosto se ven dos
        // columnas y no hay manera de llegar a las otras con el teclado.
        // Chrome 127+ hace enfocables los scrollers sin hijos enfocables por su
        // cuenta; Firefox y Safari no. Falla WCAG 2.1.1, y el arreglo del
        // navegador no es el arreglo de la página. El nombre accesible va
        // aparte y no en el `caption` porque describe la ZONA (que se
        // desplaza), no la tabla.
        <div
          role="region"
          aria-labelledby={idTabla}
          // La regla no conoce este caso: prohíbe `tabIndex` en lo no
          // interactivo para que nadie meta un `div` clickeable en el orden de
          // tabulación. Acá el elemento no hace nada al enfocarse, se enfoca
          // para poder DESPLAZARLO con las flechas, que es la excepción que la
          // propia APG recomienda para un `region` con scroll. Sacarlo es
          // cambiar un aviso de lint por una falla de WCAG 2.1.1 real.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          className="mt-4 overflow-x-auto border-y border-hairline"
        >
          <p id={idTabla} className="sr-only">
            Tabla de consultas, más ancha que la pantalla: se desplaza al
            costado con las flechas.
          </p>
          <table className="w-full min-w-[54rem] border-collapse">
            <caption className="sr-only">
              Consultas hechas a Migue, de la más reciente a la más vieja. Sin
              datos de quién preguntó: el registro no los guarda.
            </caption>
            <thead>
              <tr className="border-b border-hairline">
                <Encabezado>Fecha y hora</Encabezado>
                <Encabezado>Resultado</Encabezado>
                <Encabezado>Dónde estaba</Encabezado>
                <Encabezado>Respondió con</Encabezado>
                <Encabezado>La pregunta</Encabezado>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((c) => (
                <tr key={c.id} className="border-b border-hairline last:border-0">
                  <td className="whitespace-nowrap px-3 py-2.5 align-top font-sans text-[0.72rem] tabular-nums text-ink-3">
                    {fechaCorta(c.fecha)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-top">
                    <Marca resultado={c.resultado} />
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <Referencia slug={c.contextoSlug} titulos={titulos} />
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <Referencia slug={c.notaSlug} titulos={titulos} />
                  </td>
                  {/* Lo único que se lee corrido en toda la tabla, así que es lo
                      único en serif. */}
                  <td className="min-w-[18rem] px-3 py-2.5 align-top font-serif text-[0.9rem] leading-snug text-ink">
                    “{c.pregunta}”
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Encabezado({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="whitespace-nowrap px-3 py-2 text-left font-sans text-[0.64rem] font-semibold uppercase tracking-[0.12em] text-ink-3"
    >
      {children}
    </th>
  );
}

/**
 * El chip de un filtro.
 *
 * Nunca es sólo color: el punto pinta, el texto dice. Un chip que se distinga
 * únicamente por el color no lo lee ni alguien con daltonismo ni alguien
 * mirando en blanco y negro.
 *
 * **En reposo el borde es `line` y no `hairline`.** El filete da 1,26:1 contra
 * el papel en claro y 1,19:1 en oscuro: a esa distancia el chip no se ve como
 * un control, se ve como texto gris suelto. WCAG 1.4.11 pide 3:1 para el borde
 * que identifica un control.
 *
 * **El seleccionado se marca por forma, no por color.** Antes el estado era
 * sólo el borde en el color del resultado, y el del "índice" —celeste— da
 * 2,54:1 contra el papel en claro: el indicador de estado más importante era el
 * que menos se veía. Ahora el activo suma un `inset` de 2px y un fondo del
 * mismo color al 12%, que son diferencias de grosor y de área: se leen igual en
 * blanco y negro, con el monitor al mínimo o con el color desaturado.
 *
 * El fondo se arma con `color-mix` sobre el color del resultado en vez de usar
 * `accent-wash`: el wash es azul, y un chip naranja seleccionado con un fondo
 * azul dice dos cosas a la vez. El texto queda siempre en tinta y no en el
 * color: los colores están calibrados para dibujar sobre el papel, no para
 * leerse en 11px sobre él.
 */
function Chip({
  nombre,
  cuenta,
  color,
  activo,
  onClick,
}: {
  nombre: string;
  cuenta: number;
  color: string | null;
  activo: boolean;
  onClick: () => void;
}) {
  const trazo = color ?? "var(--ink)";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={
        activo
          ? "pressable inline-flex items-center gap-1.5 border px-2.5 py-1 font-sans text-[0.7rem] font-semibold text-ink"
          : "pressable inline-flex items-center gap-1.5 border border-line px-2.5 py-1 font-sans text-[0.7rem] text-ink-2 hover:border-ink hover:text-ink"
      }
      style={
        activo
          ? {
              borderColor: trazo,
              boxShadow: `inset 0 0 0 2px ${trazo}`,
              background: `color-mix(in srgb, ${trazo} 12%, transparent)`,
            }
          : undefined
      }
    >
      {color && (
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0"
          style={{ background: color }}
        />
      )}
      {nombre}
      <span className="tabular-nums text-ink-3">{cuenta}</span>
    </button>
  );
}

/** La marca de resultado dentro de una fila. Mismo punto y mismo nombre que el
 *  chip del filtro, para que la fila y el filtro se lean como lo mismo. Un
 *  resultado que la pantalla no conoce cae en "Otro resultado": el recuadro
 *  vacío no le decía a nadie que había un caso nuevo en la base. */
function Marca({ resultado }: { resultado: ResultadoEnTablero }) {
  const clave = claveDe(resultado);
  const color = COLORES[clave];
  return (
    <span
      className={
        color
          ? "inline-flex items-center gap-1.5 font-sans text-[0.72rem] text-ink-2"
          : "inline-flex items-center gap-1.5 border border-hairline px-1.5 font-sans text-[0.72rem] text-ink-3"
      }
    >
      {color && (
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0"
          style={{ background: color }}
        />
      )}
      {NOMBRES[clave]}
    </span>
  );
}

/**
 * Un slug de nota mostrado como el título de la nota.
 *
 * Cuando el slug no está en el índice se muestra crudo y en mono, con la razón
 * al lado: la consulta sobrevive a que la nota se borre —para eso sirve, para
 * revisar qué se preguntaba sobre ella— así que un slug huérfano es esperable y
 * no un error.
 */
function Referencia({
  slug,
  titulos,
}: {
  slug: string | null;
  titulos: Record<string, string>;
}) {
  if (!slug) {
    return <span className="font-sans text-[0.75rem] text-ink-3">—</span>;
  }
  const titulo = titulos[slug];
  if (titulo) {
    return (
      <span className="font-sans text-[0.78rem] leading-snug text-ink-2">
        {titulo}
      </span>
    );
  }
  return (
    <span className="font-mono text-[0.7rem] leading-snug text-ink-3">
      {slug}{" "}
      <span className="font-sans">(ya no está en la edición)</span>
    </span>
  );
}
