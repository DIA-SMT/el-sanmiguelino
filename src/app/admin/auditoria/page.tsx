import { History, ShieldAlert, Trash2 } from "lucide-react";
import { requerirAdmin } from "@/lib/auth/dal";
import { contarRegistro, listarRegistro } from "@/lib/repos/auditoria";
import { RegistroPanelLista } from "@/components/admin/registro-panel";
import {
  Aviso,
  BannerPanel,
  SeccionPanel,
  TarjetaDato,
} from "@/components/admin/piezas";

export const metadata = { title: "Auditoría" };

/** Cuántos movimientos trae la pantalla. El resto queda en la base: el registro
 *  no se limpia nunca, y esta lista no es el registro sino una ventana. */
const TOPE = 300;

/**
 * Qué hizo cada quien en el panel.
 *
 * **Nació de una desaparición.** El 2026-09-07 un comentario dejó de estar y no
 * hubo dónde mirar: el diario sabía que ya no estaba y nada más. Con el borrado
 * definitivo recién estrenado, esa duda dejó de ser tolerable — una publicación
 * oficial tiene que poder decir quién sacó qué y cuándo, sobre todo cuando lo
 * sacado no vuelve.
 *
 * **Lo que esta pantalla NO puede hacer, y conviene saberlo antes de buscar:**
 *
 * - No explica lo que pasó antes de que existiera. El registro arranca vacío el
 *   día que se instaló; para atrás no hay nada, y no se puede reconstruir.
 * - No guarda el contenido de lo que se moderó. Dice que se borró el comentario
 *   de tal persona en tal nota, con qué motivo se lo había bajado y cuántos
 *   votos tenía. El texto no está, a propósito: guardarlo convertiría el
 *   borrado en una mudanza del insulto a otra tabla.
 * - No deshace nada. Es un registro, no un historial de versiones.
 * - No ve lo que pasa fuera del panel: alguien con acceso directo a la base
 *   puede borrar una fila sin dejar renglón. Contra eso no alcanza una tabla en
 *   la misma base, hace falta el registro del proveedor.
 */
export default async function AdminAuditoria() {
  await requerirAdmin();
  const [registro, total] = await Promise.all([
    listarRegistro(TOPE),
    contarRegistro(),
  ]);

  const ahora = new Date();
  const desde = ahora.getTime() - 7 * 24 * 3600_000;
  const semana = registro.filter(
    (r) => new Date(r.fecha).getTime() >= desde,
  ).length;
  const graves = registro.filter((r) => r.grave).length;

  return (
    <>
      <BannerPanel
        titulo="Auditoría"
        bajada="Qué se tocó en el panel, quién lo hizo y cuándo. Se anota solo: cada cambio deja su renglón y ninguno se puede borrar desde acá."
      />

      <div className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <TarjetaDato
            icono={History}
            color="azul"
            titulo="Movimientos"
            valor={String(total)}
            nota="Desde que existe el registro"
          />
          <TarjetaDato
            icono={ShieldAlert}
            color="celeste"
            titulo="Esta semana"
            valor={String(semana)}
            nota="De los últimos 7 días"
          />
          <TarjetaDato
            icono={Trash2}
            color="alerta"
            titulo="Se llevaron algo"
            valor={String(graves)}
            nota="Borrados, bloqueos y descargas del padrón"
          />
        </div>

        {/* Lo que el registro no puede contestar, dicho antes de que alguien lo
            busque y no lo encuentre. No es una explicación de la máquina: es el
            alcance de la herramienta, y sin él la pantalla promete de más. */}
        <Aviso icono={History} tono="var(--grafico-nota)">
          El registro empieza el día que se instaló: lo que pasó antes no está y
          no se puede reconstruir. Guarda <strong>qué</strong> se hizo y{" "}
          <strong>quién</strong> lo hizo, no el contenido de lo moderado — de un
          comentario borrado quedan la nota, quién lo escribió y el motivo de la
          baja, nunca el texto.
        </Aviso>

        <SeccionPanel
          id="movimientos"
          titulo="Todo lo que pasó"
          bajada={
            total > registro.length
              ? `Los últimos ${registro.length} movimientos, del más reciente al más viejo.`
              : "Del más reciente al más viejo."
          }
        >
          <RegistroPanelLista registro={registro} total={total} />
        </SeccionPanel>
      </div>
    </>
  );
}
