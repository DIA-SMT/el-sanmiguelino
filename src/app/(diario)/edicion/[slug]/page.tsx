import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { HojaDiario } from "@/components/hoja-diario";
import { Masthead } from "@/components/masthead";
import { SiteFooter } from "@/components/site-footer";
import { getIndiceDe, getPublicadas, getResumenEdicion } from "@/lib/repos/edicion";
import { numeroDeNota } from "@/lib/data/paginas";
import { seccionesDeEdicion } from "@/lib/data/secciones";
import { getUsuario } from "@/lib/auth/session";

/**
 * El sumario de un número: su foliado y sus titulares.
 *
 * **Vale para cualquier número, incluido el que está en la calle**, y eso es un
 * cambio. Antes esta dirección mandaba la edición del mes a `/diario` —"el
 * diario de verdad, con su paso de página"—, y la idea era razonable: quien
 * está leyendo el número en curso lo recorre pasando hoja, no mirando una lista.
 *
 * Lo que la falseó fue un lector. El paso de página hay que descubrirlo: son
 * dos flechas redondas al costado de la hoja y un gesto, y nada dice que del
 * otro lado haya ocho notas. La única lista que existía se llegaba por una
 * pestaña cuyo nombre sale del campo Sección de cada nota —o sea, texto que un
 * redactor escribe a mano— y decía "Edición impresa", que se lee como "acá está
 * el PDF escaneado". Un número con `tema` ni siquiera tenía esa: agosto está
 * publicado y no había forma de llegar a sus ocho páginas desde la barra.
 *
 * Así que el sumario pasa a ser una parada normal del diario: la pestaña
 * "Notas" apunta acá, y el selector de la barra trae a cualquier otro número.
 * La tapa sigue siendo `/diario` y el paso de página sigue estando; esto es una
 * puerta más, no un reemplazo.
 *
 * Sigue siendo a propósito que no replique la tapa completa. Un sumario es una
 * tabla de contenidos: quien entra viene a elegir una nota, no a leer la tapa
 * de nuevo. Y replicarla sería una segunda tapa que hay que mantener al día
 * con la primera.
 */
