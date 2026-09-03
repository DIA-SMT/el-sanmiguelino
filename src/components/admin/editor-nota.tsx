"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Plus,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { guardarNotaAction, subirImagenAction } from "@/app/admin/acciones";
import {
  clasesDeBoton,
  clasesDeBotonIcono,
  clasesDeCampo,
  SeccionPanel,
  TarjetaPanel,
} from "@/components/admin/piezas";
import type { BloqueNota, NotaCompleta } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Editor de una nota.
 *
 * El cuerpo se edita como una **lista de bloques tipados**, no como un campo
 * de texto rico. Es a propósito: el diario tiene cinco formas —párrafo,
 * subtítulo, cita, destacado y ficha— y cada una se maqueta distinto en la
 * hoja. Un editor de texto libre obligaría a adivinar cuál es cuál al
 * renderizar, y a la primera nota pegada desde Word el diario se llena de
 * negritas y tamaños que no existen en el sistema.
 *
 * Los bloques se mueven con botones y no arrastrando. No es pereza: la WCAG
 * 2.2 (SC 2.5.7) exige que todo lo que se hace arrastrando se pueda hacer con
 * un solo puntero, así que el arrastre sería trabajo extra sobre esto mismo,
 * no en lugar de esto.
 *
 * El formulario se arma con las piezas del panel (`SeccionPanel`,
 * `TarjetaPanel`) y no con marcado propio: cada bloque del cuerpo ES una
 * tarjeta que flota sobre el fondo gris, igual que las tarjetas del resto del
 * panel. Lo único que se escribe acá son los campos, que las piezas no cubren.
 */

const TIPOS: { valor: BloqueNota["tipo"]; nombre: string; ayuda: string }[] = [
  { valor: "parrafo", nombre: "Párrafo", ayuda: "Texto corrido de la nota." },
  {
    valor: "subtitulo",
    nombre: "Subtítulo",
    ayuda: "Corta la nota en secciones.",
  },
  {
    valor: "cita",
    nombre: "Cita",
    ayuda: "Lo que dijo alguien, con su nombre y cargo.",
  },
  {
    valor: "destacado",
    nombre: "Destacado",
    ayuda: "Una frase de la propia nota, subrayada. Sin autor.",
  },
  {
    valor: "ficha",
    nombre: "Ficha de datos",
    ayuda: "Recuadro con entradas, para consultar y no para leer de corrido.",
  },
  {
    valor: "foto",
    nombre: "Foto",
    ayuda: "Una foto dentro del texto, con su epígrafe. Para páginas de fotos.",
  },
];

/**
 * Convierte un bloque a otro tipo **conservando lo que se pueda**.
 *
 * Antes lo reemplazaba por uno vacío, así que elegir "destacado" sobre un
 * párrafo de ochocientas palabras las borraba de un gesto y sin preguntar.
 * Ahora el texto viaja entre todos los tipos que tienen texto, y hacia una
 * ficha entra como título. Lo único que se pierde es lo que el tipo destino no
 * puede representar, y eso ya no es un accidente.
 */
function convertirBloque(
  bloque: BloqueNota,
  tipo: BloqueNota["tipo"],
): BloqueNota {
  if (bloque.tipo === tipo) return bloque;
  // Qué cuenta como "el texto" de cada tipo: el título de una ficha y el
  // epígrafe de una foto, que es lo único que un humano escribió ahí.
  const texto =
    bloque.tipo === "ficha"
      ? bloque.titulo
      : bloque.tipo === "foto"
        ? (bloque.epigrafe ?? "")
        : bloque.texto;

  switch (tipo) {
    case "cita":
      return {
        tipo: "cita",
        texto,
        autor: bloque.tipo === "cita" ? bloque.autor : "",
      };
    case "ficha":
      return {
        tipo: "ficha",
        titulo: texto,
        entradas: [{ lead: "", texto: "" }],
      };
    case "foto":
      // El texto baja a epígrafe y la foto queda sin archivo: convertir un
      // párrafo en foto no puede inventar una imagen. Se guarda recién cuando
      // el editor sube una, que es lo que exige `validarBloque`.
      return { tipo: "foto", src: "", alt: texto, epigrafe: texto };
    default:
      return { tipo, texto };
  }
}

/**
 * Enter en un campo de una línea NO publica la nota.
 *
 * Con un botón de envío presente, el HTML manda el formulario al apretar Enter
 * en cualquier `input`, y acá eso significa publicar de un tecleo mientras se
 * está cargando una ficha campo por campo. Se guarda con el botón, a propósito.
 *
 * Va en los inputs y no en el `<form>`: un formulario no es un elemento
 * interactivo, y colgarle escuchas de teclado esconde el comportamiento de
 * quien navega por teclado (además de que la regla de accesibilidad lo marca,
 * con razón). Los `textarea` quedan afuera: ahí Enter es un salto de línea.
 */
const sinEnviarConEnter = {
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.preventDefault();
  },
};

