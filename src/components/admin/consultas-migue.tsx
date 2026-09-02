"use client";

import { useId, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Search,
  ShieldCheck,
} from "lucide-react";
import type { ResultadoEnTablero, ResumenMigue } from "@/lib/repos/migue";
import { cn } from "@/lib/utils";
import {
  Aviso,
  ChipFiltro,
  Pildora,
  TABLA,
  ZonaDeTabla,
  clasesDeBoton,
  clasesDeBotonIcono,
  clasesDeCampo,
} from "@/components/admin/piezas";

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
/**
 * Cuántas filas se dibujan de entrada, y cuántas se suman cada vez.
 *
 * Existe porque la tabla dibujaba TODAS las filas que llegaban del servidor
 * —hasta 200— y eso es una tarjeta de diez mil píxeles de alto: el resto del
 * tablero quedaba abajo de un scroll interminable, que es exactamente el
 * problema que ya se había resuelto para "Lo que no supimos contestar".
 *
 * Treinta entra en una pantalla y media y es el tramo pedido.
 *
 * **Esto NO recorta el dato ni la búsqueda.** El buscador y los chips siguen
 * trabajando sobre las filas enteras que mandó el servidor, así que sus cuentas
 * siguen siendo exactas; lo único paginado es qué se pinta. Si esto filtrara
 * sobre lo dibujado, un chip diría 12 y al apretarlo aparecerían 40.
 */
const POR_PAGINA = 30;

/**
 * Qué números dibuja el paginado: los bordes, los vecinos de la actual, y un
 * hueco donde falten.
 *
 * Con dos páginas es "1 2" y sobra la ceremonia, pero con veinte es
 * "1 … 9 10 11 … 20" y no una fila de veinte botones que se va de la tarjeta.
 * Se escribe una vez acá y la pantalla no tiene que decidir nada.
 */
