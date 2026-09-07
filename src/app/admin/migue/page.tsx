import Link from "next/link";
import {
  Bot,
  CalendarDays,
  CircleHelp,
  MessagesSquare,
  Target,
} from "lucide-react";
import { requerirAdmin } from "@/lib/auth/dal";
import {
  resumenMigue,
  type ResultadoEnTablero,
  type ResumenMigue,
} from "@/lib/repos/migue";
import { getIndice } from "@/lib/repos/edicion";
import { tiempoRelativo } from "@/lib/utils";
import { BotonActualizar } from "@/components/admin/boton-actualizar";
import { ConsultasMigue } from "@/components/admin/consultas-migue";
import {
  BannerPanel,
  SeccionPanel,
  TarjetaDato,
  TarjetaPanel,
} from "@/components/admin/piezas";
import {
  AnilloResultados,
  LineaActividad,
} from "@/components/admin/graficos-migue";

export const metadata = { title: "Migue" };

const NOMBRES: Record<ResultadoEnTablero, string> = {
  nota: "Respondidas con una nota",
  indice: "Pidieron el índice",
  diario: "Sobre el diario",
  saludo: "Saludos",
  leer: "Le leyó la página",
  sin_respuesta: "Sin respuesta",
  otro: "Otro resultado",
};

/**
 * Qué se cuenta como PREGUNTA.
 *
 * Ni el saludo ni la lectura en voz alta lo son, y por el mismo motivo: nadie
 * le pregunta "hola" al diario, y "leeme esto" no es una pregunta sino una
 * orden que Migue ejecutó. Contarlas infla la cobertura, que es exactamente lo
 * que ya pasó con la charla y hubo que deshacer. "otro" tampoco entra: no
 * sabemos qué es, y meter un desconocido en el denominador de la cobertura es
 * inventar precisión.
 */
const NO_SON_PREGUNTAS: ResultadoEnTablero[] = ["saludo", "leer", "otro"];

/**
 * Cuántas preguntas sin respuesta se ven sin desplegar nada.
 *
 * La lista viene ordenada por repeticiones, así que las primeras son las que de
 * verdad piden una nota; la cola son preguntas de una sola vez. Sin tope, con
 * quinientas consultas la pantalla se volvía un scroll interminable y el resto
 * del tablero —los gráficos, la tabla— quedaba a media hora de distancia.
 *
 * No se recorta el dato: la cola se pliega, no se tira. Son preguntas de vecinos
 * reales y siguen estando a un clic.
 */
const TOPE_SIN_RESPUESTA = 10;

/**
 * Cuántas de más se toleran antes de plegar. Con once preguntas, un "ver la
 * otra" es más ruido que ayuda: se muestran las once y listo.
 */
const GRACIA_SIN_RESPUESTA = 2;

/**
 * Tablero de Migue.
 *
 * La pantalla que importa sigue siendo **"Lo que no supimos contestar"**: cada
 * pregunta sin respuesta es un tema que los vecinos buscan y el diario no cubre
 * —o que cubre con palabras que nadie usa—. Es la lista de temas del mes que
 * viene, escrita por los lectores.
 *
 * Todo lo demás de esta pantalla existe para poder leer ese número. Sin saber
 * cuántas preguntas hubo, quince sin respuesta puede ser un desastre o ser
 * nada; sin ver la curva del mes, no se distingue una mala racha de una
 * tendencia. Por eso los gráficos van DESPUÉS de la lista y no antes: son el
 * contexto, no el titular. El rediseño de tablero no movió ese orden, y no
 * puede moverlo: en un tablero de tarjetas la tentación es poner los gráficos
 * arriba porque son lo que más se ve, y eso convertiría la pantalla en un
 * adorno.
 *
 * Ninguna tarjeta de acá se dibuja a mano: todas salen de
 * `@/components/admin/piezas`. Si una pantalla inventa su propio borde, su
 * propio radio y su propia sombra, el panel deja de leerse como un panel.
 *
 * **Acá NO se cuenta con qué está armado esto.** Había dos tarjetas arriba de
 * todo que decían con qué modelo contesta Migue, qué variable de entorno le
 * falta a esta máquina, cuántas consultas van en la hora y cuál es el tope. Se
 * fueron el 2026-09-07 y no vuelven: esta pantalla es para quien decide qué
 * nota escribir el mes que viene, y el nombre de un modelo o el nombre de una
 * variable no le sirven para eso —lo obligan a interpretar la infraestructura
 * para leer un número—. Eso ahora vive en `docs/informe-tecnico.md`, que es
 * donde lo busca quien de verdad lo necesita.
 */
