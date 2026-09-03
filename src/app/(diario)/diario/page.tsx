import Link from "next/link";
import { ViewTransition } from "react";
import { redirect } from "next/navigation";
import { Masthead } from "@/components/masthead";
import { CitaPersona } from "@/components/cita-persona";
import { SiteFooter } from "@/components/site-footer";
import { FiguraNota } from "@/components/figura-nota";
import { HojaDiario } from "@/components/hoja-diario";
import { PaginaPdf } from "@/components/pdf/pagina-pdf";
import { DescargarPdf } from "@/components/pdf/descargar-pdf";
import { BotonEscuchar } from "@/components/voz/boton-escuchar";
import { textoDeResumenDeTapa } from "@/lib/voz/texto-para-escuchar";
import {
  getCompletas,
  getIndice,
  getResumenEdicion,
} from "@/lib/repos/edicion";
import { getUsuario } from "@/lib/auth/session";
import { transicionPagina } from "@/lib/transiciones";
import { seccionesDeEdicion } from "@/lib/data/secciones";
import { medirImagen } from "@/lib/medir-imagen";
import type { NotaCompleta } from "@/lib/types";

function parrafosDe(nota: NotaCompleta): string[] {
  return nota.cuerpo.filter((b) => b.tipo === "parrafo").map((b) => b.texto);
}

function citaDe(nota: NotaCompleta) {
  const bloque = nota.cuerpo.find((b) => b.tipo === "cita");
  return bloque?.tipo === "cita" ? bloque : null;
}