function tramosDePaginado(actual: number, total: number): (number | "hueco")[] {
  const cerca = [1, total, actual - 1, actual, actual + 1]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);
  const unicos = [...new Set(cerca)];
  const salida: (number | "hueco")[] = [];
  unicos.forEach((n, i) => {
    if (i > 0 && n - unicos[i - 1] > 1) salida.push("hueco");
    salida.push(n);
  });
  return salida;
}

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
  const [pagina, setPagina] = useState(1);

  /*
   * Buscar o cambiar de chip vuelve la ventana al principio.
   *
   * Sin esto, alguien que bajó hasta la fila 150 y después escribe en el
   * buscador se queda mirando un resultado de tres filas con la ventana en 150:
   * no se rompe nada, pero el botón de "mostrar más" desaparece y reaparece sin
   * motivo aparente. Una búsqueda nueva empieza arriba.
   *
   * Va acá y **no en un efecto que mire `busqueda` y `filtro`**: eso es
   * reaccionar a un cambio que este mismo componente provocó, o sea un render
   * de más y un estado a medias en el medio. La regla
   * `react-hooks/set-state-in-effect` lo marca, y tiene razón — el reset es
   * parte del evento, no una consecuencia que haya que observar.
   */
  function buscar(texto: string) {
    setBusqueda(texto);
    setPagina(1);
  }

  function filtrarPor(resultado: ResultadoEnTablero | null) {
    setFiltro(resultado);
    setPagina(1);
  }

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

  /*
   * Devuelve el cuerpo suelto y no un `<section>` con su título: vive adentro del
   * `SeccionPanel` de `/admin/migue`, que es el que pone la tarjeta, el `<h2>`
   * y el `aria-labelledby`. Antes acá había un segundo encabezado —"Todas las
   * consultas"— pegado al de la página, que decía lo mismo; en una pantalla
   * plana eso pasaba por redundancia, en una tarjeta serían dos títulos para
   * una sola caja. El "Todas" no se perdió: sigue siendo el primer chip, que es
   * donde de verdad significa algo.
   */
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));

  /*
   * La página que se muestra es DERIVADA, no el estado crudo.
   *
   * El estado guarda en qué página estás, pero la lista de abajo cambia de
   * tamaño con el buscador: si estabas en la 3 y escribís algo que deja seis
   * filas, la 3 no existe y la tabla saldría vacía con el paginado diciendo que
   * hay una sola página. Acotarlo acá lo resuelve sin un efecto que corrija el
   * estado después de haber dibujado mal.
   */
  const paginaActual = Math.min(pagina, totalPaginas);
  const primeraFila = (paginaActual - 1) * POR_PAGINA;

  const enPantalla = useMemo(
    () => filtradas.slice(primeraFila, primeraFila + POR_PAGINA),
    [filtradas, primeraFila],
  );

  /*
   * **Páginas numeradas, que REEMPLAZAN las filas.**
   *
   * Antes esto fue dos cosas peores, y las dos fallaron por lo mismo. Primero un
   * scroll infinito con IntersectionObserver: la tanda siguiente llegaba justo
   * cuando terminabas la anterior, así que bajando de corrido siempre acababas
   * con la lista entera dibujada. Después un botón de "mostrar más" que había que
   * apretar: el corte se veía, pero las filas se ACUMULABAN, o sea que a la
   * tercera vuelta volvías a tener un scroll interminable.
   *
   * Un paginado numerado no tiene ninguno de los dos problemas: la tarjeta mide
   * siempre lo mismo, se sabe cuántas páginas hay, y se puede volver a la 2 sin
   * recorrer la 1. Es lo que el usuario pidió después de ver las otras dos.
   *
   * Al cambiar de página se sube al principio de la tabla: sin eso, apretar "2"
   * desde el pie deja al lector parado en el final de una página nueva, mirando
   * las filas más viejas de un tramo que no vio empezar. Va sin desplazamiento
   * suave a propósito —un salto instantáneo no compite con `prefers-reduced-motion`
   * ni marea a nadie— y se ubica por el id que la tabla ya tiene.
   */
  function irA(destino: number) {
    setPagina(Math.min(Math.max(destino, 1), totalPaginas));
    document.getElementById(idTabla)?.scrollIntoView({ block: "start" });
  }

  return (
    /* Una sola escalera vertical para todo el cuerpo de la tarjeta, igual que
       la de las pantallas: antes eran cuatro `mt-` distintos (3, 3, 3, 4 y un 6
       para el vacío) elegidos de a uno, y cada bloque que se agregaba tenía que
       adivinar cuál le tocaba. Con el `gap` la separación es una decisión sola y
       los bloques condicionales —el aviso de recorte— no dejan hueco cuando no
       están. */
    <div className="grid gap-3">
      {/* Controles: una sola fila arriba de la tabla. Envuelve en pantallas
          angostas, pero es una fila. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="relative min-w-[13rem] flex-1 sm:max-w-xs">
          <label htmlFor={idBuscador} className="sr-only">
            Buscar en el texto de las preguntas
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-panel-tinta-3"
            aria-hidden="true"
          />
          {/* El aspecto lo pone `clasesDeCampo`, que es el mismo de todos los
              campos del panel —incluido el borde de control de 3:1 y la regla
              de nunca apagar el outline del foco—. Lo único propio es el
              `pl-9`, que le hace lugar a la lupa. La superficie es "tarjeta"
              porque el campo se apoya en la tarjeta blanca de la sección, así
              que el relleno del campo va hundido. */}
          <input
            id={idBuscador}
            type="search"
            value={busqueda}
            onChange={(e) => buscar(e.target.value)}
            placeholder="Buscar en las preguntas"
            className={cn(clasesDeCampo("tarjeta"), "pl-9")}
          />
        </div>

        {/* La separación de una fila de controles es la del token: es lo que
            necesita el anillo de foco para no dibujarse encima del vecino. */}
        <div className="flex flex-wrap gap-panel-controles">
          {/* Siguen siendo botones y no `como="enlace"`: este filtro NO vive en
              la URL —es en memoria, sobre las filas que ya llegaron— así que lo
              correcto es `aria-pressed`, no `aria-current`. La superficie es la
              de la tarjeta, que es el valor por omisión.

              "Todas" va sin `color` porque no identifica ningún resultado, así
              que no lleva punto. */}
          <ChipFiltro
            cuenta={porBusqueda.length}
            activo={filtro === null}
            onClick={() => filtrarPor(null)}
          >
            Todas
          </ChipFiltro>
          {/* El cajón de lo desconocido sólo se muestra si hay alguna: un chip
              "Otro resultado 0" es una pregunta sin respuesta para quien mira. */}
          {ORDEN.filter((r) => r !== "otro" || cuentas.otro > 0).map((r) => (
            <ChipFiltro
              key={r}
              cuenta={cuentas[r]}
              color={COLORES[r]}
              activo={filtro === r}
              onClick={() => filtrarPor(filtro === r ? null : r)}
            >
              {NOMBRES[r]}
            </ChipFiltro>
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
        className="font-sans text-panel-xs tabular-nums text-panel-tinta-3"
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

      {/* Los dos carteles son el `Aviso` del panel —el mismo que usan el
          tablero y ediciones—, hundidos dentro de la tarjeta (`sobre="tarjeta"`)
          porque acá no flotan sobre el gris de la página. Ninguno lleva `rol`:
          los dos ya estaban cuando cargó la pantalla, y anunciar todo es no
          anunciar nada. El del recorte va en el tono de aviso y el de la
          privacidad en el informativo, que es como los usan las otras
          pantallas. */}
      {recortada && (
        <Aviso icono={Info} tono="var(--grafico-diario)" sobre="tarjeta">
          Las últimas{" "}
          <strong className="tabular-nums text-panel-tinta">
            {NUMERO.format(consultas.length)}
          </strong>{" "}
          de{" "}
          <strong className="tabular-nums text-panel-tinta">
            {NUMERO.format(total)}
          </strong>{" "}
          · los chips y el buscador trabajan sobre estas{" "}
          <span className="tabular-nums">
            {NUMERO.format(consultas.length)}
          </span>
          . Los números de arriba del tablero —el anillo y la cabecera— son de
          las {NUMERO.format(total)}.
        </Aviso>
      )}

      <Aviso icono={ShieldCheck} tono="var(--grafico-nota)" sobre="tarjeta">
        No hay columna de quién preguntó porque{" "}
        <strong className="text-panel-tinta">el registro no lo guarda</strong>.
        Se anota la pregunta, cómo terminó y dónde estaba el lector; nada que
        permita armar el historial de consultas de una persona ante el
        municipio.
      </Aviso>

      {consultas.length === 0 ? (
        <p className="font-sans text-panel-base text-panel-tinta-2">
          Todavía no hay consultas registradas en este período.
        </p>
      ) : filtradas.length === 0 ? (
        // Dos vacíos distintos: "no hay nada" y "no hay nada que coincida" son
        // cosas diferentes y confundirlas manda a buscar un error que no existe.
        // Y un tercero: "no hay nada que coincida ENTRE LAS QUE TRAJIMOS", que
        // no es lo mismo que "no hay nada que coincida en el mes".
        <div className="rounded-panel-2 border border-panel-borde bg-panel-tarjeta-2 px-4 py-5 text-center">
          <p className="font-sans text-panel-base text-panel-tinta-2">
            {recortada
              ? `Ninguna de las ${NUMERO.format(consultas.length)} consultas que trae la tabla coincide con este filtro. Puede haber otras entre las ${NUMERO.format(total)} del período.`
              : `Ninguna de las ${NUMERO.format(total)} consultas coincide con este filtro.`}
          </p>
          {/*
           * **Es un botón y no un chip, y la diferencia no es de aspecto.** Acá
           * había una segunda cáscara de `ChipFiltro` escrita a mano —misma
           * píldora, mismo alto, mismo relleno— pero con otro hover
           * (`hover:border-accent` en vez del `hover:bg-panel-wash` del chip),
           * así que quieto se veía idéntico a los chips de tres centímetros más
           * arriba y con el mouse encima se veía distinto. Copiar una pieza y
           * cambiarle una cosa es peor que no copiarla: enseña que dos controles
           * iguales hacen cosas parecidas cuando en realidad hacen cosas
           * distintas.
           *
           * Y son distintas: un chip es un ESTADO —queda apretado, lleva
           * `aria-pressed`, sigue ahí después de tocarlo—, y esto es una ACCIÓN
           * que borra el estado de los otros y después desaparece con el cartel
           * que la contiene. Por eso va con la forma del botón —`rounded-panel-2`
           * en vez de la píldora— y no con la del chip. Que se distingan de un
           * vistazo es la mitad del arreglo.
           *
           * `tamano="chico"` conserva los 32px que ya tenía (el piso de WCAG
           * 2.5.8 es 24×24) y `sobre="hundida"` es el cartel del vacío, que es
           * `panel-tarjeta-2`: el relleno del botón sale el contrario, o sea
           * blanco, que es el que tenía. `secundario` y no `primario` porque es
           * la salida de un callejón, no la acción principal de la pantalla
           * —esa es "Actualizar", arriba—; el filete es el de control y no el de
           * tarjeta, que es el 3:1 que pide WCAG 1.4.11 y que la pieza ya trae.
           *
           * Se concatena y NO se pasa por `cn()`: `cn` es `twMerge` sin
           * configurar y se comería el `text-panel-sm` de la pieza (está
           * explicado en `piezas.tsx`, arriba de `BOTON_BASE`).
           */}
          <button
            type="button"
            onClick={() => {
              buscar("");
              filtrarPor(null);
            }}
            className={`${clasesDeBoton({
              tono: "secundario",
              tamano: "chico",
              sobre: "hundida",
            })} mt-3`}
          >
            Limpiar el filtro
          </button>
        </div>
      ) : (
        // La piel de la tabla sale entera de `TABLA`, que salió de acá: esta
        // era la tabla con el patrón bueno y `suscripciones/page.tsx` la había
        // copiado a mano (y ya se le había perdido el `text-left` del `<th>` en
        // el camino). Lo único que no está en la pieza es el ancho mínimo, que
        // es lo único que depende de cuántas columnas tiene cada tabla.
        //
        // `ZonaDeTabla` es el `<div>` que se desplaza con lo que lo hace
        // alcanzable ya puesto: `role="region"`, el nombre accesible y el
        // `tabIndex={0}`. Hace falta de verdad —la tabla mide 54rem y adentro no
        // hay un solo elemento enfocable, `Referencia` devuelve `span` y nunca
        // `a`, así que en un viewport angosto se ven dos columnas y sin foco no
        // hay manera de llegar a las otras con el teclado; Chrome 127+ hace
        // enfocables los scrollers sin hijos enfocables por su cuenta, Firefox y
        // Safari no—, y ahora lo trae la pieza en vez de estar escrito acá con
        // su `eslint-disable` al lado. El nombre describe la ZONA que se
        // desplaza, no la tabla: por eso va aparte y el `caption` sigue siendo
        // el de la tabla.
        <ZonaDeTabla
          id={idTabla}
          nombre="Tabla de consultas, más ancha que la pantalla: se desplaza al costado con las flechas."
        >
          <table className={`${TABLA.tabla} min-w-[54rem]`}>
            <caption className="sr-only">
              Consultas hechas a Migue, de la más reciente a la más vieja. Sin
              datos de quién preguntó: el registro no los guarda.
            </caption>
            <thead>
              {/* Sin clases: la banda de la cabecera vive en el `<th>`
                  (`TABLA.cabecera`), que embaldosa la fila entera igual. */}
              <tr>
                <Encabezado>Fecha y hora</Encabezado>
                <Encabezado>Resultado</Encabezado>
                <Encabezado>Dónde estaba</Encabezado>
                <Encabezado>Respondió con</Encabezado>
                <Encabezado>La pregunta</Encabezado>
              </tr>
            </thead>
            <tbody>
              {/* El resalte al pasar el mouse no es adorno: la tabla mide 54rem
                  y se lee desplazándose al costado, así que sin una banda que
                  siga al puntero es fácil saltar de fila a mitad de camino.
                  Como no es un control, no hay cursor de mano ni click.
                  `group` es lo único que se le agrega a la pieza, y es para que
                  la tinta apagada de la fila pueda subir junto con el fondo:
                  ver `Referencia` y la celda de la fecha, acá abajo. */}
              {enPantalla.map((c) => (
                <tr key={c.id} className={`${TABLA.fila} group`}>
                  {/* La fecha es un metadato y va en la tinta más apagada, pero
                      `panel-tinta-3` sobre el wash del hover mide 4,42:1 en
                      claro y 4,18:1 en oscuro: se cae abajo de AA justo mientras
                      el mouse está encima, que es cuando se la está leyendo. Es
                      el mismo defecto que ya tenía la cuenta del chip y se
                      arregla igual, subiendo un escalón con `group-hover`. Va
                      con `group-hover` y no con un `hover:` propio para que el
                      disparador sea la fila entera y no la celda. */}
                  <td
                    className={`${TABLA.celda} whitespace-nowrap text-panel-xs tabular-nums text-panel-tinta-3 group-hover:text-panel-tinta-2`}
                  >
                    {fechaCorta(c.fecha)}
                  </td>
                  <td className={`${TABLA.celda} whitespace-nowrap`}>
                    <Marca resultado={c.resultado} />
                  </td>
                  <td className={TABLA.celda}>
                    <Referencia slug={c.contextoSlug} titulos={titulos} />
                  </td>
                  <td className={TABLA.celda}>
                    <Referencia slug={c.notaSlug} titulos={titulos} />
                  </td>
                  {/* Acá la pregunta era lo único en serif de toda la tabla,
                      porque era lo único que se lee corrido. En el panel deja
                      de serlo: la serif es la voz del diario, y el layout dice
                      con todas las letras que esta pantalla no puede parecerse
                      a lo publicado. Sigue siendo lo más marcado de la fila,
                      pero por tinta y tamaño, no por cambiar de tipografía.
                      Pisar el tamaño y la tinta que la fila hereda de
                      `TABLA.tabla` es agregar dos clases y nada más, que es
                      justamente para lo que `TABLA.celda` es sólo geometría. */}
                  <td
                    className={`${TABLA.celda} min-w-[18rem] text-panel-base leading-snug text-panel-tinta`}
                  >
                    “{c.pregunta}”
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ZonaDeTabla>
      )}

      {totalPaginas > 1 && (
        <nav
          aria-label="Páginas de consultas"
          className="flex flex-wrap items-center gap-x-2 gap-y-2"
        >
          <button
            type="button"
            onClick={() => irA(paginaActual - 1)}
            disabled={paginaActual === 1}
            className={clasesDeBotonIcono({ sobre: "tarjeta" })}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          {tramosDePaginado(paginaActual, totalPaginas).map((tramo, i) =>
            tramo === "hueco" ? (
              /* El hueco es decorativo: lo que un lector de pantalla necesita
                 saber es en qué página está y cuántas hay, y eso lo dice el
                 aria-label de cada número y el anuncio de abajo. */
              <span
                key={"hueco-" + i}
                aria-hidden="true"
                className="px-1 text-panel-sm text-panel-tinta-3"
              >
                …
              </span>
            ) : (
              /* Es el chip del panel, el control que ya existe para "uno de un
                 conjunto está elegido", así que el paginado no inventa un
                 estilo. Lo único que se le pisa es la semántica: el chip pone
                 aria-pressed —que es de interruptor— y una página no se
                 aprieta, se está en ella. De ahí aria-current="page", que es lo
                 que un lector de pantalla anuncia como "página actual". */
              <ChipFiltro
                key={tramo}
                activo={tramo === paginaActual}
                superficie="tarjeta"
                onClick={() => irA(tramo)}
                aria-pressed={undefined}
                aria-current={tramo === paginaActual ? "page" : undefined}
                aria-label={"Página " + tramo}
                className="tabular-nums"
              >
                {tramo}
              </ChipFiltro>
            ),
          )}

          <button
            type="button"
            onClick={() => irA(paginaActual + 1)}
            disabled={paginaActual === totalPaginas}
            className={clasesDeBotonIcono({ sobre: "tarjeta" })}
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* Qué tramo se está viendo, en números. El paginado dice en qué
              página estás; esto dice de qué filas se trata, que es lo que hace
              falta para citarle una consulta a alguien. */}
          <p className="ml-auto text-panel-xs text-panel-tinta-3 tabular-nums">
            {primeraFila + 1}–{primeraFila + enPantalla.length} de{" "}
            {NUMERO.format(filtradas.length)}
          </p>
        </nav>
      )}

      {/*
        El anuncio de cuántas filas hay a la vista.
        Va SIEMPRE en el DOM, incluso cuando no quedan más: una región viva que
        aparece junto con su primer mensaje no se anuncia, porque el lector de
        pantalla no la tenía vigilada. Y va `polite` para que no interrumpa la
        lectura de una fila a mitad de camino.
      */}
      <p role="status" aria-live="polite" className="sr-only">
        {filtradas.length === 0
          ? "Ninguna consulta coincide."
          : `Página ${paginaActual} de ${totalPaginas}. Consultas ${primeraFila + 1} a ${primeraFila + enPantalla.length} de ${filtradas.length}.`}
      </p>
    </div>
  );
}

/** El encabezado de una columna. La piel es `TABLA.cabecera` —el peso, la
 *  superficie hundida y el filete que separa el encabezado de los datos, más el
 *  `text-left` que el `<th>` necesita sí o sí porque su centrado es una regla
 *  del navegador y le gana a lo heredado—. Lo único que sigue viviendo acá es el
 *  `scope="col"`, que es semántica y no piel. Sin versalitas ni tracking ancho:
 *  eso es la voz del diario impreso y acá es una herramienta de trabajo. */
function Encabezado({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className={TABLA.cabecera}>
      {children}
    </th>
  );
}

/**
 * La marca de resultado dentro de una fila: la `Pildora` del panel, con el
 * mismo punto y el mismo nombre que el chip del filtro tres centímetros más
 * arriba, para que la fila y el filtro se lean como lo mismo.
 *
 * Acá había una píldora escrita a mano, y tenía DOS formas para la misma marca:
 * las de color iban sin recuadro y la neutra con recuadro y otro relleno, así
 * que "Saludo" y "Sobre el diario" se leían como dos clases de cosa distintas.
 * `Pildora` tiene una sola cáscara y el `tono` en null quita el punto, que es
 * la diferencia que de verdad hay entre las dos.
 *
 * Nunca es sólo color: el punto pinta, el texto dice. Un dato que se distinga
 * únicamente por el color no lo lee ni alguien con daltonismo ni alguien
 * mirando en blanco y negro. Y un resultado que la pantalla no conoce cae en
 * "Otro resultado": el recuadro vacío no le decía a nadie que había un caso
 * nuevo en la base.
 *
 * `sobre="tarjeta"` porque la fila se apoya en la tarjeta blanca de la sección
 * —el resalte del hover es un wash, no una superficie—, así que a la píldora le
 * toca el relleno hundido.
 */
function Marca({ resultado }: { resultado: ResultadoEnTablero }) {
  const clave = claveDe(resultado);
  return (
    <Pildora tono={COLORES[clave]} sobre="tarjeta">
      {NOMBRES[clave]}
    </Pildora>
  );
}

/**
 * Un slug de nota mostrado como el título de la nota.
 *
 * Cuando el slug no está en el índice se muestra crudo y en mono, con la razón
 * al lado: la consulta sobrevive a que la nota se borre —para eso sirve, para
 * revisar qué se preguntaba sobre ella— así que un slug huérfano es esperable y
 * no un error.
 *
 * Los dos textos apagados suben un escalón con `group-hover`, por lo mismo que
 * la celda de la fecha: `panel-tinta-3` sobre el wash de la fila resaltada no
 * llega a 4,5:1. Sólo se renderiza adentro de una fila de esta tabla, que es la
 * que pone el `group`.
 */
function Referencia({
  slug,
  titulos,
}: {
  slug: string | null;
  titulos: Record<string, string>;
}) {
  if (!slug) {
    return (
      <span className="font-sans text-panel-xs text-panel-tinta-3 group-hover:text-panel-tinta-2">
        —
      </span>
    );
  }
  const titulo = titulos[slug];
  if (titulo) {
    return (
      <span className="font-sans text-panel-sm leading-snug text-panel-tinta-2">
        {titulo}
      </span>
    );
  }
  return (
    <span className="font-mono text-panel-xs leading-snug text-panel-tinta-3 group-hover:text-panel-tinta-2">
      {slug} <span className="font-sans">(ya no está en la edición)</span>
    </span>
  );
}