/* ---------------------------------------------------------------------------
   El aspecto de los campos
   ---------------------------------------------------------------------------
   El aspecto NO se decide acá: viene de `clasesDeCampo()`, en `piezas.tsx`.
   Acá se guarda en una constante nada más para no llamarla en cada campo.

   Lo que sí es decisión de este archivo es el argumento: `"tarjeta"`. Un campo
   es siempre la superficie contraria a la que tiene abajo, y acá lo que tiene
   abajo es una tarjeta —por eso los bloques del cuerpo son tarjetas y no
   recuadros hundidos: si lo fueran, el campo tendría el mismo fondo que su
   alrededor y habría que inventarle un segundo aspecto.

   Antes esto era una cadena escrita a mano, y era una de las cinco copias del
   mismo campo que había en el panel: 0,88rem de letra donde otras pantallas
   ponían 0,8 o 0,85, y el filete de las TARJETAS (`--panel-borde`), que sobre
   un campo vacío mide 1,23:1 cuando ese filete es el único límite del control.
--------------------------------------------------------------------------- */

const campo = clasesDeCampo("tarjeta");
/** El campo que guarda una dirección: el slug y el archivo de la foto, que se
 *  leen carácter por carácter y por eso van en monoespaciada.
 *
 *  Sólo cambia la familia. Antes además bajaba la letra a 0,8rem —uno de los
 *  diecinueve tamaños—, y no vuelve: el cuerpo de un campo es `text-panel-base`
 *  y un campo que se lee letra por letra es el último al que conviene achicar. */
const campoMono = cn(campo, "font-mono");
const etiqueta = "block text-panel-sm font-medium text-panel-tinta-2";
const ayudaCampo = "mt-1.5 block text-panel-sm text-panel-tinta-3";

/* ---------------------------------------------------------------------------
   El aspecto de los botones
   ---------------------------------------------------------------------------
   Tampoco se decide acá: viene de `clasesDeBoton()` y `clasesDeBotonIcono()`,
   en `piezas.tsx`. Antes esto era una constante escrita a mano —una de las SEIS
   copias del mismo botón que había en el panel—, con un alto (`min-h-8`) y un
   relleno (`px-3.5 py-2`) que no coincidían con ninguna de las otras cinco.

   Lo que sí decide este archivo es sobre qué superficie apoya cada uno, que es
   lo único que cambia entre ellos. Se calculan una vez, en el módulo, porque
   son funciones puras de constantes: llamarlas en cada render no aportaría
   nada.

   **Se extienden concatenando, nunca con `cn()`.** `cn()` es `twMerge` sin
   configurar y no conoce la escala del panel: toma `text-panel-sm` por un color
   de texto y lo tira apenas hay otro `text-*` en la cadena, así que el botón
   perdería su tamaño en silencio. Está explicado en `piezas.tsx`. */
const botonSecundario = clasesDeBoton({ tono: "secundario" });
/** El de "Agregar bloque", que es el único que apoya sobre el gris de la
 *  página y no dentro de una tarjeta: le toca el relleno contrario. */
const botonEnLaPagina = clasesDeBoton({ tono: "secundario", sobre: "pagina" });
const botonPrimario = clasesDeBoton({ tono: "primario" });
/** El "Agregar entrada" de una ficha: es el botón de adentro del bloque, el que
 *  acompaña, y por eso no tiene caja. Antes iba con la palabra teñida de acento;
 *  el acento en el panel es cromo y manda en un solo control por pantalla, que
 *  acá es "Guardar". */
const botonFantasmaChico = clasesDeBoton({ tono: "fantasma", tamano: "chico" });

/**
 * El rojo de los errores, mezclado con la tinta del panel.
 *
 * Acá **no** se usa `dark:`: en este proyecto esa variante mira la preferencia
 * del SISTEMA, y el panel además tiene un toggle propio. Con el sistema en
 * claro y el toggle en oscuro, un `dark:text-red-400` no se aplicaba nunca y el
 * rojo oscuro quedaba en 3:1 sobre la tarjeta —justo el mensaje que hay que
 * poder leer—. Mezclar con `--panel-tinta`, que sí cambia con el tema, deja una
 * sola fórmula que da 7,7:1 en claro y 5:1 en oscuro.
 */
const tintaAlerta =
  "color-mix(in srgb, var(--grafico-alerta) 72%, var(--panel-tinta))";

