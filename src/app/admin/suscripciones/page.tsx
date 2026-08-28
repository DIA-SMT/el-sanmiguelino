import { Download, Mailbox } from "lucide-react";
import { requerirAdmin } from "@/lib/auth/dal";
import { listarSuscripciones } from "@/lib/repos/suscripciones";
import { tiempoRelativo } from "@/lib/utils";

export const metadata = { title: "Suscripciones" };

/**
 * Quién pidió El Sanmiguelino en papel.
 *
 * Es la única pantalla del panel con **datos personales de vecinos**: nombre,
 * edad, correo y domicilio. Todo lo demás del panel maneja contenido del
 * diario, y el registro de Migue está hecho a propósito para no guardar quién
 * pregunta. Acá el dato ES la persona, porque hay que llevarle el diario.
 *
 * Pide permiso por su cuenta aunque el layout ya lo haya hecho: en el App
 * Router el layout no es un límite de seguridad.
 */
export default async function AdminSuscripciones() {
  await requerirAdmin();
  const suscripciones = await listarSuscripciones();

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink pb-4">
        <div>
          <h1 className="font-sans text-[1.35rem] font-bold leading-tight text-ink">
            Suscripciones al papel
          </h1>
          <p className="mt-1 font-sans text-[0.8rem] text-ink-3">
            {suscripciones.length}{" "}
            {suscripciones.length === 1 ? "persona anotada" : "personas anotadas"}
          </p>
        </div>
        {suscripciones.length > 0 && (
          /* Un enlace y no un botón: es una descarga, y el navegador ya sabe
             hacer eso. Con un botón habría que armar el archivo en el cliente
             con los datos ya en memoria. */
          <a
            href="/admin/suscripciones/csv"
            className="pressable inline-flex items-center gap-2 border border-ink px-3.5 py-2 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-ink transition-colors hover:bg-ink hover:text-paper"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Bajar la lista
          </a>
        )}
      </div>

      <p className="mt-5 border border-hairline bg-paper-2 px-4 py-3 font-sans text-[0.78rem] leading-relaxed text-ink-2">
        Son datos personales de vecinos, cargados por ellos para recibir el
        diario. Se usan para eso y nada más. La lista que se baja tiene
        domicilios: tratala como lo que es.
      </p>

      {suscripciones.length === 0 ? (
        <p className="mt-8 flex items-center gap-2.5 font-sans text-[0.85rem] text-ink-3">
          <Mailbox className="h-4 w-4" aria-hidden="true" />
          Todavía no se anotó nadie.
        </p>
      ) : (
        /* La tabla se desplaza sola: con el domicilio adentro, en un teléfono
           no entra de ninguna manera y romper la página es peor. */
        <div className="mt-6 overflow-x-auto border border-hairline">
          <table className="w-full min-w-[44rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-hairline bg-paper-2">
                {["Nombre", "Edad", "Correo", "Dirección", "Se anotó"].map(
                  (t) => (
                    <th
                      key={t}
                      scope="col"
                      className="px-3 py-2.5 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ink-2"
                    >
                      {t}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {suscripciones.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2.5 font-sans text-[0.85rem] text-ink">
                    {s.nombre}
                  </td>
                  <td className="px-3 py-2.5 font-sans text-[0.85rem] tabular-nums text-ink-2">
                    {s.edad ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[0.78rem] text-ink-2">
                    {s.email}
                  </td>
                  <td className="px-3 py-2.5 font-sans text-[0.85rem] text-ink-2">
                    {s.direccion}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-sans text-[0.75rem] text-ink-3">
                    {tiempoRelativo(s.fecha)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
