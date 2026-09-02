import { CalendarDays, Download, Mailbox, UserPlus, Users } from "lucide-react";
import {
  BannerPanel,
  SeccionPanel,
  TABLA,
  TarjetaDato,
  TarjetaPanel,
  ZonaDeTabla,
  clasesDeBoton,
} from "@/components/admin/piezas";
import { requerirAdmin } from "@/lib/auth/dal";
import { listarSuscripciones } from "@/lib/repos/suscripciones";
import { tiempoRelativo } from "@/lib/utils";

export const metadata = { title: "Suscripciones" };

const DIA = 24 * 60 * 60 * 1000;

const COLUMNAS = ["Nombre", "Edad", "Correo", "Dirección", "Se anotó"];

/**
 * El id del nombre accesible de la zona que se desplaza.
 *
 * Fijo y escrito a mano, no `useId()`: esta pantalla se arma en el servidor y
 * `useId` es de cliente. Como hay una sola tabla por pantalla, un id constante
 * no se puede duplicar.
 */
const ID_ZONA_TABLA = "zona-tabla-suscripciones";

/**
 * Cuántas altas hay en los últimos `dias` días.
 *
 * El reloj se lee acá adentro y no en el cuerpo de la página por una razón
 * concreta: `react-hooks/purity` prohíbe llamar a `Date.now()` durante el
 * render, y tiene razón para un componente de cliente que puede re-renderizar
 * y dar dos números distintos. Esta pantalla se arma una vez por pedido en el
 * servidor, así que el "ahora" es uno solo; encerrarlo en una función con
 * nombre es la manera de decir que es una foto tomada a propósito. Es lo mismo
 * que hace `tiempoRelativo`, que también mira el reloj puertas adentro.
 */
function altasRecientes(fechas: string[], dias: number): number {
  const corte = Date.now() - dias * DIA;
  return fechas.filter((f) => new Date(f).getTime() >= corte).length;
}

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
 *
 * El rediseño de tablero no trajo nada que muestre a la persona de más: las
 * tarjetas de arriba son **cuentas**, que no identifican a nadie; no hay
 * avatares ni iniciales de colores, y el domicilio va con el mismo peso que el
 * resto —resaltarlo sería convertir en titular lo más delicado de la fila—.
 * Y la descarga sigue siendo un acto deliberado: un botón de contorno con el
 * formato escrito en la etiqueta, apoyado en el aviso de qué trae el archivo,
 * y no un ícono al pasar que uno aprieta sin querer.
 */
