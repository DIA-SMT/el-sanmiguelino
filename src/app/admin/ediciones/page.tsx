import { CalendarClock, CalendarOff, Newspaper } from "lucide-react";
import { FilaEdicion, type EdicionFila } from "@/components/admin/fila-edicion";
import { NuevaEdicion } from "@/components/admin/nueva-edicion";
import { Aviso, BannerPanel, TarjetaDato } from "@/components/admin/piezas";
import { requerirAdmin } from "@/lib/auth/dal";
import { edicionEnFoco } from "@/lib/auth/vista-previa";
import { db } from "@/lib/db";
import { aHoraTucuman, textoHoraTucuman } from "@/lib/fecha-edicion";

export const metadata = { title: "Ediciones" };

/**
 * Las ediciones y cuándo sale cada una.
 *
 * **El cambio de mes no lo dispara nada.** La edición que se sirve es la más
 * reciente cuya fecha ya pasó, y eso se calcula en cada request. No hay trabajo
 * programado que pueda no correr el día 1, ni bandera que alguien tenga que dar
 * vuelta: si el sitio está en pie, sirve la edición correcta.
 *
 * "Verla en el diario" pone una edición en foco y el **diario entero** se la
 * muestra —tapa, notas, buscador, Migue—, con el mismo código que ve el lector.
 * Una vista previa dibujada aparte te muestra que todo está bien y el día que
 * sale aparece el problema igual.
 *
 * Los tres datos de arriba y el filete de cada tarjeta usan **los mismos tres
 * colores para los mismos tres estados** —en la calle, programada, sin fecha—,
 * y en los tres lugares el color va acompañado de su palabra. El color acá no
 * informa: agrupa. Quien no lo distingue lee exactamente lo mismo.
 */
/**
 * Un minuto, por la digitalización.
 *
 * Las Server Actions corren con el presupuesto de la página que las invoca, y
 * `digitalizarEdicionAction` se dispara desde acá: baja el PDF del bucket, lo
 * parsea, decodifica cada foto, la recodifica en WebP y la sube. Medido contra
 * el número de agosto —8 páginas A3, 29 imágenes— son 4,9 segundos, pero un
 * número de 24 páginas es el triple de trabajo y el default de Vercel lo
 * cortaría por la mitad, dejando la edición a medio escribir.
 */
export const maxDuration = 60;