export function EditorNota({
  nota,
  secciones,
  ediciones,
  edicionInicial,
}: {
  /** La nota a editar, o null para una nota nueva. */
  nota: NotaCompleta | null;
  /** Todas las ediciones, de la más nueva a la más vieja. */
  ediciones: {
    slug: string;
    mes: string;
    estado: "publicada" | "programada" | "sin_fecha";
  }[];
  /** A qué edición va por defecto: la de la nota, o la que está en foco. */
  edicionInicial: string;
  /** Las secciones que ya existen en la edición, para no inventar nombres
   *  nuevos por un error de tipeo. Igual se puede escribir una. */
  secciones: string[];
}) {
  const router = useRouter();
  const [guardando, iniciarGuardado] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /**
   * "Guardado" se apaga en cuanto se toca cualquier cosa.
   *
   * Antes se prendía al guardar y no lo apagaba nada: el editor corregía el
   * título, agregaba párrafos, y la barra seguía diciendo "Ya está en el
   * diario" sobre cambios que sólo existían en su pantalla. Un cartel de éxito
   * que sobrevive al cambio siguiente es peor que no tener cartel.
   */
  const [guardado, setGuardado] = useState(false);
  const [sucio, setSucio] = useState(false);

  /** Todo cambio del formulario pasa por acá: marca sucio y baja el cartel. */
  function alEditar<T>(set: (v: T) => void) {
    return (v: T) => {
      setGuardado(false);
      setSucio(true);
      set(v);
    };
  }

  const slugOriginal = nota?.slug;
  const [edicionSlug, setEdicionSlug] = useState(edicionInicial);
  const [slug, setSlug] = useState(nota?.slug ?? "");
  const [seccion, setSeccion] = useState(nota?.seccion ?? "");
  const [titulo, setTitulo] = useState(nota?.titulo ?? "");
  const [bajada, setBajada] = useState(nota?.bajada ?? "");
  const [imagenSrc, setImagenSrc] = useState(nota?.imagen?.src ?? "");
  const [imagenAlt, setImagenAlt] = useState(nota?.imagen?.alt ?? "");
  const [imagenEpigrafe, setImagenEpigrafe] = useState(
    nota?.imagen?.epigrafe ?? "",
  );
  const [imagenCredito, setImagenCredito] = useState(
    nota?.imagen?.credito ?? "",
  );
  const [subiendo, setSubiendo] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const [cuerpo, setCuerpo] = useState<BloqueNota[]>(
    nota?.cuerpo ?? [{ tipo: "parrafo", texto: "" }],
  );

  function editarBloque(i: number, cambios: Partial<BloqueNota>) {
    setGuardado(false);
    setSucio(true);
    setCuerpo((prev) =>
      prev.map((b, k) => (k === i ? ({ ...b, ...cambios } as BloqueNota) : b)),
    );
  }

  /**
   * Mueve un bloque y **lleva el foco con él**.
   *
   * Sin la segunda parte, mover con el teclado no funciona: la lista se dibuja
   * con la posición como `key`, así que React reusa el mismo nodo y el foco se
   * queda en la FILA, no en el bloque. El editor apretaba "Bajar" dos veces
   * esperando mover el bloque dos lugares y la segunda pulsación se lo traía de
   * vuelta —el botón ahora mandaba sobre el bloque de al lado—. Dos
   * pulsaciones, cero movimiento y ninguna pista de por qué.
   */
  function mover(i: number, delta: number) {
    const destino = i + delta;
    if (destino < 0 || destino >= cuerpo.length) return;
    setGuardado(false);
    setSucio(true);
    setCuerpo((prev) => {
      const copia = [...prev];
      [copia[i], copia[destino]] = [copia[destino], copia[i]];
      return copia;
    });
    queueMicrotask(() => {
      document
        .querySelector<HTMLButtonElement>(
          `[data-bloque="${destino}"] [data-mover="${delta < 0 ? "subir" : "bajar"}"]`,
        )
        ?.focus();
    });
  }

  /**
   * Aviso antes de cerrar o recargar con cambios sin guardar.
   *
   * Cubre lo que el navegador deja cubrir: cerrar la pestaña, recargar, ir a
   * otro sitio. **No** cubre las navegaciones internas del App Router —hacer
   * clic en "Ver en el diario" con cambios pendientes sigue perdiéndolos—, y
   * eso pide interceptar el router, que es harina de otro costal. Mientras
   * tanto la barra de abajo avisa que hay cambios sin guardar, que es lo que
   * hace mirable el problema.
   */
  useEffect(() => {
    if (!sucio) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sucio]);

  /**
   * Sube la foto y pone su dirección en el campo. **No guarda la nota.**
   *
   * Separar las dos cosas es a propósito: subir una foto y arrepentirse no
   * deja la nota a medio cambiar, y el redactor ve el resultado antes de
   * publicar nada.
   */
  /** Sube un archivo y devuelve su dirección, o null si falló. No toca ningún
   *  campo: quién la pidió decide dónde va. Lo usan la foto de apertura y las
   *  fotos que viven dentro del cuerpo, que son dos destinos distintos. */
  async function subirArchivo(archivo: File): Promise<string | null> {
    setErrorFoto(null);
    setSubiendo(true);
    try {
      const datos = new FormData();
      datos.set("archivo", archivo);
      datos.set("slug", slug);
      const res = await subirImagenAction(datos);
      if (!res.ok || !res.url) {
        setErrorFoto(res.error ?? "No se pudo subir la foto.");
        return null;
      }
      return res.url;
    } catch {
      setErrorFoto("No se pudo hablar con el servidor al subir la foto.");
      return null;
    } finally {
      setSubiendo(false);
    }
  }

  async function subirFoto(archivo: File) {
    const url = await subirArchivo(archivo);
    if (!url) return;
    setImagenSrc(url);
    setGuardado(false);
    setSucio(true);
  }

  function guardar() {
    setError(null);
    setGuardado(false);
    iniciarGuardado(async () => {
      // La accion puede RECHAZAR, no solo devolver ok:false: sesion vencida,
      // red cortada, error del servidor. Sin este try la promesa quedaba sin
      // atrapar, el estado de "guardando" no se limpiaba nunca y el boton
      // giraba para siempre sin decir nada.
      try {
        const res = await guardarNotaAction({
          slug,
          slugOriginal,
          edicionSlug,
          seccion,
          titulo,
          bajada,
          cuerpo,
          // Se manda la imagen si hay CUALQUIERA de los tres campos, no sólo si
          // hay alt. Antes, borrar el alt para reescribirlo tiraba también el
          // archivo y el epígrafe, y bastaba con guardar en el medio para
          // perderlos. Que falte el alt lo decide el servidor, con un mensaje.
          imagen:
            imagenSrc.trim() || imagenAlt.trim() || imagenEpigrafe.trim()
              ? {
                  src: imagenSrc,
                  alt: imagenAlt,
                  epigrafe: imagenEpigrafe,
                  credito: imagenCredito,
                }
              : undefined,
        });
        if (!res.ok) {
          setError(res.error ?? "No se pudo guardar.");
          return;
        }
        setGuardado(true);
        setSucio(false);
        // Si el slug cambió, la URL del editor apunta a una nota que ya no
        // existe con ese nombre; hay que llevar al usuario a la nueva.
        if (res.slug && res.slug !== slugOriginal) {
          router.replace(`/admin/nota/${res.slug}`);
        }
        router.refresh();
      } catch {
        setError(
          "No se pudo hablar con el servidor. Puede haberse cortado la " +
            "conexión o vencido la sesión. Los cambios siguen en pantalla: " +
            "volvé a intentar sin recargar.",
        );
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
      /* La pila va en `grid gap-6`, que es la misma escalera que usan las cinco
         pantallas del panel. Antes era `space-y-4`: otro mecanismo Y otra
         separación —16px contra 24px— entre tarjetas que flotan sobre el mismo
         fondo gris que las de al lado. Es la pantalla más larga del panel, así
         que era también donde más se notaba que el editor no era del mismo
         juego.

         El relleno de abajo es el alto de la barra fija de guardar: sin él, el
         último bloque del cuerpo queda tapado justo cuando se lo termina de
         escribir. La barra va `fixed`, así que no es un hijo en flujo de la
         grilla y no le genera una fila ni se come un `gap`. */
      className="grid gap-6 pb-28"
    >
      <SeccionPanel
        id="datos-de-la-nota"
        titulo="La nota"
        bajada="El titular y la bajada tal como se leen en la tapa, y dónde va publicada."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="nota-titulo" className={etiqueta}>
              Título
            </label>
            <textarea
              id="nota-titulo"
              value={titulo}
              onChange={(e) => alEditar(setTitulo)(e.target.value)}
              rows={2}
              className={cn(campo, "mt-1.5 resize-y font-semibold")}
              placeholder="El titular tal como va en la tapa"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="nota-bajada" className={etiqueta}>
              Bajada
            </label>
            <textarea
              id="nota-bajada"
              value={bajada}
              onChange={(e) => alEditar(setBajada)(e.target.value)}
              rows={3}
              className={cn(campo, "mt-1.5 resize-y")}
              aria-describedby="nota-bajada-ayuda"
              placeholder="Las dos o tres líneas que resumen la nota"
            />
            <span id="nota-bajada-ayuda" className={ayudaCampo}>
              Es también lo que Migue lee en voz alta cuando le piden escuchar
              la nota. Escribila para ser oída.
            </span>
          </div>

          {/*
            * A qué edición va.
            *
            * Antes esto no se elegía ni se veía: la nota caía en la edición que
            * estuviera en previsualización, y quien cargaba no tenía cómo
            * saberlo. Una nota de un recital de septiembre terminó publicada en
            * agosto, y no había forma de moverla desde acá.
            */}
          <div>
            <label htmlFor="nota-edicion" className={etiqueta}>
              Edición
            </label>
            <select
              id="nota-edicion"
              value={edicionSlug}
              onChange={(e) => alEditar(setEdicionSlug)(e.target.value)}
              className={cn(campo, "mt-1.5")}
              aria-describedby="nota-edicion-ayuda"
            >
              {ediciones.map((e) => (
                <option key={e.slug} value={e.slug}>
                  {e.mes}
                  {e.estado === "publicada"
                    ? " — en la calle"
                    : e.estado === "programada"
                      ? " — programada"
                      : " — sin fecha"}
                </option>
              ))}
            </select>
            <span id="nota-edicion-ayuda" className={ayudaCampo}>
              {nota
                ? "Cambiarla mueve la nota a esa edición, al final del foliado."
                : "En qué número va a salir la nota."}
            </span>
          </div>

          <div>
            <label htmlFor="nota-seccion" className={etiqueta}>
              Sección
            </label>
            <input
              id="nota-seccion"
              list="secciones-existentes"
              value={seccion}
              onChange={(e) => alEditar(setSeccion)(e.target.value)}
              {...sinEnviarConEnter}
              className={cn(campo, "mt-1.5")}
              aria-describedby="nota-seccion-ayuda"
              placeholder="Cultura"
            />
            <datalist id="secciones-existentes">
              {secciones.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <span id="nota-seccion-ayuda" className={ayudaCampo}>
              Se puede elegir una de las que ya existen o escribir una nueva.
            </span>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="nota-slug" className={etiqueta}>
              Slug <span className="font-normal">(la dirección de la nota)</span>
            </label>
            <input
              id="nota-slug"
              value={slug}
              onChange={(e) => alEditar(setSlug)(e.target.value)}
              {...sinEnviarConEnter}
              className={cn(campoMono, "mt-1.5")}
              aria-describedby="nota-slug-ayuda"
              placeholder="plan-bacheo-integral"
            />
            <span id="nota-slug-ayuda" className={ayudaCampo}>
              Sólo minúsculas, números y guiones. Si lo cambiás, los comentarios
              de la nota lo siguen.
            </span>
          </div>
        </div>
      </SeccionPanel>

      <SeccionPanel
        id="foto-de-la-nota"
        titulo="Foto"
        bajada="La imagen que abre la nota. Se sube acá, pero recién queda publicada cuando guardás."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="nota-imagen-src" className={etiqueta}>
              Archivo
            </label>
            <input
              id="nota-imagen-src"
              value={imagenSrc}
              onChange={(e) => alEditar(setImagenSrc)(e.target.value)}
              {...sinEnviarConEnter}
              className={cn(campoMono, "mt-1.5")}
              placeholder="/notas/plaza-independencia.webp"
            />
            <div className="mt-2 flex flex-wrap items-center gap-panel-controles">
              {/* El input de archivo va escondido detrás de su etiqueta: el
                  control nativo no se puede estilar y queda como un cuerpo
                  extraño en el panel. La etiqueta ES el disparador, así que
                  sigue andando con teclado y con lector de pantalla. */}
              <label
                className={`${botonSecundario} cursor-pointer${
                  subiendo ? " opacity-60" : ""
                }`}
              >
                <Upload className="h-4 w-4 shrink-0" aria-hidden="true" />
                {subiendo ? "Subiendo…" : "Subir una foto"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={subiendo}
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    // Se limpia el value para que elegir el MISMO archivo dos
                    // veces seguidas vuelva a disparar el onChange.
                    e.target.value = "";
                    if (f) void subirFoto(f);
                  }}
                />
              </label>
              <span className="text-panel-sm text-panel-tinta-3">
                JPG, PNG o WebP, hasta 8 MB.
              </span>
            </div>
            {errorFoto && (
              <span
                role="alert"
                className="mt-2 flex items-start gap-2 text-panel-sm"
                style={{ color: tintaAlerta }}
              >
                <TriangleAlert
                  className="mt-[0.15em] h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                {errorFoto}
              </span>
            )}
          </div>

          <div>
            <label htmlFor="nota-imagen-alt" className={etiqueta}>
              Texto alternativo
            </label>
            <input
              id="nota-imagen-alt"
              value={imagenAlt}
              onChange={(e) => alEditar(setImagenAlt)(e.target.value)}
              {...sinEnviarConEnter}
              className={cn(campo, "mt-1.5")}
              aria-describedby="nota-imagen-alt-ayuda"
              placeholder="Qué se ve en la foto, para quien no puede verla"
            />
            <span id="nota-imagen-alt-ayuda" className={ayudaCampo}>
              Sin esto no hay foto: es lo que lee un lector de pantalla.
            </span>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="nota-imagen-epigrafe" className={etiqueta}>
              Epígrafe
            </label>
            <input
              id="nota-imagen-epigrafe"
              value={imagenEpigrafe}
              onChange={(e) => alEditar(setImagenEpigrafe)(e.target.value)}
              {...sinEnviarConEnter}
              className={cn(campo, "mt-1.5")}
              placeholder="La línea que va debajo de la foto, a la vista de todos"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="nota-imagen-credito" className={etiqueta}>
              Crédito
            </label>
            <input
              id="nota-imagen-credito"
              value={imagenCredito}
              onChange={(e) => alEditar(setImagenCredito)(e.target.value)}
              {...sinEnviarConEnter}
              className={cn(campo, "mt-1.5")}
              placeholder="Quién sacó la foto"
            />
          </div>
        </div>
      </SeccionPanel>

      {/* El cuerpo no va adentro de una tarjeta: cada bloque ES una tarjeta, y
          meterlas todas dentro de otra las hundiría en una caja sin fondo. El
          título de la sección vive sobre el fondo gris, como el rótulo de un
          grupo de tarjetas.

          Y sin `pt-2` propio: la separación con la tarjeta de arriba la pone el
          `gap-6` de la pila y nada más. Un hijo que además trae su propio aire
          es exactamente cómo se desarma una escalera de separación.

          Adentro, la misma que usa `SeccionPanel` entre su cabecera y su
          cuerpo: `mb-4`. */}
      <section aria-labelledby="cuerpo-de-la-nota">
        <div className="mb-4 px-1">
          <h2
            id="cuerpo-de-la-nota"
            className="text-panel-lg font-semibold tracking-[-0.01em] text-panel-tinta"
          >
            Cuerpo de la nota
          </h2>
          <p className="mt-1 text-panel-sm text-panel-tinta-3">
            {cuerpo.length === 1 ? "1 bloque" : `${cuerpo.length} bloques`} · cada
            forma se maqueta distinto en la hoja.
          </p>
        </div>

        {/* `gap-4`, la separación de adentro de una sección en el resto del
            panel: cada bloque es una tarjeta como cualquier otra y entre dos
            tarjetas vecinas hay una sola distancia posible. */}
        <ol className="grid gap-4">
          {cuerpo.map((bloque, i) => (
            <li key={i} data-bloque={i}>
              <TarjetaPanel>
                <div className="flex flex-wrap items-center justify-between gap-panel-controles">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {/* El número es decoración: la etiqueta de al lado ya dice
                        "bloque 1" en voz alta. El cuadrado va con el radio más
                        chico: es lo chico apoyado dentro de la tarjeta. */}
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-panel-3 bg-panel-wash text-panel-xs font-semibold tabular-nums text-accent"
                    >
                      {i + 1}
                    </span>
                    <label htmlFor={`bloque-${i}-tipo`} className="sr-only">
                      Tipo del bloque {i + 1}
                    </label>
                    <select
                      id={`bloque-${i}-tipo`}
                      value={bloque.tipo}
                      onChange={(e) => {
                        setGuardado(false);
                        setSucio(true);
                        setCuerpo((prev) =>
                          prev.map((b, k) =>
                            k === i
                              ? convertirBloque(
                                  b,
                                  e.target.value as BloqueNota["tipo"],
                                )
                              : b,
                          ),
                        );
                      }}
                      /* Es un campo como cualquier otro del formulario, sólo
                         que se ajusta a su contenido en vez de ocupar la fila:
                         de ahí `w-auto` y el relleno más chico. Antes estaba
                         escrito entero a mano, y era la quinta copia del mismo
                         campo. */
                      className={cn(
                        campo,
                        "min-h-8 w-auto px-2.5 py-1.5 font-medium",
                      )}
                    >
                      {TIPOS.map((t) => (
                        <option key={t.valor} value={t.valor}>
                          {t.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* `gap-panel-controles` y no `gap-1`: el anillo de foco de
                      la casa sangra 5px por lado, así que con 4px de separación
                      el anillo del botón enfocado se metía 1px dentro del
                      vecino. Tres botones de sólo icono, pegados, y ninguna
                      forma de saber cuál estaba enfocado. */}
                  <div className="flex items-center gap-panel-controles">
                    <BotonIcono
                      titulo={`Subir el bloque ${i + 1}`}
                      dato="subir"
                      onClick={() => mover(i, -1)}
                      disabled={i === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </BotonIcono>
                    <BotonIcono
                      titulo={`Bajar el bloque ${i + 1}`}
                      dato="bajar"
                      onClick={() => mover(i, 1)}
                      disabled={i === cuerpo.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </BotonIcono>
                    <BotonIcono
                      titulo={`Eliminar el bloque ${i + 1}`}
                      onClick={() => {
                        setGuardado(false);
                        setSucio(true);
                        setCuerpo((prev) => prev.filter((_, k) => k !== i));
                      }}
                      disabled={cuerpo.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </BotonIcono>
                  </div>
                </div>

                <p className="mt-2 text-panel-sm text-panel-tinta-3">
                  {TIPOS.find((t) => t.valor === bloque.tipo)?.ayuda}
                </p>

                <CamposBloque
                  bloque={bloque}
                  indice={i}
                  onCambio={(c) => editarBloque(i, c)}
                  onSubir={subirArchivo}
                  subiendo={subiendo}
                />
              </TarjetaPanel>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={() => {
            setGuardado(false);
            setSucio(true);
            setCuerpo((prev) => [...prev, { tipo: "parrafo", texto: "" }]);
          }}
          className={`${botonEnLaPagina} mt-4`}
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
          Agregar bloque
        </button>
      </section>

      {/* La barra de guardar queda fija: el cuerpo de una nota es largo y no
          se debería tener que volver arriba para grabar.

          Arranca después de la barra lateral (`lg:left-72`, el ancho de la
          barra) en vez de cruzar la pantalla entera: si no, tapa el cambio de
          tema y el usuario, que viven en el pie de la barra. El relleno de
          adentro repite el del <main> del panel para que "Guardar" caiga sobre
          el borde derecho de las tarjetas y no unos píxeles corrido. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-panel-borde bg-panel-tarjeta/95 backdrop-blur lg:left-72">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <p
            role="status"
            aria-live="polite"
            className="min-w-0 flex-1 text-panel-sm"
          >
            {error ? (
              <span
                className="inline-flex items-start gap-2 leading-snug"
                style={{ color: tintaAlerta }}
              >
                <TriangleAlert
                  className="mt-[0.15em] h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                {error}
              </span>
            ) : guardado ? (
              <span className="inline-flex items-center gap-2 text-panel-tinta-2">
                <Check
                  className="h-4 w-4 shrink-0 text-accent"
                  aria-hidden="true"
                />
                Guardado. Ya está en el diario.
              </span>
            ) : sucio ? (
              <span className="inline-flex items-center gap-2 text-panel-tinta-2">
                <TriangleAlert
                  className="h-4 w-4 shrink-0 text-accent"
                  aria-hidden="true"
                />
                Hay cambios sin guardar.
              </span>
            ) : (
              <span className="text-panel-tinta-3">
                Los cambios se publican al guardar: no hay borradores todavía.
              </span>
            )}
          </p>
          <button
            type="submit"
            disabled={guardando}
            /* La acción principal de la pantalla, y hay una sola. Pierde el
               `px-6 py-2.5` que se había puesto de más: el relleno de un botón
               primario es el mismo en las seis pantallas o no es un sistema. */
            className={`${botonPrimario} shrink-0`}
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </form>
  );
}

/** Los botones de 32×32 de la fila de un bloque: mover y eliminar.
 *
 *  El aspecto sale entero de `clasesDeBotonIcono()`: el cuadrado de 32px —por
 *  encima del piso de 24×24 de la WCAG 2.5.8, y acá importa el doble porque son
 *  tres botones pegados—, el `rounded-panel-3` y el filete de control
 *  (`--panel-borde-campo`), que es lo único que dibuja un botón cuyo relleno
 *  está casi al ras de la tarjeta.
 *
 *  Lo que queda de este componente es lo que NO entra en una cadena de clases y
 *  es la mitad de la pieza: el `aria-label` obligatorio, el `title` y la marca
 *  para devolverle el foco después de reordenar. Los cuatro estados de
 *  `disabled:hover:` que había escritos a mano ya no hacen falta: la pieza trae
 *  `disabled:pointer-events-none`, así que un botón apagado no tiene hover que
 *  apagar. */
function BotonIcono({
  titulo,
  dato,
  onClick,
  disabled,
  children,
}: {
  titulo: string;
  /** Marca para poder devolverle el foco después de reordenar. */
  dato?: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-mover={dato}
      aria-label={titulo}
      title={titulo}
      className={clasesDeBotonIcono()}
    >
      {children}
    </button>
  );
}

/** Los campos que cambian según el tipo. Vive aparte para que el `switch` esté
 *  en un solo lugar y no repartido por el render.
 *
 *  Recibe el `indice` sólo para nombrarse: sin él, un lector de pantalla oye
 *  quince campos llamados "El texto" y ninguno dice de qué bloque es. */
function CamposBloque({
  bloque,
  indice,
  onCambio,
  onSubir,
  subiendo,
}: {
  bloque: BloqueNota;
  indice: number;
  onCambio: (cambios: Partial<BloqueNota>) => void;
  /** Sube un archivo y devuelve su dirección. Sólo lo usa el bloque de foto. */
  onSubir: (archivo: File) => Promise<string | null>;
  subiendo: boolean;
}) {
  if (bloque.tipo === "ficha") {
    return (
      <div className="mt-3 space-y-3">
        <input
          value={bloque.titulo}
          onChange={(e) => onCambio({ titulo: e.target.value })}
          {...sinEnviarConEnter}
          aria-label={`Título del recuadro del bloque ${indice + 1}`}
          className={cn(campo, "font-semibold")}
          placeholder="Título del recuadro"
        />
        {bloque.entradas.map((entrada, j) => (
          // El filete de la izquierda es lo único que agrupa a la entrada: un
          // recuadro completo dentro de la tarjeta del bloque sería una caja
          // dentro de una caja dentro de una caja.
          //
          // Por eso mismo va con `--panel-borde-campo` y no con el filete de
          // las tarjetas: si es lo único que agrupa, tiene que verse. El otro
          // (1,23:1 sobre la tarjeta) dejaba la agrupación en el terreno de lo
          // que se adivina.
          <div key={j} className="border-l-2 border-panel-borde-campo pl-3">
            <div className="flex items-center gap-2">
              <input
                value={entrada.lead}
                onChange={(e) =>
                  onCambio({
                    entradas: bloque.entradas.map((x, k) =>
                      k === j ? { ...x, lead: e.target.value } : x,
                    ),
                  })
                }
                {...sinEnviarConEnter}
                aria-label={`Encabezado de la entrada ${j + 1}`}
                className={cn(campo, "font-semibold")}
                placeholder="Encabezado de la entrada"
              />
              <button
                type="button"
                aria-label={`Quitar la entrada ${j + 1}`}
                title={`Quitar la entrada ${j + 1}`}
                onClick={() =>
                  onCambio({
                    entradas: bloque.entradas.filter((_, k) => k !== j),
                  })
                }
                disabled={bloque.entradas.length === 1}
                /* Mismo botón de icono que los de la fila del bloque, y ahora
                   se ve igual porque es el mismo. Sigue siendo `secundario` y
                   no `destructivo`: el tono destructivo avisa con el filete
                   rojo Y con la palabra, y un botón de sólo icono no tiene
                   palabra que poner. Lo que quita esto es una entrada de una
                   ficha que todavía no se guardó, no una nota del diario. */
                className={clasesDeBotonIcono()}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <textarea
              value={entrada.texto}
              onChange={(e) =>
                onCambio({
                  entradas: bloque.entradas.map((x, k) =>
                    k === j ? { ...x, texto: e.target.value } : x,
                  ),
                })
              }
              rows={2}
              aria-label={`Dato de la entrada ${j + 1}`}
              className={cn(campo, "mt-1.5 resize-y")}
              placeholder="El dato"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            onCambio({
              entradas: [...bloque.entradas, { lead: "", texto: "" }],
            })
          }
          className={botonFantasmaChico}
        >
          {/* `h-3.5` y no `h-4`: es el icono que le toca al botón chico, y por
              eso el chico también achica el `gap`. Un icono de 16px con un aire
              de 8px al lado de una palabra de 12,8px se lee como dos cosas
              sueltas. */}
          <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Agregar entrada
        </button>
      </div>
    );
  }

  if (bloque.tipo === "foto") {
    return (
      <div className="mt-3 space-y-3">
        <input
          value={bloque.src}
          onChange={(e) => onCambio({ src: e.target.value })}
          {...sinEnviarConEnter}
          aria-label={`Dirección de la foto del bloque ${indice + 1}`}
          className={campo}
          placeholder="Dirección de la foto"
        />
        <label
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-panel-borde-campo px-3 py-1.5 text-[0.78rem] font-medium",
            subiendo && "opacity-60",
          )}
        >
          {subiendo ? "Subiendo…" : "Reemplazar la foto"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={subiendo}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void onSubir(f).then((url) => url && onCambio({ src: url }));
            }}
          />
        </label>
        <input
          value={bloque.epigrafe ?? ""}
          onChange={(e) => onCambio({ epigrafe: e.target.value })}
          {...sinEnviarConEnter}
          aria-label={`Epígrafe de la foto del bloque ${indice + 1}`}
          className={campo}
          placeholder="Epígrafe: qué se ve en la foto"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={bloque.alt}
            onChange={(e) => onCambio({ alt: e.target.value })}
            {...sinEnviarConEnter}
            aria-label={`Texto alternativo de la foto del bloque ${indice + 1}`}
            className={campo}
            placeholder="Texto alternativo"
          />
          <input
            value={bloque.credito ?? ""}
            onChange={(e) => onCambio({ credito: e.target.value })}
            {...sinEnviarConEnter}
            aria-label={`Crédito de la foto del bloque ${indice + 1}`}
            className={campo}
            placeholder="Quién la sacó (opcional)"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <textarea
        value={bloque.texto}
        onChange={(e) => onCambio({ texto: e.target.value })}
        rows={bloque.tipo === "subtitulo" ? 1 : 4}
        aria-label={`Texto del bloque ${indice + 1}`}
        className={cn(campo, "resize-y")}
        placeholder={
          bloque.tipo === "cita"
            ? "Lo que dijo, entre comillas no: las pone el diario"
            : bloque.tipo === "subtitulo"
              ? "El subtítulo"
              : "El texto"
        }
      />
      {bloque.tipo === "cita" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={bloque.autor}
            onChange={(e) => onCambio({ autor: e.target.value })}
            {...sinEnviarConEnter}
            aria-label={`Quién lo dijo, en el bloque ${indice + 1}`}
            className={campo}
            placeholder="Quién lo dijo"
          />
          <input
            value={bloque.cargo ?? ""}
            onChange={(e) => onCambio({ cargo: e.target.value })}
            {...sinEnviarConEnter}
            aria-label={`Cargo de quien lo dijo, en el bloque ${indice + 1}`}
            className={campo}
            placeholder="Su cargo (opcional)"
          />
        </div>
      )}
    </div>
  );
}