export default async function EdicionPage({
  params,
}: PageProps<"/edicion/[slug]">) {
  const usuario = await getUsuario();
  if (!usuario) redirect("/login");

  const { slug } = await params;
  const [enLaCalle, publicadas] = await Promise.all([
    getResumenEdicion(),
    getPublicadas(),
  ]);

  /*
   * Lo publicado, MÁS la que el diario esté sirviendo.
   *
   * Lo segundo no afloja nada: para un lector, la que se sirve es siempre una
   * publicada —es la misma que ve en `/diario`—. Sólo cambia algo para un
   * administrador con una edición EN FOCO, que es justo a quien la vista previa
   * tiene que dejar revisar el número entero antes de que salga. Sin esto, la
   * pestaña "Notas" —que ahora está en las cinco pantallas del diario— contesta
   * 404 durante toda la vista previa, porque `getPublicadas()` filtra por fecha
   * y la enfocada todavía no tiene.
   *
   * Es la misma regla que ya aplica `edicionesLegibles()`, y que `getIndiceDe()`
   * acá abajo respeta: el resumen no puede contestar distinto que el índice.
   */
  const edicion =
    publicadas.find((e) => e.slug === slug) ??
    (slug === enLaCalle.slug ? enLaCalle : undefined);
  if (!edicion) notFound();

  const esLaDeLaCalle = edicion.slug === enLaCalle.slug;
  const notas = await getIndiceDe(slug);

  /*
   * El foliado sale de `paginasDeEdicion()` y no de contar filas.
   *
   * Acá decía `Pág. {i + 2}`, que es la regla de una edición de notas
   * escritas: la portada es la 1 y la primera nota la 2. En un número
   * digitalizado la tapa del papel ES la página 1, así que esa cuenta corría
   * todo un lugar — y las tres ediciones que hay publicadas son digitalizadas,
   * o sea que el sumario del archivo venía numerando mal los tres números.
   * `paginas.ts` dice que el foliado del impreso y el del sitio tienen que
   * coincidir; este era el cuarto lugar que contestaba distinto.
   *
   * Se usa `numeroDeNota()` y no el índice del array: `paginasDeEdicion()` de
   * una edición de notas escritas antepone la portada, así que sus posiciones
   * no son las de `notas`.
   */
  const secciones = seccionesDeEdicion(notas);
  const hayVariasSecciones = secciones.length > 1;

  return (
    <HojaDiario numeroPagina={null}>
      <Masthead
        edicion={edicion}
        /* Las secciones van a la barra SÓLO si este es el número en la calle.
           `/seccion/<slug>` se resuelve siempre contra `getIndice()`, o sea
           contra la edición que se está sirviendo: las pestañas de un número
           del archivo llevarían a un 404 o —peor, si el nombre coincide— al
           listado de las notas del mes equivocado. La puerta a un número viejo
           es "Notas", que sí cuelga de su slug. Abajo `secciones` se sigue
           usando para la volanta, que ahí sí es del número del archivo. */
        secciones={esLaDeLaCalle ? secciones : []}
        usuario={usuario}
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <nav aria-label="Volver" className="mb-7">
          {/* De dónde se viene no es lo mismo en los dos casos: al sumario del
              número en curso se entra desde el diario, y al de uno viejo desde
              el archivo. */}
          <Link
            href={esLaDeLaCalle ? "/diario" : "/archivo"}
            className="group inline-flex items-center gap-2 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-3 transition-colors hover:text-accent"
          >
            <ArrowLeft
              className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-1"
              aria-hidden="true"
            />
            {esLaDeLaCalle ? `Portada de ${edicion.mes}` : "Archivo"}
          </Link>
        </nav>

        <header className="border-b-[3px] border-ink pb-4">
          <p className="volanta text-accent">
            {esLaDeLaCalle ? "En este número" : "Número del archivo"}
          </p>
          <h1 className="titular mt-2.5 text-[clamp(1.9rem,5.4vw,3.4rem)] text-ink">
            {edicion.mes}
          </h1>
          <p className="mt-2 font-sans text-[0.8rem] text-ink-3">
            N.º {edicion.numero} · {notas.length}{" "}
            {notas.length === 1 ? "nota" : "notas"}
            {edicion.etiqueta ? ` · ${edicion.etiqueta}` : ""}
            {/* El tema NO se repite acá: la barra de arriba ya lo muestra en
                itálica, y las dos cosas entran juntas en la misma pantalla. */}
          </p>
        </header>

        <ol className="mt-2 divide-y divide-hairline">
          {notas.map((nota) => (
            <li key={nota.slug} className="flex gap-5 py-5">
              <span className="w-12 shrink-0 pt-1 font-sans text-[0.72rem] uppercase tracking-[0.12em] tabular-nums text-ink-3">
                Pág. {numeroDeNota(notas, nota.slug)}
              </span>
              <div className="min-w-0 flex-1">
                {/* La volanta de sección sólo cuando distingue algo. En un
                    número digitalizado las ocho notas comparten el mismo valor
                    —sale del mismo campo para todas— y repetirlo ocho veces no
                    ubica nada: es ruido arriba de cada titular. */}
                {hayVariasSecciones && (
                  <p className="volanta text-accent">{nota.seccion}</p>
                )}
                <h2 className="titular mt-1.5 text-[1.35rem] text-ink">
                  <Link href={`/nota/${nota.slug}`} className="titular-link">
                    {nota.titulo}
                  </Link>
                </h2>
                <p className="mt-2 max-w-3xl font-serif text-[0.95rem] leading-relaxed text-ink-2">
                  {nota.bajada}
                </p>
                <p className="meta mt-2.5 inline-flex items-center gap-1.5">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {nota.minutosLectura} min
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <SiteFooter />
    </HojaDiario>
  );
}
