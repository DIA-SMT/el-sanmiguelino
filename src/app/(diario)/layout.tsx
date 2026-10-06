import { MandoPaginas } from "@/components/mando-paginas";
import { ProveedorFoliado } from "@/components/foliado-visible";
import { MigueChat } from "@/components/migue/migue-chat";
import { usuarioActual } from "@/lib/auth/dal";
import { edicionEnFoco } from "@/lib/auth/vista-previa";
import { getIndice, getResumenEdicion } from "@/lib/repos/edicion";
import { paginasDeEdicion } from "@/lib/data/paginas";
import { BarraVistaPrevia } from "@/components/barra-vista-previa";
import { textoHoraTucuman } from "@/lib/fecha-edicion";
import { db } from "@/lib/db";

/** Escritorio sobre el que se apoya la hoja del diario. Migue y el mando de
 *  paso de página viven acá para que sobrevivan al paso de hoja: el segmento de
 *  la página se suspende en su `loading.tsx` y desmonta lo que tenga adentro.
 *
 *  El índice de páginas se calcula en el server y baja como props: son solo
 *  números, rutas y títulos, así el cliente no se lleva la edición entera.
 *
 *  Leer es libre: el índice de la edición PUBLICADA es público por diseño, y
 *  este layout ya no pide sesión. Lo que sigue protegido es la edición en foco
 *  —la vista previa de una edición que todavía no salió—, y eso lo cubre
 *  `edicionEnFoco()`, que exige administrador con la firma verificada. Nunca
 *  aflojarlo a "hay usuario": cualquier lector con sesión vería las ediciones
 *  futuras.
 *
 *  Regla general, que sigue valiendo: el componente que TIENE los datos es el
 *  que tiene que pedir permiso. El layout se transmite ANTES que la página, así
 *  que un control que sólo esté en la página no lo cubre.
 *
 *  **No cachear este layout ni las páginas** (`revalidate`, `use cache`,
 *  `force-static`, un Cache-Control propio) mientras su HTML dependa de quién
 *  mira: el nombre en la cabecera, la vista previa de un administrador. Un
 *  render guardado le serviría a toda la ciudad lo de uno solo — en el peor
 *  caso, la edición sin publicar. Hoy son dinámicas porque leen cookies. */
export default async function DiarioLayout({ children }: LayoutProps<"/">) {
  // Para Migue: sin sesión el chat invita a ingresar en lugar de mandar una
  // pregunta que la API va a rechazar.
  const conSesion = (await usuarioActual()) !== null;

  // `edicionEnFoco()` ya verifica que sea administrador: para un lector esto
  // es siempre null y no cuesta nada.
  const enFoco = await edicionEnFoco();
  const edicion = enFoco ? await getResumenEdicion() : null;
  const fila = enFoco
    ? await db().edicion.findUnique({
        where: { slug: enFoco },
        select: { publicaEn: true },
      })
    : null;

  return (
    <>
      {edicion && (
        <BarraVistaPrevia
          mes={edicion.mes}
          sale={
            !fila?.publicaEn
              ? "todavía no tiene fecha de publicación"
              : fila.publicaEn > new Date()
                ? `sale el ${textoHoraTucuman(fila.publicaEn)}`
                : `salió el ${textoHoraTucuman(fila.publicaEn)}`
          }
        />
      )}
      {/*
       * En el teléfono la hoja TAMBIÉN se apoya sobre la mesa, y no es una
       * decisión estética: es lo que hace legible el giro de página.
       *
       * Estuvo en `px-0 py-0` y la hoja iba a sangre. El giro se calculó bien
       * —la perspectiva está atada al ancho, así que en un teléfono la razón
       * d/W sigue siendo 1.48— pero el encuadre se lo comía: con el lomo pegado
       * al bisel y la hoja tapando el 100% de la pantalla, los primeros 405ms
       * del giro no cambian la silueta (la cara que sale gira HACIA el ojo y se
       * hincha hasta 1.36 veces su ancho: todo ese excedente lo recorta la
       * pantalla), y en el medio quedan ~395ms sin ninguna hoja a la vista. De
       * los 1150ms, dos tercios no llegaban a la pantalla: el lector veía la
       * hoja oscurecerse, después la foto de la ciudad —que nunca había visto—
       * y después la página nueva. Corte de escena, no giro.
       *
       * En escritorio eso nunca pasó porque la hoja mide 1152px en una ventana
       * más ancha: siempre hay mesa a la izquierda del lomo y arriba, así que
       * cuando crece se lee como continuidad. Con estos diez píxeles el teléfono
       * gana lo mismo: se ve el borde de la hoja, la sombra, y el giro vuelve a
       * leerse como un giro.
       *
       * Diez y no veinte: la hoja de un diario en un teléfono necesita todo el
       * ancho que pueda para el texto. Es el mínimo que hace visible el canto.
       */}
      <div className="escritorio flex flex-1 flex-col px-2.5 py-3 sm:px-6 sm:py-8 lg:py-10">
        {/* El proveedor envuelve a los dos: la página, que sabe de qué número
            es lo que está mostrando, y el mando, que necesita saberlo. El
            porqué de este camino —y no de pasarle la ruta al layout— está en
            `foliado-visible.tsx`. */}
        <ProveedorFoliado>
          {children}
          <MandoPaginas paginas={paginasDeEdicion(await getIndice())} />
        </ProveedorFoliado>
        {/* La `key` lo vuelve a montar al entrar o salir de la cuenta: la
            conversación de quien estaba no queda en pantalla para el siguiente. */}
        <MigueChat key={conSesion ? "con-sesion" : "sin-sesion"} conSesion={conSesion} />
      </div>
    </>
  );
}