export default async function AdminMigue() {
  await requerirAdmin();
  const [resumen, indice] = await Promise.all([resumenMigue(30), getIndice()]);
  const tituloDe = new Map(indice.map((n) => [n.slug, n.titulo]));

  const cuenta = (clave: ResultadoEnTablero) =>
    resumen.porResultado[clave] ?? 0;
  const sinRespuesta = cuenta("sin_respuesta");
  const preguntasReales = (Object.keys(NOMBRES) as ResultadoEnTablero[]).reduce(
    (suma, clave) =>
      NO_SON_PREGUNTAS.includes(clave) ? suma : suma + cuenta(clave),
    0,
  );
  const respondidas = preguntasReales - sinRespuesta;

  /* Se pliega sólo si sobran de verdad: con doce o menos se muestran todas,
     porque un "ver las otras dos" ocupa casi lo mismo que las dos. */
  const plegar =
    resumen.sinRespuesta.length > TOPE_SIN_RESPUESTA + GRACIA_SIN_RESPUESTA;
  const visiblesSinRespuesta = plegar
    ? resumen.sinRespuesta.slice(0, TOPE_SIN_RESPUESTA)
    : resumen.sinRespuesta;
  const restoSinRespuesta = plegar
    ? resumen.sinRespuesta.slice(TOPE_SIN_RESPUESTA)
    : [];

  const cobertura =
    preguntasReales > 0
      ? Math.round((respondidas / preguntasReales) * 100)
      : null;

  /* El anillo recibe TODOS los resultados con su nombre; adentro decide cuáles
     tienen color y cuáles no. Que la decisión viva en un solo lado evita que la
     pantalla y el gráfico digan cosas distintas. */
  const porResultado = (Object.keys(NOMBRES) as ResultadoEnTablero[])
    .map((clave) => ({
      clave,
      etiqueta: NOMBRES[clave],
      valor: cuenta(clave),
    }))
    .filter((d) => d.valor > 0);

  return (
    <>
      <BannerPanel
        titulo="Migue"
        bajada={
          <>
            Últimos 30 días · {resumen.total}{" "}
            {resumen.total === 1 ? "consulta" : "consultas"} ·{" "}
            <span className="text-panel-tinta-3">
              de todo el diario, incluido lo publicado
            </span>
          </>
        }
      >
        <BotonActualizar />
      </BannerPanel>

      {/* Una sola escalera de separación entre tarjetas, y es la misma que usan
          las otras pantallas del panel: `grid gap-6` afuera, `gap-4` adentro de
          cada fila. Con cada bloque eligiendo su propio `mt-` —o su propio
          `sm:gap-6`— dos secciones vecinas nunca respiran igual y el tablero se
          lee como una pila de pantallas sueltas. */}
      <div className="grid gap-6">
        {resumen.total === 0 ? (
          <TarjetaPanel>
            <p className="flex items-center gap-2.5 text-panel-base text-panel-tinta-2">
              <Bot
                className="h-4 w-4 shrink-0 text-panel-tinta-3"
                aria-hidden="true"
              />
              Todavía nadie le preguntó nada a Migue en este período.
            </p>
          </TarjetaPanel>
        ) : (
          <>
            {/* Las cuatro tarjetas de dato. El color del filete es decoración
                redundante y no dice nada que el título y la nota no digan: "Sin
                respuesta" se lee, no se deduce del naranja. */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
              <TarjetaDato
                icono={MessagesSquare}
                color="azul"
                titulo="Preguntas"
                valor={String(preguntasReales)}
                nota="Sin contar saludos ni lecturas en voz alta"
              />
              <TarjetaDato
                icono={Target}
                color="celeste"
                titulo="Cobertura"
                valor={cobertura === null ? "—" : `${cobertura}%`}
                nota="Preguntas que Migue supo contestar"
              />
              <TarjetaDato
                icono={CircleHelp}
                color="alerta"
                titulo="Sin respuesta"
                valor={String(sinRespuesta)}
                nota="Temas que el diario no cubre"
              />
              <TarjetaDato
                icono={CalendarDays}
                color="oro"
                titulo="Hoy"
                valor={String(resumen.hoy)}
                nota="Consultas de hoy, hora de Tucumán"
              />
            </div>

            {/* Lo que le da sentido al tablero entero, así que va primero y no
                escondido detrás de un gráfico. */}
            <SeccionPanel
              id="sin-respuesta"
              titulo="Lo que no supimos contestar"
              bajada="Cada línea es algo que un vecino buscó y el diario no tiene. Las que se repiten son las que más piden una nota. Se agrupan por texto: dos preguntas que dicen lo mismo con otras palabras van a aparecer separadas."
            >
              {resumen.sinRespuesta.length === 0 ? (
                <p className="text-panel-base text-panel-tinta-2">
                  Migue supo contestar todo. Por ahora.
                </p>
              ) : (
                <>
                  <ListaSinRespuesta preguntas={visiblesSinRespuesta} />
                  {restoSinRespuesta.length > 0 && (
                    /* La cola va plegada, no recortada: son preguntas de una
                       sola vez, que es justamente lo que no ayuda a decidir la
                       nota del mes que viene. Pero son datos de vecinos reales y
                       no se esconden — se corren de en medio.
                       `<details>` y no un botón con estado: es el mismo recurso
                       que usa el gráfico de actividad para su gemelo en texto, y
                       no necesita JavaScript ni convertir la pantalla en cliente. */
                    <details className="mt-3 border-t border-panel-borde pt-2">
                      <summary className="cursor-pointer font-sans text-panel-xs text-panel-tinta-3 hover:text-panel-tinta-2">
                        Ver las otras {restoSinRespuesta.length}
                      </summary>
                      <div className="mt-2">
                        <ListaSinRespuesta preguntas={restoSinRespuesta} />
                      </div>
                    </details>
                  )}
                </>
              )}
            </SeccionPanel>

            {/* Los dos gráficos, uno al lado del otro: la curva contesta
                "¿cuándo pasó?" y el anillo "¿cómo terminó?". Cada uno cuelga
                directo de su `SeccionPanel`, sin contenedor intermedio que les
                remape los colores: `graficos-migue.tsx` está escrito entero en
                `--panel-*` y usa `var(--panel-tarjeta)` como fondo por omisión,
                así que se pinta solo en los dos temas. */}
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] [&>*]:min-w-0">
              <SeccionPanel
                id="actividad"
                titulo="Actividad diaria"
                bajada="Consultas por día, y cuántas quedaron sin respuesta."
              >
                <LineaActividad serie={resumen.serie} />
              </SeccionPanel>

              <SeccionPanel
                id="resultados"
                titulo="Cómo terminó cada una"
                /*
                 * Dice {preguntasReales} y NO {resumen.total}, y la diferencia
                 * hay que declararla o la pantalla miente: el anillo deja afuera
                 * los saludos y las lecturas en voz alta —no son preguntas, y
                 * pintarlas las pondría a competir con las que sí miden si el
                 * diario cubre lo que la gente busca—. Sin esta línea el título
                 * prometía 11 y el anillo dibujaba 8.
                 */
                bajada={
                  <>
                    Sobre las {preguntasReales}{" "}
                    {preguntasReales === 1 ? "pregunta" : "preguntas"} del
                    período.
                    {resumen.total !== preguntasReales && (
                      <>
                        {" "}
                        Los saludos y las lecturas en voz alta quedan afuera.
                      </>
                    )}
                  </>
                }
              >
                <AnilloResultados datos={porResultado} />
              </SeccionPanel>
            </div>

            {/* El título de la tarjeta lo pone esta sección, y `ConsultasMigue`
                ya no trae el suyo: antes había dos encabezados pegados —"Las
                consultas, una por una" y "Todas las consultas"— que decían lo
                mismo. En la pantalla plana pasaban por redundancia; adentro de
                una tarjeta serían una tarjeta con dos títulos. */}
            <SeccionPanel
              id="consultas"
              titulo="Las consultas, una por una"
              bajada={
                <>
                  Qué preguntaron, cómo terminó y en qué página estaban parados.{" "}
                  <strong className="font-semibold text-panel-tinta-2">
                    Sin quién preguntó
                  </strong>
                  : eso no se guarda.
                </>
              }
            >
              <ConsultasMigue
                consultas={resumen.ultimas}
                titulos={Object.fromEntries(tituloDe)}
                total={resumen.total}
              />
            </SeccionPanel>

            {resumen.notasConsultadas.length > 0 && (
              <SeccionPanel
                id="mas-consultadas"
                titulo="Las notas por las que más preguntaron"
              >
                <ul className="-mx-4 divide-y divide-panel-borde border-y border-panel-borde sm:-mx-5">
                  {resumen.notasConsultadas.map((n) => (
                    <li
                      key={n.notaSlug}
                      className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-2.5 sm:px-5"
                    >
                      <Veces cuenta={n.veces} />
                      <span className="min-w-0 flex-1">
                        {tituloDe.has(n.notaSlug) ? (
                          <Link
                            href={`/admin/nota/${n.notaSlug}`}
                            className="text-panel-base leading-snug text-panel-tinta underline-offset-4 transition-colors hover:text-accent hover:underline"
                          >
                            {tituloDe.get(n.notaSlug)}
                          </Link>
                        ) : (
                          // La consulta sobrevive a que la nota se borre, así
                          // que puede haber slugs que ya no están.
                          <span className="font-mono text-panel-xs text-panel-tinta-3">
                            {n.notaSlug} (ya no está en la edición)
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </SeccionPanel>
            )}
          </>
        )}

        {/* Sin tarjeta y sin filete arriba: es el pie de la pantalla, no un
            dato más. Una tarjeta blanca le daría el mismo peso que a los
            números. */}
        <p className="px-1 text-panel-sm text-panel-tinta-3">
          El registro{" "}
          <strong className="font-semibold text-panel-tinta-2">
            no guarda quién preguntó
          </strong>
          . Sirve para saber qué falta cubrir, y para eso el texto y el
          resultado alcanzan.
        </p>
      </div>
    </>
  );
}

/**
 * El "3×" de las dos listas de ranking. Va en una pastilla hundida y no en
 * tinta suelta: es el único número de la fila y tiene que poder barrerse con el
 * ojo en vertical, sin leer el texto de al lado.
 *
 * No es la `Pildora` de `piezas.tsx` y no es un "casi igual" que habría que
 * unificar: la píldora rotula un ESTADO —un punto de color y una palabra, ancho
 * variable— y ésta es una columna de números. Lo que la define es el `min-w-9`
 * que le da a los tres dígitos un ancho fijo para que se apilen alineados; una
 * píldora que se estira con el texto no puede hacer eso.
 */
/**
 * La lista de preguntas sin respuesta.
 *
 * Es una pieza aparte porque se dibuja **dos veces** —las primeras y la cola
 * plegada— y las dos tienen que verse exactamente igual: si la cola se viera
 * distinta parecería otra cosa, y no la continuación de la misma lista.
 *
 * El negativo tiene que ser EXACTAMENTE el inset de la pieza, y el inset cambia
 * con el ancho (`p-4 sm:p-5`): con un `-mx-5` fijo, abajo de 640px los
 * separadores se pasaban 4px de la tarjeta. Una lista con los filetes cortados
 * —o asomándose— se lee como si le faltara algo al costado.
 */
function ListaSinRespuesta({
  preguntas,
}: {
  preguntas: ResumenMigue["sinRespuesta"];
}) {
  return (
    <ul className="-mx-4 divide-y divide-panel-borde border-y border-panel-borde sm:-mx-5">
      {preguntas.map((p) => (
        <li
          key={p.pregunta}
          className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-4 py-2 sm:px-5"
        >
          <Veces cuenta={p.veces} />
          <span className="min-w-0 flex-1 text-panel-base leading-snug text-panel-tinta">
            “{p.pregunta}”
          </span>
          <span className="text-panel-xs text-panel-tinta-3">
            {tiempoRelativo(p.ultima)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Veces({ cuenta }: { cuenta: number }) {
  return (
    <span className="inline-flex min-w-9 shrink-0 justify-center rounded-full bg-panel-tarjeta-2 px-2 py-0.5 text-panel-xs font-semibold tabular-nums text-panel-tinta-2">
      {cuenta}×
    </span>
  );
}