export default async function Portada() {
  const usuario = await getUsuario();
  if (!usuario) redirect("/login");

  const [edicion, indice] = await Promise.all([
    getResumenEdicion(),
    getIndice(),
  ]);

  /*
   * El número publicado como facsímil del impreso: la tapa es la página 1 del
   * PDF y no hay tapa que maquetar.
   *
   * La rama sale ACÁ, antes de mirar la primera nota, y no más abajo en el JSX:
   * todo lo que viene después —el cuerpo de la nota principal, medir la foto,
   * partir los párrafos— es trabajo sobre una nota escrita que en una edición
   * de PDF no existe.
   *
   * La barra de secciones sigue siendo la de siempre: las páginas del facsímil
   * son de la sección "Edición impresa", así que la barra muestra Portada y esa
   * sola entrada, o el tema del número si tiene.
   */
  /*
   * La condición no es "¿hay PDF?" sino "¿hay PDF y NADIE cubre la página 1?".
   *
   * Una edición digitalizada conserva su PDF —el facsímil sigue estando, a un
   * botón, en cada página— así que preguntar sólo por `edicion.pdf` mandaba a
   * la tapa a dibujar la página 1 del archivo aunque estuviera digitalizada, que
   * es justamente la pantalla ilegible que hay que sacar del teléfono.
   *
   * El signo es estructural y no una convención: al digitalizar, la página 1 del
   * impreso pasa a ser la primera nota de la edición —la tapa del papel ES un
   * artículo, y esta portada está hecha para mostrar exactamente eso—, mientras
   * que un facsímil sin digitalizar empieza a numerar en la 2 y deja la 1 acá.
   */
  if (edicion.pdf && !indice.some((n) => n.pdfPagina === 1)) {
    return (
      <ViewTransition {...transicionPagina}>
        <HojaDiario numeroPagina={1}>
          {/* Sin bandera: la página 1 del PDF ya es la tapa del diario, con su
              logotipo impreso. Ver el porqué en `Masthead`. */}
          <Masthead
            edicion={edicion}
            secciones={seccionesDeEdicion(indice)}
            usuario={usuario}
            facsimil
          />
          <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
            <PaginaPdf
              url={edicion.pdf.url}
              pagina={1}
              etiqueta={`Tapa de El Sanmiguelino, ${edicion.mes}`}
            />
            <DescargarPdf
              url={edicion.pdf.url}
              mes={edicion.mes}
              paginas={edicion.pdf.paginas}
            />
          </main>
          <SiteFooter />
        </HojaDiario>
      </ViewTransition>
    );
  }
  // Un administrador puede estar mirando una edición todavía sin notas: la
  // elección automática ya las exige, pero la vista previa no —y no debería,
  // porque justamente sirve para ir viendo cómo queda mientras se arma—.
  const primera = indice[0];
  const [principal] = primera ? await getCompletas([primera.slug]) : [];

  /*
   * Todo esto se calcula **sólo si hay nota**, y no es una precaución de más:
   * el caso de arriba —una edición en preparación, sin notas todavía— tenía su
   * cartel escrito más abajo en el JSX, pero estas tres líneas corrían primero
   * y sin condición. Previsualizar una edición recién creada tiraba
   * "Cannot read properties of undefined (reading 'cuerpo')" antes de llegar
   * al cartel. Un guard que se saltea no es un guard.
   */
  /*
   * Dónde va la foto de tapa: arriba o adentro de las columnas.
   *
   * Una foto **apaisada** va a todo el ancho de la hoja, como el banner del
   * impreso, y el texto arranca debajo. Una **vertical** no: a todo el ancho
   * dejaría dos costados muertos y el texto empezaría recién abajo de todo.
   * Metida en el flujo de las columnas ocupa la primera y el texto sigue por
   * las otras dos — que es exactamente lo que hace un diario con una foto
   * parada—.
   *
   * `medirImagen()` está en `cache()`, así que esto no agrega una lectura:
   * comparte la que hace la propia figura.
   */
  const medidas = principal?.imagen?.src
    ? await medirImagen(principal.imagen.src)
    : null;
  const fotoVertical = medidas ? medidas.alto / medidas.ancho > 1.1 : false;

  const parrafos = principal ? parrafosDe(principal) : [];
  const cita = principal ? citaDe(principal) : null;
  // Las notas empiezan en la página 2: la 1 es esta portada.
  const paginaPrincipal = principal
    ? indice.findIndex((n) => n.slug === principal.slug) + 2
    : 1;

  return (
    <ViewTransition {...transicionPagina}>
      <HojaDiario numeroPagina={1}>
        <Masthead
          edicion={edicion}
          secciones={seccionesDeEdicion(indice)}
          usuario={usuario}
        />
        {/*
         * La tapa lleva UNA sola nota, como el impreso: bandera, titular,
         * bajada, foto a todo el ancho y el cuerpo en columnas. No hay
         * segunda nota compitiendo ni grilla de fichas al pie — al resto de
         * la edición se llega pasando página, que es el gesto que el diario
         * ya tiene, y por la barra de secciones de la bandera.
         */}
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          {!principal ? (
            /* Edición en preparación: sólo la ve un administrador que la puso
               en foco, porque la elección automática exige que tenga notas. */
            <p className="bajada py-16 text-center">
              Esta edición todavía no tiene notas cargadas.
            </p>
          ) : (
            <>
              {/* Apertura. Alineada a la IZQUIERDA: los diarios no centran la
              tapa, arman una grilla y la cuelgan del margen. Centrar era lo
              que más la hacía leer como artículo destacado de blog. */}
              <div className="entra">
                <p className="volanta text-accent">{principal.seccion}</p>
                <h1 className="titular mt-2.5 text-[clamp(2rem,6.2vw,4.1rem)] text-ink">
                  <Link
                    href={`/nota/${principal.slug}`}
                    transitionTypes={["pagina-adelante"]}
                    className="transition-colors hover:text-accent-strong"
                  >
                    {principal.titulo}
                  </Link>
                </h1>
                <p className="bajada mt-4 max-w-4xl text-[clamp(1rem,1.7vw,1.22rem)]">
                  {principal.bajada}
                </p>
                {/* Treinta segundos: qué edición es, de qué se trata y la nota
                    principal. El sumario de las ocho notas son dos minutos y es
                    otro control, para otra vuelta. */}
                <div className="mt-5">
                  <BotonEscuchar
                    texto={textoDeResumenDeTapa(edicion, principal)}
                    fuente={{ que: "tapa" }}
                    etiqueta="Escuchar la tapa"
                    descripcion="la tapa de esta edición"
                  />
                </div>
              </div>

              {/* La foto apaisada, a todo el ancho de la hoja. Antes vivía
              dentro de la columna del medio y quedaba del tamaño de una ficha.
              La vertical va abajo, adentro de las columnas: ver arriba. */}
              {principal.imagen && !fotoVertical && (
                <FiguraNota
                  alt={principal.imagen.alt}
                  epigrafe={principal.imagen.epigrafe}
                  credito={principal.imagen.credito}
                  src={principal.imagen.src}
                  prioridad
                  className="entra entra-2 mt-6"
                  sizes="(min-width: 1024px) 1088px, 100vw"
                />
              )}

              {/* El cuerpo en columnas. La cita va adentro del flujo y cruza todas
              las columnas: en el papel ocupa el ancho de dos, pero multicol no
              sabe abarcar 2 de 3 — sólo todas o una. Cruzarlas enteras es la
              versión honesta del mismo recurso, y aguanta los tres
              breakpoints sin maquetar cada uno a mano. */}
              <div className="entra entra-3 note-columns mt-8">
                {/* Primera de la columna uno: el texto la rodea por las otras. */}
                {principal.imagen && fotoVertical && (
                  <FiguraNota
                    alt={principal.imagen.alt}
                    epigrafe={principal.imagen.epigrafe}
                  credito={principal.imagen.credito}
                    src={principal.imagen.src}
                    prioridad
                    className="mb-4"
                  />
                )}

                {parrafos.slice(0, 2).map((texto, i) => (
                  <p
                    key={`a${i}`}
                    className="texto-diario font-serif text-[0.95rem] leading-[1.7] text-ink"
                  >
                    {texto}
                  </p>
                ))}

                {cita && (
                  <CitaPersona
                    texto={cita.texto}
                    autor={cita.autor}
                    cargo={cita.cargo}
                    retrato={cita.retrato}
                    className="my-6 [column-span:all]"
                  />
                )}

                {parrafos.slice(2).map((texto, i) => (
                  <p
                    key={`b${i}`}
                    className="texto-diario font-serif text-[0.95rem] leading-[1.7] text-ink"
                  >
                    {texto}
                  </p>
                ))}
              </div>

              {/* El remate del impreso: la nota sigue en su página. */}
              <p className="mt-7 border-t border-hairline pt-3.5 font-serif text-[0.9rem] italic text-ink-3">
                Sigue en la página{" "}
                <Link
                  href={`/nota/${principal.slug}`}
                  transitionTypes={["pagina-adelante"]}
                  className="enlace not-italic tabular-nums"
                >
                  {paginaPrincipal}
                </Link>
              </p>
            </>
          )}
        </main>

        <SiteFooter />
      </HojaDiario>
    </ViewTransition>
  );
}