export default async function AdminEdiciones() {
  await requerirAdmin();
  const [filas, digitalizadas, notasDelSistema, enFoco] = await Promise.all([
    db().edicion.findMany({
      orderBy: [{ anio: "desc" }, { numero: "desc" }],
      include: { _count: { select: { notas: true } } },
    }),
    /*
     * Cada fila de `notas` del sistema, con su edición, si es página de un PDF
     * y cuántos comentarios tiene. De acá salen las cuatro cuentas que la ficha
     * necesita, en UNA consulta.
     *
     * Hacen falta las cuatro y ninguna se deriva de otra:
     *
     * - **notas escritas** aparte del total, porque en un número publicado como
     *   facsímil cada página del PDF también es una fila de `notas` (ver
     *   `Nota.pdfPagina`): el total diría "12 notas" sobre una edición que no
     *   tiene ninguna escrita;
     * - **comentarios de toda la edición**, que es lo que se pierde al borrarla;
     * - **comentarios de las notas escritas**, que es lo que se pierde si el
     *   número pasa a publicarse como PDF.
     *
     * Sin el cuerpo ni el texto plano: son cuentas, no contenido.
     */
    /*
     * Cuántas páginas de cada edición están DIGITALIZADAS.
     *
     * Va como consulta aparte y no como un campo más de la de arriba porque lo
     * que distingue una página digitalizada de una que no lo está es que tenga
     * cuerpo, y traer el cuerpo de cada nota del sistema para contar cuáles no
     * están vacías sería traerse el diario entero. `textoPlano` sirve igual —es
     * exactamente el cuerpo aplanado— y un `groupBy` lo resuelve sin mover
     * texto.
     */
    db().nota.groupBy({
      by: ["edicionId"],
      where: { pdfPagina: { not: null }, textoPlano: { not: "" } },
      _count: { _all: true },
    }),
    db().nota.findMany({
      select: {
        edicionId: true,
        pdfPagina: true,
        _count: { select: { comentarios: true } },
      },
    }),
    edicionEnFoco(),
  ]);

  const escritas = new Map<string, number>();
  const comentarios = new Map<string, number>();
  const comentariosEscritos = new Map<string, number>();
  for (const nota of notasDelSistema) {
    const suma = (mapa: Map<string, number>, cuanto: number) =>
      mapa.set(nota.edicionId, (mapa.get(nota.edicionId) ?? 0) + cuanto);
    suma(comentarios, nota._count.comentarios);
    if (nota.pdfPagina === null) {
      suma(escritas, 1);
      suma(comentariosEscritos, nota._count.comentarios);
    }
  }

  const ahora = new Date();

  /*
   * Las ediciones que el diario PUEDE servir: fecha ya cumplida y algo que
   * mostrar. De la más nueva a la más vieja.
   *
   * Es la misma regla que usa el repo para elegir la edición que sale
   * —`publicaEn <= ahora` más `TIENE_CONTENIDO`—, y ahora sí: antes esta
   * pantalla filtraba **sólo por fecha** aunque el comentario dijera que se
   * calculaba igual. La diferencia se veía: una edición con fecha cumplida y sin
   * notas quedaba marcada "En la calle" en el panel, mientras el diario se la
   * salteaba y servía la anterior. El panel decía una cosa y el lector veía
   * otra.
   *
   * De acá salen las dos cosas que hacen falta, así no hay dos reglas que se
   * puedan separar de nuevo:
   * - `publicada`, la que ve el lector: la primera;
   * - si queda UNA sola, borrarla dejaría el sitio sin ningún número y la
   *   portada tiraría error, así que la ficha apaga el botón (y la acción lo
   *   vuelve a comprobar por su cuenta, que es donde de verdad importa).
   */
  const servibles = filas
    .filter(
      (e) =>
        e.publicaEn &&
        e.publicaEn <= ahora &&
        (e._count.notas > 0 || e.pdfUrl !== null),
    )
    .sort((a, b) => b.publicaEn!.getTime() - a.publicaEn!.getTime());

  const publicada = servibles[0];

  const ediciones: EdicionFila[] = filas.map((e) => ({
    slug: e.slug,
    mes: e.mes,
    numero: e.numero,
    anio: e.anio,
    etiqueta: e.etiqueta,
    publicaEnLocal: e.publicaEn ? aHoraTucuman(e.publicaEn) : "",
    publicaEnTexto: e.publicaEn ? textoHoraTucuman(e.publicaEn) : null,
    tema: e.tema,
    notas: e._count.notas,
    notasEscritas: escritas.get(e.id) ?? 0,
    comentarios: comentarios.get(e.id) ?? 0,
    comentariosEscritos: comentariosEscritos.get(e.id) ?? 0,
    laUnicaServible:
      servibles.length === 1 && servibles[0].id === e.id,
    pdf:
      e.pdfUrl && e.pdfPaginas
        ? { url: e.pdfUrl, paginas: e.pdfPaginas }
        : null,
    paginasDigitalizadas:
      digitalizadas.find((d) => d.edicionId === e.id)?._count._all ?? 0,
    estado: !e.publicaEn
      ? "sin_fecha"
      : e.publicaEn <= ahora
        ? "publicada"
        : "programada",
  }));

  const siguienteNumero =
    filas.reduce((max, e) => Math.max(max, e.numero), 0) + 1;

  const programadas = ediciones.filter((e) => e.estado === "programada").length;
  const sinFecha = ediciones.filter((e) => e.estado === "sin_fecha").length;

  return (
    <>
      <BannerPanel
        titulo="Ediciones"
        bajada={
          <>
            {ediciones.length}{" "}
            {ediciones.length === 1 ? "edición cargada" : "ediciones cargadas"},
            de la más nueva a la más vieja.
          </>
        }
      />

      {/* La misma escalera vertical que las otras cinco pantallas del panel:
          la pila va en un `grid gap-6` y ningún hijo trae su propio `mt-`. */}
      <div className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TarjetaDato
            icono={Newspaper}
            color="azul"
            titulo="En la calle"
            valor={publicada ? `N.º ${publicada.numero}` : "Ninguna"}
            nota={
              publicada
                ? `${publicada.mes}: es la que ve el lector ahora mismo.`
                : "Ninguna edición tiene todavía una fecha ya cumplida."
            }
          />
          <TarjetaDato
            icono={CalendarClock}
            color="celeste"
            titulo={programadas === 1 ? "Programada" : "Programadas"}
            valor={String(programadas)}
            nota="Tienen fecha futura y salen solas cuando les llega."
          />
          <TarjetaDato
            icono={CalendarOff}
            color="oro"
            titulo="Sin fecha"
            valor={String(sinFecha)}
            nota="No salen nunca solas: se están preparando."
          />
        </div>

        {/* El mismo cartel que el de `/admin`, y ahora literalmente el mismo:
            estaba copiado carácter por carácter —filete, cuadrado del icono y
            la fórmula de `color-mix` incluida— y no había forma de cambiarlo en
            un lado sin que los dos se separaran. */}
        <Aviso icono={CalendarClock} tono="var(--grafico-nota)">
          El cambio de mes es automático y no lo dispara nada: el diario sirve
          la edición más reciente cuya fecha ya pasó. Poné la fecha con la
          anticipación que quieras y a esa hora sale sola. Las fechas se
          escriben y se muestran en{" "}
          <strong className="font-semibold text-panel-tinta">
            hora de Tucumán
          </strong>
          .
        </Aviso>

        {/* Las ediciones sí van como tarjetas sueltas flotando sobre el fondo,
            al revés que las notas: cada una es una ficha con estado, tema,
            fecha y su propio formulario adentro, no un renglón de una lista.
            Por eso el título de la lista no arma tarjeta: si la armara, serían
            tarjetas dentro de una tarjeta. */}
        <section aria-labelledby="todas-las-ediciones">
          <h2
            id="todas-las-ediciones"
            className="mb-3 text-panel-lg font-semibold tracking-[-0.01em] text-panel-tinta"
          >
            Todas las ediciones
          </h2>
          <ul className="grid gap-3">
            {ediciones.map((e) => (
              <FilaEdicion
                key={e.slug}
                edicion={e}
                enFoco={enFoco === e.slug}
                esLaPublicada={publicada?.slug === e.slug}
              />
            ))}
          </ul>
        </section>

        <NuevaEdicion siguienteNumero={siguienteNumero} />
      </div>
    </>
  );
}
