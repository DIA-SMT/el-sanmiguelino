import { Eye, EyeOff, MessageSquare, ShieldAlert } from "lucide-react";
import { FilaComentario } from "@/components/admin/fila-comentario";
import {
  BannerPanel,
  ChipFiltro,
  TarjetaDato,
  TarjetaPanel,
} from "@/components/admin/piezas";
import { requerirAdmin } from "@/lib/auth/dal";
import { comentariosRepo } from "@/lib/repos/comentarios";
import { getIndice } from "@/lib/repos/edicion";
import { bloqueosDe } from "@/lib/repos/usuarios";
import type { EstadoComentario } from "@/lib/types";

export const metadata = { title: "Comentarios" };

/** Los tres estados, en el orden en que se moderan: primero lo que hay que
 *  mirar, después lo que está a la vista, y al final lo que ya se resolvió. */
const FILTROS: { valor?: EstadoComentario; nombre: string; tono?: string }[] = [
  { nombre: "Todos" },
  {
    valor: "en_revision",
    nombre: "En revisión",
    tono: "var(--grafico-diario)",
  },
  { valor: "publicado", nombre: "Publicados", tono: "var(--grafico-nota)" },
  { valor: "oculto", nombre: "De baja", tono: "var(--grafico-alerta)" },
];

/**
 * Moderación de la columna del lector.
 *
 * Pide permiso por su cuenta: acá hay comentarios de vecinos identificados,
 * que son datos personales, y el componente que tiene los datos es el que pide
 * permiso.
 *
 * Muestra **todo**, ordenado por fecha y no por estado: moderar es mirar lo
 * último que entró, no revisar una bandeja de pendientes. Los comentarios se
 * publican directo, así que no hay cola de aprobación — lo que sí hay ahora es
 * un estado intermedio, "en revisión", para lo que no se quiere dejar publicado
 * mientras se lo decide.
 *
 * Y como no desaparecen solos, la pantalla tiene que **mostrar lo que se
 * moderó**, no esconderlo: los de baja siguen en la lista, con el motivo y con
 * quién lo decidió. Una moderación que hace desaparecer no se puede auditar.
 * Borrar para siempre existe y es una decisión aparte, que se toma sobre un
 * comentario ya dado de baja.
 */
