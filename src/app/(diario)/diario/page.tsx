import Link from "next/link";
import { ViewTransition } from "react";
import { redirect } from "next/navigation";
import { Masthead } from "@/components/masthead";
import { CitaPersona } from "@/components/cita-persona";
import { SiteFooter } from "@/components/site-footer";
import { FiguraNota } from "@/components/figura-nota";
import { HojaDiario } from "@/components/hoja-diario";
import {
  getCompletas,
  getIndice,
  getResumenEdicion,
} from "@/lib/repos/edicion";
import { getUsuario } from "@/lib/auth/session";
import { transicionPagina } from "@/lib/transiciones";
import { seccionesDeEdicion } from "@/lib/data/secciones";
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
              </div>

              {/* La foto de tapa, a todo el ancho de la hoja. Antes vivía dentro
              de la columna del medio y quedaba del tamaño de una ficha. */}
              {principal.imagen && (
                <FiguraNota
                  alt={principal.imagen.alt}
                  epigrafe={principal.imagen.epigrafe}
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
