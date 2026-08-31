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
export default async function AdminEdiciones() {
  await requerirAdmin();
  const [filas, enFoco] = await Promise.all([
    db().edicion.findMany({
      orderBy: [{ anio: "desc" }, { numero: "desc" }],
      include: { _count: { select: { notas: true } } },
    }),
    edicionEnFoco(),
  ]);

  const ahora = new Date();
  // La que el lector ve: la más reciente ya publicada. Se calcula igual que en
  // el repo, a propósito — si las dos formas se separan, el panel miente.
  const publicada = filas
    .filter((e) => e.publicaEn && e.publicaEn <= ahora)
    .sort((a, b) => b.publicaEn!.getTime() - a.publicaEn!.getTime())[0];

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

      {/* La misma escalera vertical que las otras cuatro pantallas del panel:
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
