import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { ViewTransition } from "react";
import { Masthead } from "@/components/masthead";
import { SiteFooter } from "@/components/site-footer";
import { FiguraNota } from "@/components/figura-nota";
import { medirImagen } from "@/lib/medir-imagen";
import { Bloque } from "@/components/bloque-nota";
import { HojaDiario } from "@/components/hoja-diario";
import { PaginaPdf } from "@/components/pdf/pagina-pdf";
import { DescargarPdf } from "@/components/pdf/descargar-pdf";
import { VerFacsimil } from "@/components/pdf/ver-facsimil";
import { ColumnaDelLector } from "@/components/comentarios/columna-del-lector";
import { CompartirNota } from "@/components/compartir-nota";
import { BotonEscuchar } from "@/components/voz/boton-escuchar";
import { textoDeResumenDeNota } from "@/lib/voz/texto-para-escuchar";
import { NotasRelacionadas } from "@/components/notas-relacionadas";
import { transicionPagina } from "@/lib/transiciones";
import {
  getIndice,
  getIndiceDe,
  getNota,
  getPublicadas,
  getResumenEdicion,
} from "@/lib/repos/edicion";
import { seccionesDeEdicion, slugificarSeccion } from "@/lib/data/secciones";
import { numeroDeNota, paginasDeEdicion } from "@/lib/data/paginas";
import { FoliadoDeLaPagina } from "@/components/foliado-visible";
import { usuarioActual } from "@/lib/auth/dal";
import { firmaPublica } from "@/lib/auth/cidituc/nombre";
import { metadataDeNota } from "@/lib/compartir";
import { imagenDisponible } from "@/lib/data/imagenes";

export async function generateMetadata({
  params,
}: PageProps<"/nota/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const nota = await getNota(slug);
  if (!nota) return { title: "Nota" };
  // Con la nota que se puede LEER, nunca con la que se edita: ver
  // `metadataDeNota`.
  return metadataDeNota({
    ...nota,
    fotoDisponible: imagenDisponible(nota.imagen?.src),
  });
}

/**
 * La nota que muestra hoy una página del impreso que ya no tiene la suya.
 *
 * Cuando la redacción une una nota que el papel tenía en dos páginas, la de la
 * segunda se borra y la primera pasa a cubrir las dos. Pero la dirección de la
 * que se borró ya pudo haber circulado —en un grupo, en un buscador—, y un
 * vecino que la abre no tiene por qué encontrarse con un "no existe": la nota
 * está, en la página de al lado. `null` si la dirección no es de una página del
 * impreso, o si ninguna nota la cubre.
 *
 * Se resuelve con el índice que el lector puede leer (`getIndiceDe` aplica la
 * misma regla de publicación que `getNota`): una edición que todavía no salió
 * no se deja adivinar por acá.
 */
async function notaQueCubre(slug: string): Promise<string | null> {
  const partes = /^(.+)-p(\d{1,3})$/.exec(slug);
  if (!partes) return null;
  const pagina = Number(partes[2]);
  const notas = await getIndiceDe(partes[1]);
  const cubre = notas.find(
    (n) =>
      n.pdfPagina !== undefined &&
      n.pdfPagina < pagina &&
      pagina <= (n.pdfHasta ?? n.pdfPagina),
  );
  return cubre?.slug ?? null;
}

