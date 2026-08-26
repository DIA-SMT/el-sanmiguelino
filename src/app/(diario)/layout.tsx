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
      <div className="escritorio flex flex-1 flex-col px-0 py-0 sm:px-6 sm:py-8 lg:py-10">
        {children}
        <MandoPaginas paginas={paginasDeEdicion(await getIndice())} />
        <MigueChat />
      </div>
    </>
  );
}
