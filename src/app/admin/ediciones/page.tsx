import { CalendarClock } from "lucide-react";
import { FilaEdicion, type EdicionFila } from "@/components/admin/fila-edicion";
import { NuevaEdicion } from "@/components/admin/nueva-edicion";
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
    notas: e._count.notas,
    estado: !e.publicaEn
      ? "sin_fecha"
      : e.publicaEn <= ahora
        ? "publicada"
        : "programada",
  }));

  const siguienteNumero =
    filas.reduce((max, e) => Math.max(max, e.numero), 0) + 1;

  return (
    <>
      <div className="border-b border-ink pb-4">
        <h1 className="font-sans text-[1.35rem] font-bold leading-tight text-ink">
          Ediciones
        </h1>
        <p className="mt-1 font-sans text-[0.8rem] text-ink-3">
          {ediciones.length}{" "}
          {ediciones.length === 1 ? "edición" : "ediciones"} · en la calle:{" "}
          {publicada?.mes ?? "ninguna"}
        </p>
      </div>

      <p className="mt-5 flex items-start gap-2.5 border border-hairline bg-paper-2 px-4 py-3 font-sans text-[0.8rem] leading-relaxed text-ink-2">
        <CalendarClock
          className="mt-[0.15em] h-4 w-4 shrink-0 text-accent"
          aria-hidden="true"
        />
        <span>
          El cambio de mes es automático y no lo dispara nada: el diario sirve
          la edición más reciente cuya fecha ya pasó. Poné la fecha con la
          anticipación que quieras y a esa hora sale sola. Las fechas se
          escriben y se muestran en <strong>hora de Tucumán</strong>.
        </span>
      </p>

      <ul className="mt-4 divide-y divide-hairline border-y border-hairline">
        {ediciones.map((e) => (
          <FilaEdicion
            key={e.slug}
            edicion={e}
            enFoco={enFoco === e.slug}
            esLaPublicada={publicada?.slug === e.slug}
          />
        ))}
      </ul>

      <NuevaEdicion siguienteNumero={siguienteNumero} />
    </>
  );
}
