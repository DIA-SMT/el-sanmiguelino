import Link from "next/link";
import { HelpCircle, MessageSquare, Sparkles } from "lucide-react";
import { requerirAdmin } from "@/lib/auth/dal";
import { resumenMigue } from "@/lib/repos/migue";
import { migueTieneModelo, modeloDeMigue } from "@/lib/migue/openrouter";
import { consumoDeLaHora } from "@/lib/migue/tope";
import { getIndice } from "@/lib/repos/edicion";
import { tiempoRelativo } from "@/lib/utils";

export const metadata = { title: "Migue" };

const NOMBRES: Record<string, string> = {
  nota: "Respondidas con una nota",
  indice: "Pidieron el índice",
  saludo: "Saludos",
  sin_respuesta: "Sin respuesta",
};

/**
 * Tablero de Migue.
 *
 * La pantalla que importa es **"Lo que no supimos contestar"**. El resto de los
 * números son contexto para leerla: sin saber cuántas preguntas hubo, quince
 * sin respuesta puede ser un desastre o ser nada.
 *
 * Cada pregunta sin respuesta es un tema que los vecinos buscan y el diario no
 * cubre —o que cubre con palabras que nadie usa—. Es la lista de temas del mes
 * que viene, escrita por los lectores.
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

  const respondidas =
    (resumen.porResultado.nota ?? 0) + (resumen.porResultado.indice ?? 0);
  const sinRespuesta = resumen.porResultado.sin_respuesta ?? 0;
  // El saludo no cuenta como pregunta: nadie le pregunta "hola" al diario.
  const preguntasReales = respondidas + sinRespuesta;
  const cobertura =
    preguntasReales > 0
      ? Math.round((respondidas / preguntasReales) * 100)
      : null;

  return (
    <>
      <div className="border-b border-ink pb-4">
        <h1 className="font-sans text-[1.35rem] font-bold leading-tight text-ink">
          Migue
        </h1>
        <p className="mt-1 font-sans text-[0.8rem] text-ink-3">
          Últimos 30 días · {resumen.total}{" "}
          {resumen.total === 1 ? "consulta" : "consultas"}
        </p>
        {/* Con qué está contestando. Importa para leer los números: el
            buscador por palabras clave falla mucho más que el modelo, así que
            una tanda de "sin respuesta" significa cosas distintas según cuál
            estuviera activo. */}
        <p className="mt-2 inline-flex items-center gap-2 border border-hairline px-2.5 py-1 font-sans text-[0.7rem] text-ink-2">
          {conModelo ? (
            <>
              Responde con{" "}
              <code className="font-mono text-[0.68rem] text-ink">
                {modeloDeMigue()}
              </code>{" "}
              sobre las notas de la edición
            </>
          ) : (
            <>
              Sin modelo: responde con el buscador por palabras clave. Falta{" "}
              <code className="font-mono text-[0.68rem] text-ink">
                OPENROUTER_API_KEY
              </code>
              .
            </>
          )}
        </p>
      </div>

      {conModelo && (
        <p className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-1 border border-hairline bg-paper-2 px-4 py-3 font-sans text-[0.8rem] text-ink-2">
          <span>
            Esta hora:{" "}
            <strong className="tabular-nums text-ink">
              {consumo.consultas}
            </strong>{" "}
            {consumo.consultas === 1 ? "consulta" : "consultas"} al modelo de{" "}
            <span className="tabular-nums">{consumo.topeGlobal}</span>, de{" "}
            <span className="tabular-nums">{consumo.personas}</span>{" "}
            {consumo.personas === 1 ? "persona" : "personas"}.
          </span>
          <span className="text-ink-3">
            Tope por persona: {consumo.topePersona} por hora. Pasarse no corta
            a Migue: sigue con el buscador.
          </span>
        </p>
      )}

      {resumen.total === 0 ? (
        <p className="mt-8 flex items-center gap-2.5 font-sans text-[0.85rem] text-ink-3">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Todavía nadie le preguntó nada a Migue en este período.
        </p>
      ) : (
        <>
          <dl className="mt-6 grid gap-px border border-hairline bg-hairline sm:grid-cols-3">
            <Dato
              titulo="Preguntas"
              valor={String(preguntasReales)}
              nota="Sin contar saludos"
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

/** Los nombres legibles de cada resultado, por si hacen falta al ampliar el
 *  tablero. Se dejan cerca de la pantalla que los usaría. */
export { NOMBRES };
