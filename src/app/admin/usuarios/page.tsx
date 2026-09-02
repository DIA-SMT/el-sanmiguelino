import { ShieldCheck, Users } from "lucide-react";
import { requerirAdmin } from "@/lib/auth/dal";
import { ADMINS_CIDITUC } from "@/lib/auth/config";
import { listarUsuarios } from "@/lib/repos/usuarios";
import { FilaUsuario } from "@/components/admin/fila-usuario";
import {
  Aviso,
  BannerPanel,
  SeccionPanel,
  TarjetaDato,
  TarjetaPanel,
} from "@/components/admin/piezas";

export const metadata = { title: "Usuarios" };

/**
 * Quién entró al diario, y qué puede hacer.
 *
 * La lista **no es un padrón**: sólo aparece quien ingresó alguna vez por
 * Cidituc, porque la fila la escribe el callback del ingreso. Alguien cargado en
 * `CIDITUC_ADMINS` que todavía no entró no figura acá, y por eso la pantalla lo
 * dice arriba en vez de dejar que el número parezca el total de administradores.
 *
 * Lo que **no** se guarda, y no es un olvido: ni CUIL ni DNI ni correo. Una lista
 * para cambiar roles no necesita documentos. Y tampoco hay historial de ingresos
 * —una sola columna que se pisa—: guardar cada entrada convertiría esto en un
 * registro de la actividad de un vecino ante el municipio, que es otra cosa.
 */
export default async function AdminUsuarios() {
  const sesion = await requerirAdmin();
  const usuarios = await listarUsuarios();

  const administran = usuarios.filter((u) => u.rol === "admin" && !u.bloqueado);
  const bloqueados = usuarios.filter((u) => u.bloqueado);
  /* Los del entorno que además ingresaron ya están en `administran`; los que
     nunca entraron no tienen fila. Este número es el que la lista no puede
     mostrar. */
  const delEntornoSinFila = [...ADMINS_CIDITUC].filter(
    (id) => !usuarios.some((u) => u.id === id),
  ).length;

  return (
    <>
      <BannerPanel
        titulo="Usuarios"
        bajada="Quién ingresó al diario por Cidituc y qué puede hacer acá. Cidituc dice quién es cada uno; el rol lo decide esta pantalla."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <TarjetaDato
          icono={Users}
          titulo="Ingresaron"
          valor={String(usuarios.length)}
          color="azul"
        />
        <TarjetaDato
          icono={ShieldCheck}
          titulo="Administran"
          valor={String(administran.length)}
          color="celeste"
        />
        <TarjetaDato
          icono={Users}
          titulo="Bloqueadas"
          valor={String(bloqueados.length)}
          color="alerta"
        />
      </div>

      {delEntornoSinFila > 0 && (
        <div className="mt-4">
          <Aviso icono={ShieldCheck} tono="var(--grafico-acento)">
            Hay {delEntornoSinFila}{" "}
            {delEntornoSinFila === 1 ? "persona" : "personas"} en{" "}
            <code>CIDITUC_ADMINS</code> que todavía no ingresaron, así que no
            figuran en la lista. Administran igual: esa variable gana sobre esta
            pantalla, y es la red que evita que el diario se quede sin nadie que
            pueda entrar al panel.
          </Aviso>
        </div>
      )}

      <div className="mt-6">
        <SeccionPanel
          id="lista"
          titulo="La gente que entró"
          bajada="Ordenada por el último ingreso. Bloquear corta la participación y el panel en el pedido siguiente, y no deja abrir una sesión nueva; quien ya tenga una abierta puede seguir leyendo el diario hasta que se le venza."
        >
          {usuarios.length === 0 ? (
            <p className="text-panel-base text-panel-tinta-2">
              Todavía no ingresó nadie. La lista se llena sola: cada ingreso por
              Cidituc deja su fila.
            </p>
          ) : (
            <ul className="-mx-4 divide-y divide-panel-borde border-y border-panel-borde sm:-mx-5">
              {usuarios.map((u) => (
                <FilaUsuario key={u.id} usuario={u} yo={sesion.usuario.id} />
              ))}
            </ul>
          )}
        </SeccionPanel>
      </div>

      <div className="mt-4">
        <TarjetaPanel>
          <p className="text-panel-sm leading-relaxed text-panel-tinta-2">
            Por ahora sólo hay dos roles: <strong>lectora</strong> y{" "}
            <strong>administradora</strong>. Existe un tercero, <em>editora</em>,
            pero todavía no habilita nada distinto, así que la pantalla no lo
            ofrece — un control que guarda un valor que ningún camino del código
            mira es peor que uno que no existe.
          </p>
        </TarjetaPanel>
      </div>
    </>
  );
}
