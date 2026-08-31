import { redirect } from "next/navigation";
import { MandoPaginas } from "@/components/mando-paginas";
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
 *  Y por eso mismo este layout **verifica la sesión por su cuenta**, además de
 *  hacerlo cada página. No es defensa en profundidad decorativa: el layout se
 *  renderiza y se transmite ANTES que la página, así que su `redirect()` no lo
 *  cubre. Con un token de firma inválida pero bien formado —que cualquiera
 *  puede fabricar, porque el proxy sólo mira la estructura— el índice completo
 *  de la edición viajaba entero al atacante: los títulos van en los
 *  `aria-label` de las flechas y en las props serializadas.
 *
 *  Regla general: el componente que TIENE los datos es el que tiene que pedir
 *  permiso. */
export default async function DiarioLayout({ children }: LayoutProps<"/">) {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/login");

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
        {children}
        <MandoPaginas paginas={paginasDeEdicion(await getIndice())} />
        <MigueChat />
      </div>
    </>
  );
}
