import { ShieldCheck, UserRoundPlus, Users } from "lucide-react";
import { requerirAdmin } from "@/lib/auth/dal";
import { ADMINS_CIDITUC } from "@/lib/auth/config";
import { listarUsuarios } from "@/lib/repos/usuarios";
import { ListaUsuarios } from "@/components/admin/lista-usuarios";
import {
  Aviso,
  BannerPanel,
  SeccionPanel,
  TarjetaDato,
} from "@/components/admin/piezas";

export const metadata = { title: "Usuarios" };

/** Cuántos días atrás cuenta como "hace poco" para la tarjeta de altas. Una
 *  semana: es el período con el que se mira un diario mensual sin que el número
 *  sea siempre cero ni siempre el total. */
const DIAS_RECIENTES = 7;

/**
 * Quién entró al diario, y qué puede hacer.
 *
 * La lista **no es un padrón completo**: sólo aparece quien ingresó alguna vez
 * por Cidituc, porque la fila la escribe el callback del ingreso. Quien
 * administra desde la configuración del sistema y todavía no entró no figura
 * acá, y por eso la pantalla lo dice arriba en vez de dejar que el número
 * parezca el total de administradores.
 *
 * Lo que **no** se guarda, y no es un olvido: ni CUIL ni DNI ni correo. Una
 * lista para cambiar roles no necesita documentos. Tampoco hay historial de
 * ingresos —una sola columna que se pisa—: guardar cada entrada convertiría
 * esto en un registro de la actividad de un vecino ante el municipio, que es
 * otra cosa. Lo que sí se guarda desde ahora es la fecha de alta, que es un
 * dato por persona y no un rastro de sus movimientos.
 */
export default async function AdminUsuarios() {
  const sesion = await requerirAdmin();

  /* Quién administra desde la configuración se resuelve acá, del lado del
     servidor, y baja como un booleano por fila: en el cliente `process.env` no
     existe, y mandar la lista de ids sería publicar quiénes son los
     administradores de emergencia. */
  const usuarios = (await listarUsuarios()).map((u) => ({
    ...u,
    delEntorno: ADMINS_CIDITUC.has(u.id),
  }));

  /* Administra de hecho: la columna O la configuración. Contando sólo la
     columna, la pantalla decía "3 administran" mientras había una cuarta
     persona entrando al panel, y su fila la llamaba lectora. */
  const administran = usuarios.filter(
    (u) => u.delEntorno || (u.rol === "admin" && !u.bloqueado),
  );
  const bloqueados = usuarios.filter((u) => u.bloqueado);

  /* `new Date()` y no `Date.now()`: es la misma hora y es lo que usan las otras
     pantallas del panel, pero además `Date.now` está marcado como impuro por
     las reglas de React —da un valor distinto en cada render— y el lint lo
     rechaza. Acá el render es del servidor y ocurre una sola vez, así que la
     hora se toma una vez y se compara contra ella. */
  const ahora = new Date();
  const desde = ahora.getTime() - DIAS_RECIENTES * 24 * 3600_000;
  const recientes = usuarios.filter(
    (u) => new Date(u.creadoEn).getTime() >= desde,
  );

  /* Los del entorno que además ingresaron ya están en `administran`; los que
     nunca entraron no tienen fila. Este número es el que la lista no puede
     mostrar. */
  const sinFila = [...ADMINS_CIDITUC].filter(
    (id) => !usuarios.some((u) => u.id === id),
  ).length;

  return (
    <>
      <BannerPanel
        titulo="Usuarios"
        bajada="Quién ingresó al diario por Cidituc y qué puede hacer acá. Cidituc dice quién es cada uno; el rol lo decide esta pantalla."
      />

      <div className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TarjetaDato
            icono={Users}
            titulo="Ingresaron"
            valor={String(usuarios.length)}
            nota="Personas que entraron alguna vez"
            color="azul"
          />
          <TarjetaDato
            icono={UserRoundPlus}
            titulo="Nuevas"
            valor={String(recientes.length)}
            nota={`Se registraron en los últimos ${DIAS_RECIENTES} días`}
            color="celeste"
          />
          <TarjetaDato
            icono={ShieldCheck}
            titulo="Administran"
            valor={String(administran.length)}
            nota="Entran al panel y moderan"
            color="oro"
          />
          <TarjetaDato
            icono={Users}
            titulo="Bloqueadas"
            valor={String(bloqueados.length)}
            nota="No pueden comentar ni abrir sesión"
            color="alerta"
          />
        </div>

        {sinFila > 0 && (
          <Aviso icono={ShieldCheck} tono="var(--grafico-acento)">
            Hay {sinFila} {sinFila === 1 ? "persona" : "personas"} que
            administran desde la configuración del sistema y todavía no
            ingresaron, así que no figuran en la lista. Administran igual: esa
            configuración gana sobre esta pantalla, y es la red que evita que el
            diario se quede sin nadie que pueda entrar al panel.
          </Aviso>
        )}

        <SeccionPanel
          id="lista"
          titulo="La gente que entró"
          bajada="Ordenada por fecha de registro, de la última en sumarse a la primera. Bloquear corta la participación y el panel en el pedido siguiente, y no deja abrir una sesión nueva; quien ya tenga una abierta puede seguir leyendo el diario hasta que se le venza."
        >
          {usuarios.length === 0 ? (
            <p className="text-panel-base text-panel-tinta-2">
              Todavía no ingresó nadie. La lista se llena sola: cada ingreso por
              Cidituc deja su fila.
            </p>
          ) : (
            <ListaUsuarios usuarios={usuarios} yo={sesion.usuario.id} />
          )}
        </SeccionPanel>
      </div>
    </>
  );
}
