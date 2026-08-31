import { Eye, EyeOff, MessageSquare } from "lucide-react";
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
import type { EstadoComentario } from "@/lib/types";

export const metadata = { title: "Comentarios" };

/**
 * Moderación de la columna del lector.
 *
 * Pide permiso por su cuenta: acá hay comentarios de vecinos identificados,
 * que son datos personales, y el componente que tiene los datos es el que pide
 * permiso.
 *
 * Muestra **todo**, publicado y de baja, ordenado por fecha y no por estado:
 * moderar es mirar lo último que entró, no revisar una bandeja de pendientes.
 * La política acordada con el municipio es que los comentarios se publican
 * directo, así que no existe una cola de aprobación.
 *
 * Y como no se borran, la pantalla tiene que **mostrar lo que bajó**, no
 * esconderlo: los de baja siguen en la lista, tildados, con el motivo y con
 * quién lo decidió. Una moderación que hace desaparecer no se puede auditar.
 */
export default async function AdminComentarios({
  searchParams,
}: PageProps<"/admin/comentarios">) {
  const { usuario } = await requerirAdmin();
  const { estado } = await searchParams;
  const filtro =
    estado === "publicado" || estado === "oculto"
      ? (estado as EstadoComentario)
      : undefined;

  const indice = await getIndice();

  /* Se pide la lista COMPLETA una sola vez y el filtro se aplica en memoria.
     No es descuido: las tarjetas de arriba y las cuentas de los chips necesitan
     los tres números siempre, así que filtrar en la consulta obligaría a tres
     consultas para mostrar una lista. El orden por fecha ya viene del repo. */
  const todos = await comentariosRepo.listarParaModeracion({
    moderadorId: usuario.id,
  });
  const publicados = todos.filter((c) => c.estado === "publicado").length;
  const ocultos = todos.length - publicados;
  const comentarios = filtro
    ? todos.filter((c) => c.estado === filtro)
    : todos;

  const notaDe = new Map(indice.map((n) => [n.slug, n]));

  /* Los filtros se arman acá adentro y no como constante del módulo porque
     cada uno lleva su cuenta, y la cuenta sale de los datos de esta corrida. */
  const filtros = [
    { valor: undefined, nombre: "Todos", cuenta: todos.length },
    { valor: "publicado" as const, nombre: "Publicados", cuenta: publicados },
    { valor: "oculto" as const, nombre: "De baja", cuenta: ocultos },
  ];

  return (
    <>
      <BannerPanel
        titulo="Comentarios"
        bajada="Se publican directo, como se acordó con el municipio. Dar de baja no borra: el texto y los votos se conservan, y queda guardado quién lo decidió, cuándo y por qué."
      />

      {/* La misma escalera vertical que las otras cuatro pantallas del panel.
          Acá no había ninguna: cada bloque elegía su propio `mt-` —6, 4, 4— y
          la fila de tarjetas de dato respiraba distinto que en `/admin`, con el
          mismo componente en la misma posición. */}
      <div className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            icono={EyeOff}
            color="alerta"
            valor={String(ocultos)}
            titulo="Dados de baja"
            nota="No se ven en el diario, pero siguen guardados con su motivo"
          />
        </div>

        {/* Los filtros siguen siendo enlaces, y por el mismo motivo de antes:
            acá el filtro vive en la URL (?estado=…), así que es una navegación
            de verdad —enlace directo, vuelta atrás, "abrir en otra pestaña"— y
            no un botón que obligaría a bajar la pantalla al cliente. Lo que se
            va es la COPIA: `ChipFiltro` tiene ahora los dos ejes que faltaban.
            `como="enlace"` renderiza el `<Link>` y cambia `aria-pressed` por
            `aria-current="page"`, y `superficie="pagina"` elige el fondo
            contrario al gris de la página —`panel-tarjeta-2`, que es el de
            adentro de una tarjeta, acá desaparecía—. */}
        <nav
          aria-label="Filtrar por estado"
          className="flex flex-wrap items-center gap-panel-controles"
        >
          {filtros.map((f) => (
            <ChipFiltro
              key={f.nombre}
              como="enlace"
              href={
                f.valor
                  ? `/admin/comentarios?estado=${f.valor}`
                  : "/admin/comentarios"
              }
              superficie="pagina"
              activo={filtro === f.valor}
              cuenta={f.cuenta}
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
                : filtro === "publicado"
                  ? "No hay comentarios publicados."
                  : "Todavía no hay comentarios en esta edición."}
            </p>
          </TarjetaPanel>
        ) : (
          /* `p-0` y `overflow-hidden`: las filas llegan al borde de la tarjeta
             —una fila de baja se pinta entera— y el redondeo las recorta en vez
             de dejar una esquina cuadrada asomando. */
          <TarjetaPanel className="overflow-hidden p-0">
            <ul className="divide-y divide-panel-borde">
              {comentarios.map((c) => {
                const nota = notaDe.get(c.notaSlug);
                return (
                  <FilaComentario
                    key={c.id}
                    comentario={c}
                    tituloNota={nota?.titulo}
                    seccionNota={nota?.seccion}
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