export default async function AdminSuscripciones() {
  await requerirAdmin();
  const suscripciones = await listarSuscripciones();

  const fechas = suscripciones.map((s) => s.fecha);
  const semana = altasRecientes(fechas, 7);
  const mes = altasRecientes(fechas, 30);

  return (
    <>
      <BannerPanel
        titulo="Suscripciones al papel"
        bajada={
          <span id="aviso-datos">
            Son datos personales de vecinos, cargados por ellos para recibir el
            diario. Se usan para eso y nada más. La lista que se baja tiene
            domicilios: tratala como lo que es.
          </span>
        }
      >
        {suscripciones.length > 0 && (
          /* Un enlace y no un botón: es una descarga, y el navegador ya sabe
             hacer eso. Con un botón habría que armar el archivo en el cliente
             con los datos ya en memoria.

             `aria-describedby` cuelga el aviso de la etiqueta: quien llega al
             enlace con el lector de pantalla escucha qué trae el archivo antes
             de apretarlo, y no después. */
          <a
            href="/admin/suscripciones/csv"
            aria-describedby="aviso-datos"
            /* El botón de contorno del panel. Sigue siendo secundario y no
               primario a propósito: bajarse los domicilios de doscientos
               vecinos no es la acción principal de la pantalla, es la que hay
               que decidir apretar. */
            className={clasesDeBoton()}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Bajar la lista en CSV
          </a>
        )}
      </BannerPanel>

      {/* La misma escalera vertical que las otras cinco pantallas del panel.
          Acá tampoco había ninguna: dos `mt-6` sueltos que había que acordarse
          de repetir en cada bloque nuevo. */}
      <div className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TarjetaDato
            icono={Users}
            color="azul"
            valor={String(suscripciones.length)}
            titulo="Personas anotadas"
            nota="Piden El Sanmiguelino impreso en su casa"
          />
          <TarjetaDato
            icono={UserPlus}
            color="celeste"
            valor={String(semana)}
            titulo="Se anotaron esta semana"
            nota="En los últimos siete días"
          />
          <TarjetaDato
            icono={CalendarDays}
            color="oro"
            valor={String(mes)}
            titulo="Se anotaron este mes"
            nota="En los últimos treinta días"
          />
        </div>

        {suscripciones.length === 0 ? (
          <TarjetaPanel className="flex flex-col items-center gap-3 py-12 text-center">
            <Mailbox
              className="h-6 w-6 text-panel-tinta-3"
              aria-hidden="true"
            />
            <p className="text-panel-base text-panel-tinta-2">
              Todavía no se anotó nadie.
            </p>
          </TarjetaPanel>
        ) : (
          /* La tabla va adentro de una `SeccionPanel`, con su título, igual que
             la de Migue. Antes era una tarjeta pelada sin encabezado: la única
             pantalla del panel donde una tabla aparecía sin que nada dijera qué
             lista es. */
          <SeccionPanel
            id="lista-de-anotados"
            titulo="Quiénes se anotaron"
            bajada="Del más nuevo al más viejo. Se desplaza al costado: el domicilio no entra en un teléfono."
          >
            {/*
             * `ZonaDeTabla` trae puestos el `role="region"`, el nombre
             * accesible y el `tabIndex={0}`: la tabla mide 46rem y adentro no
             * hay un solo elemento enfocable, así que en un viewport angosto se
             * ven dos columnas y las de la derecha —el domicilio y la fecha—
             * quedan inalcanzables con el teclado. Chrome 127+ hace enfocables
             * por su cuenta los scrollers sin hijos enfocables; Firefox y
             * Safari no, y el arreglo del navegador no es el arreglo de la
             * página: falla WCAG 2.1.1.
             *
             * Estaba escrito a mano acá y era una copia de la tabla de Migue.
             * Cuatro cosas que hay que acordarse de poner —y que la tercera
             * tabla del panel no iba a tener por qué adivinar— ahora son dos
             * props.
             */}
            <ZonaDeTabla
              id={ID_ZONA_TABLA}
              nombre="Tabla de vecinos anotados, más ancha que la pantalla: se desplaza al costado con las flechas."
            >
              {/* El ancho mínimo es lo único de la tabla que depende de cuántas
                  columnas tiene, así que no está en la pieza. Se concatena y no
                  se pasa por `cn()`: ver la nota de los botones en
                  `piezas.tsx`. */}
              <table className={`${TABLA.tabla} min-w-[46rem]`}>
                <caption className="sr-only">
                  Vecinos anotados para recibir el diario en papel, del más
                  nuevo al más viejo.
                </caption>
                <thead>
                  {/* La banda de la cabecera la ponen los `<th>`, que embaldosan
                      la fila entera, así que este `<tr>` no lleva ninguna clase.
                      Y el `text-left` que trae `TABLA.cabecera` es el que le
                      faltaba a esta tabla: el centrado del `<th>` es una regla
                      del navegador y le ganaba al `text-left` heredado, así que
                      los cinco títulos salían centrados sobre columnas de datos
                      alineadas a la izquierda. */}
                  <tr>
                    {COLUMNAS.map((t) => (
                      <th key={t} scope="col" className={TABLA.cabecera}>
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {suscripciones.map((s) => (
                    /* `group` para que la última columna pueda subir de tono
                       junto con la fila: ver el comentario de la celda del
                       tiempo, abajo. */
                    <tr key={s.id} className={`${TABLA.fila} group`}>
                      {/* El tamaño y la tinta del cuerpo viven en la `<table>`
                          y las celdas los heredan, así que la columna que manda
                          se marca con una sola clase que no le pelea a
                          ninguna. */}
                      <td
                        className={`${TABLA.celda} font-medium text-panel-tinta`}
                      >
                        {s.nombre}
                      </td>
                      <td className={`${TABLA.celda} tabular-nums`}>
                        {s.edad ?? "—"}
                      </td>
                      <td className={`${TABLA.celda} font-mono text-panel-xs`}>
                        {s.email}
                      </td>
                      {/* El domicilio con el mismo peso que el resto de la
                          fila: resaltarlo sería convertir en titular lo más
                          delicado del dato. */}
                      <td className={TABLA.celda}>{s.direccion}</td>
                      {/* El tiempo relativo es metadato y va en `tinta-3`, pero
                          la fila se resalta con `panel-wash` al pasar el mouse
                          y sobre ese fondo `tinta-3` cae por debajo de 4,5:1
                          —el mismo defecto que el chip ya había arreglado—.
                          Sube a `tinta-2` con `group-hover` y no con un `hover:`
                          propio para que el disparador sea la fila entera y no
                          la celda: si fuera de la celda, el texto seguiría
                          ilegible mientras el mouse está en el domicilio de al
                          lado, que es justo cuando la fila ya está resaltada. */}
                      <td
                        className={`${TABLA.celda} whitespace-nowrap text-panel-xs text-panel-tinta-3 group-hover:text-panel-tinta-2`}
                      >
                        {tiempoRelativo(s.fecha)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ZonaDeTabla>
          </SeccionPanel>
        )}
      </div>
    </>
  );
}