export default async function AdminComentarios({
  searchParams,
}: PageProps<"/admin/comentarios">) {
  const { usuario } = await requerirAdmin();
  const { estado } = await searchParams;
  const filtro = FILTROS.find((f) => f.valor && f.valor === estado)?.valor;

  const indice = await getIndice();

  /* Se pide la lista COMPLETA una sola vez y el filtro se aplica en memoria.
     No es descuido: las tarjetas de arriba y las cuentas de los chips necesitan
     los cuatro números siempre, así que filtrar en la consulta obligaría a
     cuatro consultas para mostrar una lista. El orden por fecha ya viene del
     repo. */
  const todos = await comentariosRepo.listarParaModeracion({
    moderadorId: usuario.id,
  });
  const cuantos = (e: EstadoComentario) =>
    todos.filter((c) => c.estado === e).length;
  const publicados = cuantos("publicado");
  const enRevision = cuantos("en_revision");
  const ocultos = cuantos("oculto");
  const comentarios = filtro
    ? todos.filter((c) => c.estado === filtro)
    : todos;

  /* Quién de los que comentaron está en el padrón y quién está bloqueado. Una
     consulta para toda la lista: la fila necesita saberlo para ofrecer —o no—
     el bloqueo, y preguntarlo por comentario sería una consulta por fila. */
  const bloqueos = await bloqueosDe(todos.map((c) => c.usuarioId));

  const notaDe = new Map(indice.map((n) => [n.slug, n]));

  return (
    <>
      <BannerPanel
        titulo="Comentarios"
        bajada="Se publican directo, como se acordó con el municipio. Dar de baja no borra: el texto y los votos se conservan, y queda guardado quién lo decidió, cuándo y por qué."
      />

      {/* La misma escalera vertical que las otras pantallas del panel: la pila
          va en un `grid gap-6` y ningún hijo trae su propio `mt-`. */}
      <div className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TarjetaDato
            icono={MessageSquare}
            color="azul"
            valor={String(todos.length)}
            titulo="Comentarios"
            nota="Todo lo que escribieron los vecinos en la edición"
          />
          <TarjetaDato
            icono={Eye}
            color="celeste"
            valor={String(publicados)}
            titulo="Publicados"
            nota="Se ven en el diario ahora mismo"
          />
          <TarjetaDato
            icono={ShieldAlert}
            color="oro"
            valor={String(enRevision)}
            titulo="En revisión"
            nota="Fuera del diario mientras se decide qué hacer"
          />
          <TarjetaDato
            icono={EyeOff}
            color="alerta"
            valor={String(ocultos)}
            titulo="Dados de baja"
            nota="No se ven en el diario, pero siguen guardados con su motivo"
          />
        </div>

        {/* Los filtros son enlaces y no botones: acá el filtro vive en la URL
            (?estado=…), así que es una navegación de verdad —enlace directo,
            vuelta atrás, "abrir en otra pestaña"— y no un botón que obligaría a
            bajar la pantalla entera al cliente. `como="enlace"` cambia
            `aria-pressed` por `aria-current="page"`, que es lo correcto cuando
            uno está parado en una página; y `superficie="pagina"` elige el fondo
            contrario al gris de la página. El punto de color es el mismo que
            usa la píldora de cada fila, para que el filtro y la fila se lean
            como lo mismo. */}
        <nav
          aria-label="Filtrar por estado"
          className="flex flex-wrap items-center gap-panel-controles"
        >
          {FILTROS.map((f) => (
            <ChipFiltro
              key={f.nombre}
              como="enlace"
              href={
                f.valor
                  ? `/admin/comentarios?estado=${f.valor}`
                  : "/admin/comentarios"
              }
              superficie="pagina"
              color={f.tono}
              activo={filtro === f.valor}
              cuenta={
                f.valor === "publicado"
                  ? publicados
                  : f.valor === "en_revision"
                    ? enRevision
                    : f.valor === "oculto"
                      ? ocultos
                      : todos.length
              }
            >
              {f.nombre}
            </ChipFiltro>
          ))}
        </nav>

        {comentarios.length === 0 ? (
          <TarjetaPanel className="flex flex-col items-center gap-3 py-12 text-center">
            <MessageSquare
              className="h-6 w-6 text-panel-tinta-3"
              aria-hidden="true"
            />
            <p className="text-panel-base text-panel-tinta-2">
              {filtro === "oculto"
                ? "No hay comentarios dados de baja."
                : filtro === "en_revision"
                  ? "No hay nada en revisión."
                  : filtro === "publicado"
                    ? "No hay comentarios publicados."
                    : "Todavía no hay comentarios en esta edición."}
            </p>
          </TarjetaPanel>
        ) : (
          /* `p-0` y `overflow-hidden`: las filas llegan al borde de la tarjeta
             —una fila moderada se pinta entera— y el redondeo las recorta en vez
             de dejar una esquina cuadrada asomando. */
          <TarjetaPanel className="overflow-hidden p-0">
            <ul className="divide-y divide-panel-borde">
              {comentarios.map((c) => {
                const nota = notaDe.get(c.notaSlug);
                const bloqueado = bloqueos.get(c.usuarioId);
                return (
                  <FilaComentario
                    key={c.id}
                    comentario={c}
                    tituloNota={nota?.titulo}
                    seccionNota={nota?.seccion}
                    /* `undefined` es "no está en el padrón", que no es lo mismo
                       que "está y no está bloqueado": en el primer caso no hay
                       a quién bloquear y el botón no se ofrece. */
                    autor={
                      bloqueado === undefined
                        ? null
                        : { bloqueado, soyYo: c.usuarioId === usuario.id }
                    }
                  />
                );
              })}
            </ul>
          </TarjetaPanel>
        )}
      </div>
    </>
  );
}