export default async function NotaPage({ params }: PageProps<"/nota/[slug]">) {
  // Leer es libre: sin sesión, `usuario` es null y la página se arma igual.
  const usuario = await usuarioActual();
  // La firma con la que opina quien mira: abreviada, como la ve el resto.
  const firma = usuario ? firmaPublica(usuario.nombre) : null;

  const { slug } = await params;
  const nota = await getNota(slug);
  if (!nota) {
    const cubre = await notaQueCubre(slug);
    if (cubre) redirect(`/nota/${cubre}`);
    notFound();
  }

  const [edicion, indice] = await Promise.all([
    getResumenEdicion(),
    getIndice(),
  ]);

  // Dónde va la foto: a lo ancho si es apaisada, adentro de las columnas si es
  // vertical. medirImagen() está en cache(), así que comparte la lectura con
  // la propia figura.
  const medidas = nota.imagen?.src ? await medirImagen(nota.imagen.src) : null;
  const fotoVertical = medidas ? medidas.alto / medidas.ancho > 1.1 : false;

  // El foliado se cuenta sobre la edición DE LA NOTA, no sobre la que está en
  // la calle: en el archivo son distintas.
  //
  // Pero cuando la nota ES de la edición en curso —el caso normal, todo lo que
  // no es archivo— el índice que hace falta es el que ya se trajo arriba. Sin
  // esta comparación se pedía dos veces la misma lista de notas, y como el pool
  // era de una conexión, el segundo viaje esperaba al primero.
  const indiceDeSuEdicion =
    nota.edicionSlug === edicion.slug
      ? indice
      : await getIndiceDe(nota.edicionSlug);
  // La regla vive en `paginas.ts`: el número es la posición de la nota en su
  // edición, como la recorre el lector. El del papel queda en el facsímil.
  const numeroPagina = numeroDeNota(indiceDeSuEdicion, nota.slug);

  /*
   * Qué páginas del impreso muestra esta nota. Casi siempre una; dos cuando la
   * redacción unió una nota que el papel tenía partida (ver
   * `NotaResumen.pdfHasta`). El dato viene del índice: `getNota()` trae una
   * sola fila y desde una sola fila no se sabe dónde empieza la siguiente.
   */
  const paginasDelImpreso: number[] = [];
  if (nota.pdfPagina) {
    const hasta =
      indiceDeSuEdicion.find((n) => n.slug === nota.slug)?.pdfHasta ??
      nota.pdfPagina;
    for (let p = nota.pdfPagina; p <= hasta; p++) paginasDelImpreso.push(p);
  }

  /*
   * La edición DE LA NOTA, que es de donde sale su PDF.
   *
   * En el archivo no es la que está en la calle: una página de agosto tiene que
   * dibujarse con el PDF de agosto. Cuando coinciden —todo lo que no es
   * archivo— ya se trajo arriba y no cuesta una consulta más.
   *
   * Se resuelve acá arriba, y no adentro de la rama del facsímil como estaba,
   * porque ahora hay DOS lugares que necesitan el PDF: la página sin
   * digitalizar, que lo dibuja entero, y la digitalizada, que ofrece el botón
   * para verlo.
   */
  const suEdicion =
    nota.edicionSlug === edicion.slug
      ? edicion
      : (await getPublicadas()).find((e) => e.slug === nota.edicionSlug);

  /*
   * La cabecera representa la edición DE LA NOTA, por lo mismo que el PDF y el
   * foliado de acá arriba.
   *
   * Hace falta desde que la barra tiene identidad de número: de acá salen el
   * mes que rotula el selector de ediciones, en qué fila cae el tilde, y a
   * dónde apunta la pestaña "Notas". Con la edición en la calle, leyendo la
   * página 4 de agosto la barra decía SEPTIEMBRE y "Notas" sacaba al lector de
   * su propio número — el mismo callejón que la pestaña vino a cerrar.
   *
   * Las secciones, por lo mismo: se listan las de la edición de la nota, que es
   * de donde sale `seccionActiva`. Calculadas sobre el índice de la calle, en
   * el archivo nunca podían coincidir.
   *
   * El `?? edicion` cubre al administrador mirando una edición en foco todavía
   * sin publicar: ahí `getPublicadas()` no la encuentra y la de la calle —que
   * en vista previa ES la enfocada— es el dato correcto.
   */
  const edicionDeLaNota = suEdicion ?? edicion;
  const seccionesDeLaNota = seccionesDeEdicion(indiceDeSuEdicion);
  const esDeLaCalle = nota.edicionSlug === edicion.slug;

  /*
   * A dónde vuelve el enlace de arriba.
   *
   * A la portada si la nota es del número en curso, que es de donde se vino. En
   * el archivo eso mandaba a la tapa de OTRO mes —la de la calle—, así que
   * volver a la lista de la que se estaba leyendo no tenía enlace: ahora va al
   * sumario de su propio número.
   */
  const volver = esDeLaCalle
    ? { href: "/diario", texto: `Portada de ${edicionDeLaNota.mes}` }
    : {
        href: `/edicion/${nota.edicionSlug}`,
        texto: `Sumario de ${edicionDeLaNota.mes}`,
      };

  /*
   * El foliado de un número del ARCHIVO, para que se pueda recorrer con las
   * flechas igual que el del mes.
   *
   * Sólo cuando no es la edición en la calle: esa ya se la sabe el mando, que
   * la recibe del layout. Así la pantalla normal —que es casi todas— no lleva
   * ni un byte de más. El porqué de este camino está en `foliado-visible.tsx`.
   */
  const foliadoDelArchivo = esDeLaCalle
    ? null
    : paginasDeEdicion(indiceDeSuEdicion, { enLaCalle: false });

  /*
   * Una página del facsímil del impreso.
   *
   * El PDF es el de LA EDICIÓN DE LA NOTA, no el de la que está en la calle: en
   * el archivo son distintas, y una página de agosto tiene que dibujarse con el
   * PDF de agosto. Cuando coinciden —todo lo que no es archivo— ya se trajo
   * arriba y no cuesta una consulta más.
   *
   * De acá para abajo no hay cuerpo, ni foto, ni minutos de lectura, ni botón
   * de escuchar: nada de eso existe en un facsímil. Lo que sí queda es la
   * columna del lector, porque una página del impreso se comenta igual que una
   * nota — para eso cada una es una fila de `notas`.
   */
  /*
   * `cuerpo.length === 0` es lo que separa una página digitalizada de una que
   * todavía no lo está.
   *
   * Una página del impreso SIN digitalizar no tiene otra cosa que mostrar que
   * el dibujo del PDF, y es el camino de abajo. Una página digitalizada tiene
   * título, bajada, texto y fotos de verdad: se dibuja como cualquier nota —que
   * es lo único que se lee en un teléfono— y el facsímil queda a un botón, con
   * `VerFacsimil`.
   *
   * La condición mira el cuerpo y no una columna nueva a propósito: el dato ya
   * está y no puede desincronizarse. Una página con cuerpo ES una página
   * digitalizada, por definición y no por convención.
   */
  if (nota.pdfPagina && nota.cuerpo.length === 0) {
    // Sin PDF cargado no hay página que dibujar, y entonces cae al camino de
    // siempre —que muestra una nota vacía— en vez de romper. Es el hueco que
    // queda mientras se reemplaza el archivo de un número.
    if (suEdicion?.pdf) {
      const pdf = suEdicion.pdf;
      return (
        <ViewTransition {...transicionPagina}>
          <HojaDiario
            numeroPagina={numeroPagina}
            edicionSlug={nota.edicionSlug}
          >
            {foliadoDelArchivo && (
              <FoliadoDeLaPagina paginas={foliadoDelArchivo} />
            )}
            {/* Sin bandera ni folio: la hoja del PDF los trae impresos, y
                dibujar los nuestros encima los mostraba dos veces. El foliado
                nuestro sigue al pie, en el pasador de páginas. */}
            <Masthead
              edicion={edicionDeLaNota}
              secciones={esDeLaCalle ? seccionesDeLaNota : []}
              usuario={usuario}
              seccionActiva={slugificarSeccion(nota.seccion)}
              pagina={numeroPagina}
              facsimil
            />

            <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
              <nav aria-label="Volver" className="mb-7">
                <Link
                  href={volver.href}
                  transitionTypes={["pagina-atras"]}
                  className="group inline-flex items-center gap-2 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-3 transition-colors hover:text-accent"
                >
                  <ArrowLeft
                    className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-1"
                    aria-hidden="true"
                  />
                  {volver.texto}
                </Link>
              </nav>

              {/* Una hoja por página del impreso: dos si la nota se unió. */}
              <div className="grid gap-8">
                {paginasDelImpreso.map((pagina) => (
                  <PaginaPdf
                    key={pagina}
                    url={pdf.url}
                    pagina={pagina}
                    etiqueta={`Página ${pagina} de El Sanmiguelino, ${suEdicion.mes}`}
                  />
                ))}
              </div>

              <DescargarPdf
                url={suEdicion.pdf.url}
                mes={suEdicion.mes}
                paginas={suEdicion.pdf.paginas}
              />

              <ColumnaDelLector notaSlug={nota.slug} firma={firma} />
            </main>

            <SiteFooter />
          </HojaDiario>
        </ViewTransition>
      );
    }
  }

  return (
    <>
      {/* Avance de lectura: lo mueve el scroll, sin JavaScript. Queda fuera de
          la transición porque no es parte del papel. */}
      <div className="progreso-lectura" aria-hidden="true" />

      <ViewTransition {...transicionPagina}>
        <HojaDiario numeroPagina={numeroPagina} edicionSlug={nota.edicionSlug}>
          {foliadoDelArchivo && (
            <FoliadoDeLaPagina paginas={foliadoDelArchivo} />
          )}
          <Masthead
            edicion={edicionDeLaNota}
            secciones={esDeLaCalle ? seccionesDeLaNota : []}
            usuario={usuario}
            seccionActiva={slugificarSeccion(nota.seccion)}
            pagina={numeroPagina}
          />

          <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
            <nav aria-label="Volver" className="mb-7">
              <Link
                href={volver.href}
                transitionTypes={["pagina-atras"]}
                className="group inline-flex items-center gap-2 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-3 transition-colors hover:text-accent"
              >
                <ArrowLeft
                  className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-1"
                  aria-hidden="true"
                />
                {volver.texto}
              </Link>
            </nav>

            <article>
              <header className="entra">
                <p className="volanta text-accent">{nota.seccion}</p>
                <h1 className="titular mt-2.5 text-[clamp(1.9rem,5.4vw,3.5rem)] text-ink">
                  {nota.titulo}
                </h1>
                {nota.bajada && (
                  <p className="bajada mt-4 max-w-3xl text-[clamp(0.98rem,1.6vw,1.15rem)]">
                    {nota.bajada}
                  </p>
                )}
                <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-hairline py-2.5">
                  <p className="meta">San Miguel de Tucumán</p>
                  <span aria-hidden="true" className="text-line">
                    ·
                  </span>
                  {/* El mes de SU edición. Decía el de la que está en la calle,
                      así que una nota de agosto leída en septiembre aparecía
                      fechada en septiembre: no es un detalle de navegación, es
                      un dato mal puesto arriba del texto. */}
                  <p className="meta">{edicionDeLaNota.mes}</p>
                  <span aria-hidden="true" className="text-line">
                    ·
                  </span>
                  <p className="meta inline-flex items-center gap-1.5">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {nota.minutosLectura} min
                  </p>
                  {/* Al lado de los minutos y no abajo de la nota: la franja ya
                      contesta "¿cuánto me lleva esto?", y escuchar en vez de
                      leer se decide antes de leer. El texto se arma acá, en el
                      servidor, para que el click no tenga que resolver nada. */}
                  {/* La voz de Migue la paga el municipio y pide sesión; sin
                      `fuente`, quien no ingresó escucha con la voz del
                      navegador directamente, sin un pedido que va a rebotar. */}
                  <BotonEscuchar
                    separador
                    texto={textoDeResumenDeNota(nota)}
                    fuente={usuario ? { que: "nota", slug: nota.slug } : undefined}
                  />
                </div>
                {/* El facsímil, para una página que salió en papel. Va debajo
                    de la franja de meta y no dentro: no es un dato de la nota
                    —cuánto tarda, de qué mes es— sino otra manera de verla. */}
                {nota.pdfPagina && suEdicion?.pdf && (
                  <div className="mt-3">
                    <VerFacsimil
                      url={suEdicion.pdf.url}
                      paginas={paginasDelImpreso}
                      mes={suEdicion.mes}
                    />
                  </div>
                )}
              </header>

              {/* La apaisada va arriba, a lo ancho. La vertical entra en el
              flujo de las columnas —ocupa la primera y el texto sigue por las
              otras—, que es lo que hace un diario con una foto parada. A todo
              lo ancho dejaría dos costados muertos. */}
              {nota.imagen && !fotoVertical && (
                <FiguraNota
                  alt={nota.imagen.alt}
                  epigrafe={nota.imagen.epigrafe}
                  credito={nota.imagen.credito}
                  src={nota.imagen.src}
                  prioridad
                  className="entra entra-2 mx-auto mt-9 max-w-4xl"
                  sizes="(min-width: 1024px) 900px, 100vw"
                />
              )}

              <div className="entra entra-3 note-columns mx-auto mt-9 max-w-6xl">
                {nota.imagen && fotoVertical && (
                  <FiguraNota
                    alt={nota.imagen.alt}
                    epigrafe={nota.imagen.epigrafe}
                  credito={nota.imagen.credito}
                    src={nota.imagen.src}
                    prioridad
                    className="mb-4"
                  />
                )}
                {nota.cuerpo.map((bloque, i) => (
                  <Bloque key={i} bloque={bloque} notaSlug={nota.slug} indice={i} />
                ))}
              </div>

              {/* Cierre de nota, como el cuadratín del impreso */}
              <span
                aria-hidden="true"
                className="mx-auto mt-8 block h-[7px] w-[7px] bg-accent"
              />
            </article>

            <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-between gap-4 border-t border-hairline pt-5">
              <p className="meta">Compartir esta nota</p>
              <CompartirNota titulo={nota.titulo} />
            </div>

            <NotasRelacionadas notaSlug={nota.slug} />

            <ColumnaDelLector notaSlug={nota.slug} firma={firma} />
          </main>

          <SiteFooter />
        </HojaDiario>
      </ViewTransition>
    </>
  );
}
