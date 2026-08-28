import Link from "next/link";
import { HelpCircle, MessageSquare, Sparkles } from "lucide-react";
import { requerirAdmin } from "@/lib/auth/dal";
import { resumenMigue, type ResultadoEnTablero } from "@/lib/repos/migue";
import { migueTieneModelo, modeloDeMigue } from "@/lib/migue/openrouter";
import { consumoDeLaHora } from "@/lib/migue/tope";
import { getIndice } from "@/lib/repos/edicion";
import { tiempoRelativo } from "@/lib/utils";
import { BotonActualizar } from "@/components/admin/boton-actualizar";
import { ConsultasMigue } from "@/components/admin/consultas-migue";
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
 * contexto, no el titular.
 */
export default async function AdminMigue() {
  await requerirAdmin();
  const [resumen, indice, consumo] = await Promise.all([
    resumenMigue(30),
    getIndice(),
    consumoDeLaHora(),
  ]);
  const conModelo = migueTieneModelo();
  const tituloDe = new Map(indice.map((n) => [n.slug, n.titulo]));

  const cuenta = (clave: ResultadoEnTablero) => resumen.porResultado[clave] ?? 0;
  const sinRespuesta = cuenta("sin_respuesta");
  const preguntasReales = (
    Object.keys(NOMBRES) as ResultadoEnTablero[]
  ).reduce(
    (suma, clave) =>
      NO_SON_PREGUNTAS.includes(clave) ? suma : suma + cuenta(clave),
    0,
  );
  const respondidas = preguntasReales - sinRespuesta;
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
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-ink pb-4">
        <div className="min-w-0">
          <h1 className="font-sans text-[1.35rem] font-bold leading-tight text-ink">
            Migue
          </h1>
          <p className="mt-1 font-sans text-[0.8rem] text-ink-3">
            Últimos 30 días · {resumen.total}{" "}
            {resumen.total === 1 ? "consulta" : "consultas"} ·{" "}
            <span className="text-ink-2">
              de todo el diario, incluido lo publicado
            </span>
          </p>
        </div>
        <BotonActualizar />
      </div>

      {/*
       * Con qué está contestando **acá**, y por qué eso no es lo mismo que en
       * producción.
       *
       * Esta pantalla mezcla dos cosas que vienen de lugares distintos, y
       * decirlo importa: los números salen de la base, que es la misma que usa
       * el sitio publicado, así que son los de los lectores de verdad. El
       * cartel de abajo, en cambio, describe la máquina donde corre el panel —y
       * el panel sólo corre en local, porque /admin no existe en producción
       * mientras el login sea el mock.
       *
       * Sin esa aclaración el tablero dice "Sin modelo" con toda seguridad
       * mientras Migue contesta perfecto en el sitio, que es exactamente la
       * confusión que hubo.
       */}
      <p className="mt-4 inline-flex flex-wrap items-center gap-x-2 gap-y-1 border border-hairline px-2.5 py-1 font-sans text-[0.7rem] text-ink-2">
        {conModelo ? (
          <span>
            En esta computadora Migue responde con{" "}
            <code className="font-mono text-[0.68rem] text-ink">
              {modeloDeMigue()}
            </code>{" "}
            sobre las notas de la edición.
          </span>
        ) : (
          <span>
            En esta computadora no hay modelo: Migue responde con el buscador por
            palabras clave, porque falta{" "}
            <code className="font-mono text-[0.68rem] text-ink">
              OPENROUTER_API_KEY
            </code>{" "}
            en <code className="font-mono text-[0.68rem] text-ink">.env.local</code>.
          </span>
        )}
      </p>
      <p className="mt-1.5 font-sans text-[0.72rem] leading-relaxed text-ink-3">
        Eso describe <strong>esta máquina</strong>, no el sitio publicado: el
        panel sólo corre acá.{" "}
        {conModelo
          ? "En producción la clave se configura aparte, en Vercel."
          : "En producción la clave se configura en Vercel, y Migue puede estar contestando con el modelo aunque este cartel diga que no."}
      </p>

      {/*
       * El consumo de la hora sale de la base, que es la misma que usa el sitio
       * publicado: son consultas de verdad, no de esta máquina. Por eso se
       * muestra siempre y no sólo cuando ACÁ hay clave — esconderlo según la
       * configuración local era mezclar otra vez las dos cosas.
       */}
      <p className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-1 border border-hairline bg-paper-2 px-4 py-3 font-sans text-[0.8rem] text-ink-2">
        <span>
          Esta hora:{" "}
          <strong className="tabular-nums text-ink">{consumo.consultas}</strong>{" "}
          {consumo.consultas === 1 ? "consulta" : "consultas"} al modelo de{" "}
          <span className="tabular-nums">{consumo.topeGlobal}</span>, de{" "}
          <span className="tabular-nums">{consumo.personas}</span>{" "}
          {consumo.personas === 1 ? "persona" : "personas"}.
        </span>
        <span className="text-ink-3">
          Tope por persona: {consumo.topePersona} por hora. Pasarse no corta a
          Migue: sigue con el buscador.
        </span>
      </p>

      {resumen.total === 0 ? (
        <p className="mt-8 flex items-center gap-2.5 font-sans text-[0.85rem] text-ink-3">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Todavía nadie le preguntó nada a Migue en este período.
        </p>
      ) : (
        <>
          <dl className="mt-6 grid gap-px border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
            <Dato
              titulo="Preguntas"
              valor={String(preguntasReales)}
              nota="Sin contar saludos ni lecturas en voz alta"
            />
            <Dato
              titulo="Cobertura"
              valor={cobertura === null ? "—" : `${cobertura}%`}
              nota="Preguntas que Migue supo contestar"
            />
            <Dato
              titulo="Sin respuesta"
              valor={String(sinRespuesta)}
              nota="Temas que el diario no cubre"
              alerta={sinRespuesta > 0}
            />
            <Dato
              titulo="Hoy"
              valor={String(resumen.hoy)}
              nota="Consultas de hoy, hora de Tucumán"
            />
          </dl>

          {/* Lo que le da sentido al tablero entero, así que va primero y no
              escondido detrás de un gráfico. */}
          <section className="mt-9" aria-labelledby="sin-respuesta">
            <h2
              id="sin-respuesta"
              className="flex items-center gap-2 font-sans text-[0.95rem] font-bold text-ink"
            >
              <HelpCircle className="h-4 w-4 text-accent" aria-hidden="true" />
              Lo que no supimos contestar
            </h2>
            <p className="mt-1.5 max-w-2xl font-sans text-[0.8rem] leading-relaxed text-ink-3">
              Cada línea es algo que un vecino buscó y el diario no tiene. Las
              que se repiten son las que más piden una nota. Se agrupan por
              texto: dos preguntas que dicen lo mismo con otras palabras van a
              aparecer separadas.
            </p>

            {resumen.sinRespuesta.length === 0 ? (
              <p className="mt-4 font-sans text-[0.85rem] text-ink-3">
                Migue supo contestar todo. Por ahora.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-hairline border-y border-hairline">
                {resumen.sinRespuesta.map((p) => (
                  <li
                    key={p.pregunta}
                    className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3"
                  >
                    <span className="w-8 shrink-0 font-sans text-[0.8rem] font-semibold tabular-nums text-ink">
                      {p.veces}×
                    </span>
                    <span className="min-w-0 flex-1 font-serif text-[0.95rem] text-ink">
                      “{p.pregunta}”
                    </span>
                    <span className="font-sans text-[0.72rem] text-ink-3">
                      {tiempoRelativo(p.ultima)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Los dos gráficos, uno al lado del otro: la curva contesta "¿cuándo
              pasó?" y el anillo "¿cómo terminó?". Van sobre `paper`, que es el
              fondo del panel — ver la cabecera de graficos-migue.tsx. */}
          <div className="mt-9 grid gap-6 lg:grid-cols-[1fr_auto]">
            <section aria-labelledby="actividad">
              <h2
                id="actividad"
                className="font-sans text-[0.95rem] font-bold text-ink"
              >
                Actividad diaria
              </h2>
              <p className="mt-1.5 font-sans text-[0.8rem] text-ink-3">
                Consultas por día, y cuántas quedaron sin respuesta.
              </p>
              <LineaActividad serie={resumen.serie} />
            </section>

            <section aria-labelledby="resultados">
              <h2
                id="resultados"
                className="font-sans text-[0.95rem] font-bold text-ink"
              >
                Cómo terminó cada una
              </h2>
              {/*
               * Dice {preguntasReales} y NO {resumen.total}, y la diferencia
               * hay que declararla o la pantalla miente: el anillo deja afuera
               * los saludos y las lecturas en voz alta —no son preguntas, y
               * pintarlas las pondría a competir con las que sí miden si el
               * diario cubre lo que la gente busca—. Sin esta línea el título
               * prometía 11 y el anillo dibujaba 8.
               */}
              <p className="mt-1.5 font-sans text-[0.8rem] text-ink-3">
                Sobre las {preguntasReales}{" "}
                {preguntasReales === 1 ? "pregunta" : "preguntas"} del período.
                {resumen.total !== preguntasReales && (
                  <> Los saludos y las lecturas en voz alta quedan afuera.</>
                )}
              </p>
              <AnilloResultados datos={porResultado} />
            </section>
          </div>

          <section className="mt-9" aria-labelledby="consultas">
            <h2
              id="consultas"
              className="font-sans text-[0.95rem] font-bold text-ink"
            >
              Las consultas, una por una
            </h2>
            <p className="mt-1.5 max-w-2xl font-sans text-[0.8rem] leading-relaxed text-ink-3">
              Qué preguntaron, cómo terminó y en qué página estaban parados.{" "}
              <strong className="text-ink-2">Sin quién preguntó</strong>: eso no
              se guarda.
            </p>
            <ConsultasMigue
              consultas={resumen.ultimas}
              titulos={Object.fromEntries(tituloDe)}
              total={resumen.total}
            />
          </section>

          {resumen.notasConsultadas.length > 0 && (
            <section className="mt-9" aria-labelledby="mas-consultadas">
              <h2
                id="mas-consultadas"
                className="flex items-center gap-2 font-sans text-[0.95rem] font-bold text-ink"
              >
                <MessageSquare className="h-4 w-4 text-ink-3" aria-hidden="true" />
                Las notas por las que más preguntaron
              </h2>
              <ul className="mt-4 divide-y divide-hairline border-y border-hairline">
                {resumen.notasConsultadas.map((n) => (
                  <li
                    key={n.notaSlug}
                    className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3"
                  >
                    <span className="w-8 shrink-0 font-sans text-[0.8rem] font-semibold tabular-nums text-ink">
                      {n.veces}×
                    </span>
                    <span className="min-w-0 flex-1">
                      {tituloDe.has(n.notaSlug) ? (
                        <Link
                          href={`/admin/nota/${n.notaSlug}`}
                          className="font-sans text-[0.9rem] text-ink transition-colors hover:text-accent"
                        >
                          {tituloDe.get(n.notaSlug)}
                        </Link>
                      ) : (
                        // La consulta sobrevive a que la nota se borre, así que
                        // puede haber slugs que ya no están.
                        <span className="font-mono text-[0.78rem] text-ink-3">
                          {n.notaSlug} (ya no está en la edición)
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <p className="mt-10 border-t border-hairline pt-4 font-sans text-[0.75rem] leading-relaxed text-ink-3">
        El registro <strong className="text-ink-2">no guarda quién preguntó</strong>.
        Sirve para saber qué falta cubrir, y para eso el texto y el resultado
        alcanzan.
      </p>
    </>
  );
}

function Dato({
  titulo,
  valor,
  nota,
  alerta,
}: {
  titulo: string;
  valor: string;
  nota: string;
  alerta?: boolean;
}) {
  return (
    <div className="bg-paper px-5 py-4">
      <dt className="font-sans text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-ink-3">
        {titulo}
      </dt>
      <dd
        className={
          alerta
            ? "mt-1 font-sans text-[1.7rem] font-bold leading-none tabular-nums text-accent"
            : "mt-1 font-sans text-[1.7rem] font-bold leading-none tabular-nums text-ink"
        }
      >
        {valor}
      </dd>
      <p className="mt-1.5 font-sans text-[0.72rem] leading-snug text-ink-3">
        {nota}
      </p>
    </div>
  );
}
