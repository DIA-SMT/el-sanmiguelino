import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Las piezas del panel de administración.
 *
 * Todas las pantallas de `/admin` se arman con esto y **ninguna escribe su
 * propio marcado de tarjeta**. No es una preferencia: cinco pantallas que
 * inventan cada una su borde, su radio y su sombra no se leen como un panel,
 * se leen como cinco pantallas.
 *
 * La regla de esta tanda, que es la que faltaba: **si una pantalla necesita
 * algo que ya está acá, lo importa.** No lo copia "porque el suyo es un poco
 * distinto". Cuando de verdad es distinto, lo que lo distingue entra como
 * prop —`sobre`, `superficie`, `como`, `enfasis`—, y así el eje queda escrito
 * una vez en vez de tres veces a mano en tres archivos.
 *
 * El módulo NO lleva `"use client"` a propósito, y eso es una decisión, no un
 * olvido. Sin la directiva estas piezas sirven tanto en un Server Component
 * (una página que sólo muestra datos) como dentro de uno de cliente (una
 * pantalla con filtros, que se lleva `ChipFiltro` al bundle). Con la directiva,
 * `TarjetaDato` dejaría de funcionar desde el servidor: el `icono` es una
 * función y una función no cruza la frontera server → client.
 *
 * Los colores salen de los tokens `--panel-*` de `globals.css`; el acento es
 * `--accent`, el azul del isotipo municipal, que ya cambia con el tema. Los
 * tamaños de letra salen de la escala `text-panel-*` y los radios de
 * `rounded-panel*`: **acá adentro no se escribe un número de tipografía ni de
 * esquina a mano**, que es exactamente cómo aparecieron los diecinueve
 * tamaños y los treinta `rounded-[0.6rem]` que esto vino a juntar.
 */

/**
 * El inset de toda superficie del panel, en los dos anchos.
 *
 * Antes había tres: `p-4 sm:p-5` en la tarjeta de dato, `p-5 sm:p-6` en el
 * banner y `p-5` fijo en la tarjeta y en la sección. Abajo de 640px eso dejaba
 * una fila de tarjetas de dato con 16px de inset justo encima de una tarjeta
 * con 20px, así que los textos de una y de otra arrancaban en columnas
 * distintas separadas por 4px —lo suficiente para verse desprolijo, no lo
 * suficiente para leerse como intención—.
 *
 * Ahora es uno solo. El banner resigna sus 24px de escritorio y la tarjeta
 * resigna 4px de teléfono, y a cambio **todo lo que flota sobre el fondo gris
 * empieza en la misma columna a cualquier ancho**. La jerarquía la hacen el
 * tamaño de la letra y el filete de acento, que es donde se ve; el relleno no
 * jerarquiza nada, sólo alinea o desalinea.
 */
const RELLENO = "p-4 sm:p-5";

/* ---------------------------------------------------------------------------
   Banner de cabecera
--------------------------------------------------------------------------- */

/**
 * El banner de cabecera de cada pantalla: título grande, bajada gris y las
 * acciones a la derecha.
 *
 * Decide por vos: es un `<header>` (no un `<div>` con un `<h1>` suelto), el
 * título es SIEMPRE el `<h1>` de la pantalla —hay uno solo por pantalla— y el
 * degradé de acento nace en la izquierda, donde está el filete, para que el
 * filete se lea como el borde del degradé y no como un adorno pegado.
 *
 * **El filete es `--accent` y no `--grafico-nota`, y eso ahora es una regla
 * escrita.** En claro los dos son el mismo #0a5ce8, así que durante un tiempo
 * el filete del banner y el de la tarjeta de dato azul parecieron la misma
 * cosa; en oscuro se separan y la identidad se partía al tocar el toggle. La
 * decisión está en `globals.css`, en el bloque de los tokens del panel: el
 * acento manda en el cromo —esto, la barra, el botón primario, el foco— y los
 * `--grafico-*` mandan en los datos. Este filete es cromo.
 *
 * El título no cambia de tamaño con el ancho. Antes era `text-xl sm:text-2xl`;
 * ahora es un solo paso de la escala (`text-panel-xl`, 22px), que entra en un
 * teléfono y manda en un escritorio. Una escala de cinco pasos que se rompe en
 * el componente más visible del panel deja de ser una escala.
 *
 * El degradé va en `style` y no como clase arbitraria de Tailwind porque el
 * valor arranca en un token con alfa (`--panel-wash`) y termina en
 * `transparent`: escrito así se lee de una y no hay que adivinar si Tailwind
 * lo tomó como color o como imagen de fondo.
 */
export function BannerPanel({
  titulo,
  bajada,
  children,
}: {
  titulo: string;
  bajada?: React.ReactNode;
  /** Las acciones de la derecha. */
  children?: React.ReactNode;
}): React.ReactElement {
  return (
    <header
      className={cn(
        "mb-6 flex flex-col gap-4 overflow-hidden rounded-panel border border-panel-borde border-l-4 border-l-accent bg-panel-tarjeta font-sans shadow-panel sm:flex-row sm:items-center sm:justify-between sm:gap-6",
        RELLENO,
      )}
      style={{
        backgroundImage:
          "linear-gradient(100deg, var(--panel-wash) 0%, transparent 62%)",
      }}
    >
      <div className="min-w-0">
        <h1 className="text-panel-xl font-bold tracking-[-0.01em] text-panel-tinta">
          {titulo}
        </h1>
        {bajada ? (
          <p className="mt-1.5 max-w-prose text-panel-base text-panel-tinta-2">
            {bajada}
          </p>
        ) : null}
      </div>
      {children ? (
        <div className="flex shrink-0 flex-wrap items-center gap-panel-controles">
          {children}
        </div>
      ) : null}
    </header>
  );
}

/* ---------------------------------------------------------------------------
   Tarjetas
--------------------------------------------------------------------------- */

/**
 * La tarjeta blanca genérica: todo lo que flota sobre el fondo del panel.
 *
 * Trae el padding puesto. Si no lo trajera, cada pantalla elegiría el suyo y
 * las tarjetas de dos secciones distintas no alinearían nunca. Cuando una
 * tarjeta necesita que su contenido llegue al borde —una tabla, una lista con
 * filas alternas— se pasa `className="p-0"`: `cn()` usa tailwind-merge, así
 * que el padding de afuera gana.
 */
export function TarjetaPanel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      className={cn(
        "rounded-panel border border-panel-borde bg-panel-tarjeta font-sans text-panel-tinta shadow-panel",
        RELLENO,
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Una tarjeta con título, para envolver una sección o un gráfico.
 *
 * Decide por vos: la cabecera va separada del cuerpo por espacio y no por un
 * filete —un filete adentro de una tarjeta que ya tiene borde la parte en dos
 * cajas—, y si le pasás `id` el título lo usa para que el `<section>` quede
 * nombrado (`aria-labelledby`). Sin `id` no se inventa ninguno: un id generado
 * al vuelo cambia entre el servidor y el cliente.
 */
export function SeccionPanel({
  titulo,
  bajada,
  id,
  children,
  acciones,
}: {
  titulo: string;
  bajada?: React.ReactNode;
  /** Para aria-labelledby. */
  id?: string;
  acciones?: React.ReactNode;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "rounded-panel border border-panel-borde bg-panel-tarjeta font-sans text-panel-tinta shadow-panel",
        RELLENO,
      )}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id={id}
            className="text-panel-lg font-semibold tracking-[-0.01em] text-panel-tinta"
          >
            {titulo}
          </h2>
          {bajada ? (
            <p className="mt-1 text-panel-sm text-panel-tinta-3">{bajada}</p>
          ) : null}
        </div>
        {acciones ? (
          <div className="flex shrink-0 items-center gap-panel-controles">
            {acciones}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/* ---------------------------------------------------------------------------
   Tarjeta de dato (KPI)
--------------------------------------------------------------------------- */

/** Los cuatro filetes salen de las variables de los gráficos, que ya están
 *  validadas para daltonismo y contraste en los dos temas. Acá se les pone
 *  nombre de color y no nombre de dato ("azul", no "notas") porque la misma
 *  tarjeta cuenta cosas distintas en cada pantalla.
 *
 *  El "azul" de acá es `--grafico-nota` y NO `--accent`, aunque en modo claro
 *  sean el mismo valor: esto es un dato, no cromo, y el juego de cuatro está
 *  validado como juego. Meterle el acento adentro rompería la separación con
 *  los otros tres justo en nocturno, que es donde más ajustada está. */
const FILETES = {
  azul: "var(--grafico-nota)",
  celeste: "var(--grafico-indice)",
  oro: "var(--grafico-diario)",
  alerta: "var(--grafico-alerta)",
} as const;

/**
 * La tarjeta de dato: filete de color arriba, icono en su cuadrado redondeado,
 * el número grande, la etiqueta debajo y una nota chica en gris.
 *
 * **El color no dice nada que el texto no diga.** El filete y el icono son
 * decoración redundante: quién es el dato lo dicen `titulo` y `nota`, y por eso
 * el icono va `aria-hidden`. Si alguna vez el color pasa a significar algo por
 * sí solo (rojo = mal), hay que agregar una palabra, no un color más.
 *
 * El icono se pinta con el color mezclado un 28 % con la tinta del panel, no
 * con el color puro: en claro eso baja el celeste —que solo sobre blanco anda
 * en 2.5:1— a un tono legible, y en oscuro, donde la tinta es clara, la mezcla
 * lo sube. Una sola fórmula sirve para los dos temas porque `--panel-tinta`
 * ya es sensible al tema.
 *
 * El número es el único texto del panel que no sale de la escala `text-panel-*`
 * y está bien que así sea: no es texto, es un dato mostrado, hay exactamente
 * uno y vive acá adentro, donde no puede derivar a seis tamaños distintos.
 */
export function TarjetaDato({
  icono: Icono,
  titulo,
  valor,
  nota,
  color,
}: {
  icono: LucideIcon;
  titulo: string;
  valor: string;
  nota?: string;
  /** Cuál de los cuatro filetes de color. */
  color: "azul" | "celeste" | "oro" | "alerta";
}): React.ReactElement {
  const tono = FILETES[color];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-panel border border-panel-borde bg-panel-tarjeta font-sans shadow-panel",
        RELLENO,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1"
        style={{ background: tono }}
      />
      <CuadradoDeIcono icono={Icono} tono={tono} />
      <p className="mt-3 text-3xl font-bold leading-none tracking-[-0.02em] text-panel-tinta tabular-nums">
        {valor}
      </p>
      <p className="mt-2 text-panel-sm font-medium text-panel-tinta-2">
        {titulo}
      </p>
      {nota ? (
        <p className="mt-1 text-panel-xs text-panel-tinta-3">{nota}</p>
      ) : null}
    </div>
  );
}

/**
 * El cuadradito con el icono adentro, teñido con el color que lo identifica.
 *
 * Estaba escrito dos veces con dos tamaños (36px en la tarjeta de dato, 28px en
 * el aviso) y la misma fórmula de color copiada a mano. La fórmula es una: el
 * fondo es el color al 14 % y el trazo es el color mezclado con la tinta del
 * panel, que es lo que lo hace legible en los dos temas sin escribir `dark:`.
 */
function CuadradoDeIcono({
  icono: Icono,
  tono,
  chico,
}: {
  icono: LucideIcon;
  tono: string;
  /** El del aviso, que acompaña a un párrafo y no a un número. */
  chico?: boolean;
}): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-panel-3",
        chico ? "mt-px h-7 w-7" : "mt-1 h-9 w-9",
      )}
      style={{
        background: `color-mix(in srgb, ${tono} 14%, transparent)`,
        color: `color-mix(in srgb, ${tono} 72%, var(--panel-tinta))`,
      }}
    >
      <Icono className={chico ? "h-4 w-4" : "h-[1.05rem] w-[1.05rem]"} />
    </span>
  );
}

/* ---------------------------------------------------------------------------
   Píldora de estado o categoría
--------------------------------------------------------------------------- */

/**
 * La píldora de estado o de categoría: un puntito de color y una palabra.
 *
 * Venía escrita tres veces —`fila-comentario.tsx` con `px-2.5 py-0.5` y
 * 0.7rem, `fila-edicion.tsx` con `px-2.5 py-1` y 0.72rem, y una tercera a mano
 * en `admin/page.tsx`—, o sea dos alturas y dos fondos para lo mismo. Acá es
 * una sola altura y un solo fondo, elegido por `sobre`.
 *
 * **El color pinta el punto, nunca la palabra.** Es la lección que ya había
 * aprendido `fila-edicion.tsx` por su cuenta: teñir el texto con el tono deja
 * el contraste a merced de qué estado le toque —`--panel-borde` como texto es
 * ilegible, `--grafico-indice` sobre la fila hundida daba 4,4:1—, y un estado
 * que a veces se lee y a veces no es peor que uno sin color. Con el texto en
 * la tinta del panel el contraste es el mismo para los cuatro estados.
 *
 * Y **siempre lleva texto**. El color es refuerzo: un estado dicho sólo con
 * color no existe para quien no lo distingue.
 */
export function Pildora({
  tono,
  sobre = "tarjeta",
  enfasis,
  children,
}: {
  /** El color del punto, o null para la neutra (sin punto). */
  tono?: string | null;
  /** Sobre qué superficie apoya, para elegir el fondo contrario. */
  sobre?: "tarjeta" | "hundida";
  /** El estado que importa de la lista, el que hay que encontrar de un vistazo. */
  enfasis?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-panel-borde px-2.5 py-1 text-panel-xs whitespace-nowrap",
        // El fondo es siempre el contrario del que tiene abajo: apoyada en una
        // tarjeta blanca se hunde, apoyada en un bloque hundido flota. Si no,
        // desaparece.
        sobre === "tarjeta" ? "bg-panel-tarjeta-2" : "bg-panel-tarjeta",
        enfasis
          ? "font-semibold text-panel-tinta"
          : "font-medium text-panel-tinta-2",
      )}
    >
      {tono ? (
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: tono }}
        />
      ) : null}
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------------------
   Cartel de aviso
--------------------------------------------------------------------------- */

/**
 * El cartel de aviso: filete de color al costado, icono en su cuadrado y el
 * texto.
 *
 * Estaba escrito idéntico en `admin/page.tsx` (como componente local `Aviso`),
 * a mano en `ediciones/page.tsx`, y con un tercer esqueleto en
 * `fila-edicion.tsx` para los errores. Los tres son el mismo cartel; lo único
 * que cambiaba de verdad era dónde se apoya, y eso ahora es `sobre`.
 *
 * **El color no dice nada solo**: el texto arranca diciendo qué pasa, y el
 * filete y el icono nada más lo acompañan. Por eso el icono va `aria-hidden` y
 * la tinta es la del panel a contraste pleno, en vez de un rojo o un ámbar que
 * en uno de los dos temas no llegaría a 4.5:1.
 *
 * El filete va como barra absoluta y no como `border-l-4`: la caja ya tiene su
 * borde de 1px y engordarle un lado le corre el radio de las dos esquinas
 * izquierdas. Con `overflow-hidden` la barra se recorta contra el mismo radio.
 */
export function Aviso({
  icono,
  tono,
  sobre = "pagina",
  rol,
  children,
}: {
  icono: LucideIcon;
  /** El color del filete y del icono, ya como string CSS. */
  tono: string;
  /** Si flota sobre el fondo del panel o se hunde dentro de una tarjeta. */
  sobre?: "pagina" | "tarjeta";
  /** `alert` cuando el aviso aparece por algo que acaba de pasar (un error de
   *  guardado): el lector de pantalla lo anuncia sin que haya que mover el
   *  foco. Un aviso que ya estaba cuando cargó la pantalla NO lleva rol:
   *  anunciar todo es no anunciar nada. */
  rol?: "alert" | "status";
  children: React.ReactNode;
}): React.ReactElement {
  const enLaPagina = sobre === "pagina";

  return (
    <div
      role={rol}
      className={cn(
        "relative flex items-start gap-3 overflow-hidden font-sans",
        enLaPagina
          ? cn(
              "rounded-panel border border-panel-borde bg-panel-tarjeta shadow-panel",
              RELLENO,
            )
          : "rounded-panel-2 border border-panel-borde bg-panel-tarjeta-2 px-3 py-2.5",
        // El filete come 4px de la izquierda; el resto del inset se mantiene
        // para que el texto siga arrancando donde arranca el de las demás
        // tarjetas.
        enLaPagina ? "pl-5 sm:pl-6" : "pl-4",
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: tono }}
      />
      <CuadradoDeIcono icono={icono} tono={tono} chico />
      <p className="text-panel-sm text-panel-tinta-2">{children}</p>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Campos de formulario
--------------------------------------------------------------------------- */

/**
 * Las clases de un campo de formulario.
 *
 * Devuelve una cadena y no un componente a propósito: el mismo aspecto tiene
 * que servir en `<input>`, en `<select>` y en `<textarea>`, que no comparten
 * ni props ni hijos. Se combina con `cn()` cuando hace falta ajustar el ancho:
 * `cn(clasesDeCampo(), "w-auto")`.
 *
 * Antes el mismo campo estaba escrito CINCO veces con cinco combinaciones de
 * fondo, tamaño y hover: 0.8 / 0.82 / 0.85 / 0.88rem para el mismo texto, dos
 * fondos elegidos al azar y el hover del borde puesto en tres de los cinco.
 *
 * Dos cosas que decide por vos:
 *
 * - **El borde es `--panel-borde-campo`, no `--panel-borde`.** Un campo vacío
 *   es un borde y nada más: no tiene contenido, ni sombra, ni escalón de gris
 *   que lo separe de lo que tiene abajo. Ese filete es el único límite del
 *   control y WCAG 1.4.11 le pide 3:1, que el filete de las tarjetas (1,23:1)
 *   no da ni de cerca. El de las tarjetas está bien donde está: ahí es
 *   decoración, porque a la tarjeta la separan el gris y la sombra.
 * - **Nunca `focus:outline-none`.** El borde de acento del foco es un extra;
 *   quien navega por teclado se guía por el outline de la casa, y sacarlo
 *   deja el formulario sin cursor visible.
 *
 * @param sobre Sobre qué superficie apoya el campo. El relleno del campo es
 *   siempre el contrario: en una tarjeta blanca se hunde, en un bloque hundido
 *   flota. Un campo del mismo color que su alrededor no se ve.
 */
export function clasesDeCampo(
  sobre: "tarjeta" | "hundida" = "tarjeta",
): string {
  return cn(
    "w-full rounded-panel-2 border border-panel-borde-campo px-3 py-2 font-sans text-panel-base text-panel-tinta transition-colors placeholder:text-panel-tinta-3 hover:border-panel-tinta-3 focus:border-accent",
    sobre === "tarjeta" ? "bg-panel-tarjeta-2" : "bg-panel-tarjeta",
  );
}

/* ---------------------------------------------------------------------------
   Chip de filtro
--------------------------------------------------------------------------- */

type ChipComun = {
  activo: boolean;
  cuenta?: number;
  /** El puntito de color a la izquierda, si el chip identifica algo. */
  color?: string | null;
  /**
   * Sobre qué superficie apoyan los chips, para elegir el fondo contrario del
   * inactivo. `comentarios/page.tsx` tuvo que reescribir el chip entero a mano
   * justamente por esto: `panel-tarjeta-2` se pensó para hundirse DENTRO de
   * una tarjeta, y sobre el gris de la página desaparecía.
   */
  superficie?: "pagina" | "tarjeta";
  className?: string;
  children: React.ReactNode;
};

type PropsChipBoton = ChipComun & { como?: "boton" } & Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    keyof ChipComun | "color"
  >;

type PropsChipEnlace = ChipComun & {
  como: "enlace";
  href: React.ComponentProps<typeof Link>["href"];
} & Omit<React.ComponentProps<typeof Link>, keyof ChipComun | "color" | "href">;

/** Las clases del chip, que son las mismas sea botón o enlace: lo que cambia
 *  es qué elemento las lleva, no cómo se ve. */
function clasesDeChip(
  activo: boolean,
  superficie: "pagina" | "tarjeta",
  className?: string,
): string {
  return cn(
    "pressable group inline-flex min-h-8 items-center gap-2 rounded-full px-3.5 py-1.5 font-sans text-panel-sm font-medium whitespace-nowrap",
    activo
      ? "bg-accent text-accent-contrast"
      : cn(
          // Mismo criterio que el campo: un chip inactivo es una superficie
          // casi del color de lo que tiene abajo, así que su límite es el
          // filete y le corresponde el borde de control.
          "border border-panel-borde-campo text-panel-tinta-2 hover:bg-panel-wash hover:text-panel-tinta",
          superficie === "pagina" ? "bg-panel-tarjeta" : "bg-panel-tarjeta-2",
        ),
    "disabled:pointer-events-none disabled:opacity-50",
    className,
  );
}

/**
 * El chip píldora de filtrar: el activo es azul sólido con texto blanco, los
 * inactivos con su cuenta al lado.
 *
 * Decide por vos: por defecto es un `<button type="button">` (nunca un `<div>`
 * con `onClick`) y lleva `aria-pressed`, porque un filtro prendido es un botón
 * apretado. El alto mínimo es 32 px, por encima del piso de 24×24 de WCAG
 * 2.5.8.
 *
 * Con `como="enlace"` renderiza un `<Link>` y cambia `aria-pressed` por
 * `aria-current="page"`, que es lo correcto cuando el filtro **vive en la
 * URL**: ahí no estás apretando un botón, estás parado en una página. Es el
 * caso de `comentarios/page.tsx` (`?estado=…`), que necesita el enlace directo,
 * la vuelta atrás y el "abrir en otra pestaña", y que por no tener este eje
 * había reescrito el chip entero a mano.
 *
 * La cuenta sube de tono junto con la palabra al pasar el mouse. Antes el
 * fondo cambiaba a `panel-wash` y el texto subía a `panel-tinta`, pero la
 * cuenta se quedaba clavada en `panel-tinta-3`: medido, 4,42:1 en claro y
 * 4,18:1 en oscuro sobre el wash, o sea que el número se caía abajo de AA
 * justo mientras el mouse estaba encima. Va con `group-hover` y no con un
 * `hover:` propio para que el disparador sea el chip entero y no el `<span>`.
 *
 * El `...resto` se esparce al final para que el llamador pueda cambiar `type`,
 * `disabled`, `onClick` o `aria-*`; `className` se saca antes y se mezcla, así
 * agregar una clase no borra todas las de acá.
 */
export function ChipFiltro(
  props: PropsChipBoton | PropsChipEnlace,
): React.ReactElement {
  const {
    activo,
    cuenta,
    color,
    superficie = "tarjeta",
    className,
    children,
    como = "boton",
    ...resto
  } = props;

  const clases = clasesDeChip(activo, superficie, className);
  const contenido = (
    <>
      {color ? (
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: color }}
        />
      ) : null}
      {children}
      {cuenta !== undefined ? (
        <span
          className={cn(
            "text-panel-xs tabular-nums",
            activo
              ? "text-accent-contrast"
              : "text-panel-tinta-3 group-hover:text-panel-tinta-2",
          )}
        >
          {cuenta}
        </span>
      ) : null}
    </>
  );

  if (como === "enlace") {
    /* El `as` es la contracara de haber juntado las dos formas en una sola
       función: `como === "enlace"` ya garantiza que `props` es la rama del
       enlace y que `href` está, pero el resto de la desestructuración se hizo
       sobre la unión y TypeScript no arrastra el estrechamiento hasta acá. */
    const { href, ...ancla } = resto as Omit<
      PropsChipEnlace,
      keyof ChipComun | "como"
    >;

    return (
      <Link
        href={href}
        aria-current={activo ? "page" : undefined}
        className={clases}
        {...ancla}
      >
        {contenido}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={activo}
      className={clases}
      {...(resto as Omit<PropsChipBoton, keyof ChipComun | "como">)}
    >
      {contenido}
    </button>
  );
}

/* ---------------------------------------------------------------------------
   Botones
--------------------------------------------------------------------------- */

/**
 * El relleno de un control es SIEMPRE el contrario del de la superficie donde
 * apoya. Es la misma tabla que ya usan `clasesDeCampo`, `Pildora` y el chip
 * inactivo, escrita una sola vez: sobre el gris de la página y sobre un bloque
 * hundido el control flota (blanco), y sobre una tarjeta blanca se hunde.
 *
 * Un botón del mismo color que lo que tiene abajo es un texto con borde, y así
 * estaban los cuatro botones de contorno del panel: `bg-panel-tarjeta` apoyado
 * sobre `bg-panel-tarjeta`.
 */
const RELLENO_CONTRARIO = {
  pagina: "bg-panel-tarjeta",
  tarjeta: "bg-panel-tarjeta-2",
  hundida: "bg-panel-tarjeta",
} as const;

type SobreBoton = keyof typeof RELLENO_CONTRARIO;

/**
 * **Estas cadenas se extienden concatenando, NO con `cn()`.**
 *
 * `cn()` es `twMerge` sin configurar, y `twMerge` no conoce la escala del
 * panel: como `panel-sm` no es un talle de los suyos, clasifica `text-panel-sm`
 * como un COLOR de texto y lo tira apenas aparece cualquier otro `text-*` en la
 * misma cadena. No es una hipótesis, está medido sobre lo que ya está en este
 * archivo: `clasesDeCampo()` pierde hoy su `text-panel-base` contra
 * `text-panel-tinta`, y el chip activo pierde su `text-panel-sm` contra
 * `text-accent-contrast`. Los dos vienen renderizando con el tamaño que heredan
 * del layout en vez del suyo.
 *
 * Por eso las piezas de acá abajo arman su cadena con plantilla y no con
 * `cn()`, y por eso lo que devuelven se ajusta así:
 *
 *     `${clasesDeBoton({ tono: "primario" })} shrink-0`
 *
 * El arreglo de verdad es una línea en `src/lib/utils.ts` —enseñarle a `cn()`
 * la escala `text-panel-*` con `extendTailwindMerge`—, que no es piel y no es
 * este archivo. Hasta que esté, concatenar.
 */

/**
 * Lo que comparten los seis botones que esto viene a juntar, y lo que ninguno
 * puede volver a elegir por su cuenta.
 *
 * `pressable` trae la transición de fondo, borde, color y sombra más el hundido
 * al apretar, así que acá NO va un `transition-colors` propio: dos de los seis
 * lo tenían igual y los otros cuatro no, para el mismo efecto.
 *
 * `font-sans` va escrito aunque el layout del panel ya lo ponga, por lo mismo
 * que lo escribe `clasesDeCampo()`: la fuente del cuerpo del sitio es la serif
 * del diario, y una pieza que se pueda usar en cualquier lado no puede depender
 * de en qué árbol la cuelguen.
 *
 * El peso es uno solo —`font-semibold` en los cuatro tonos—. Antes el mismo
 * botón de contorno era `font-semibold` en `admin/page.tsx` y `font-medium` en
 * `fila-comentario.tsx`; la jerarquía entre un botón y otro la hacen el relleno
 * y el borde, que es donde se ve, no medio escalón de peso tipográfico.
 *
 * Nunca `focus:outline-none`, ni acá ni en ninguna variante: el anillo de la
 * casa (`:focus-visible`, 2px de acento con 3px de offset) es lo único que ve
 * quien navega con el teclado. Por eso los botones vecinos van separados con
 * `gap-panel-controles`, que son esos 5px de sangrado más 3px de aire.
 */
const BOTON_BASE =
  "pressable inline-flex items-center justify-center font-sans text-panel-sm font-semibold disabled:pointer-events-none disabled:opacity-50";

/**
 * Las dos alturas, y son dos y no tres.
 *
 * Los seis botones sueltos tenían `min-h-9`, `min-h-8` y ninguna: o sea 36px,
 * 32px y "lo que salga del padding", que en el de `fila-edicion` daban 33px.
 * Tres alturas para dos jerarquías es una tercera que nadie eligió.
 *
 *   normal → 36px, `px-3.5 py-2` — el botón de una cabecera o de un formulario,
 *            el que se aprieta una vez por pantalla.
 *   chico  → 32px, `px-3 py-1.5` — el que se repite en cada fila de una lista,
 *            donde 36px empujan la fila y la fila es lo que se lee.
 *
 * Los 32px del chico no son el mínimo de nada: el piso de WCAG 2.5.8 es 24×24 y
 * este pasa ocho píxeles por encima, igual que `ChipFiltro`, que ya vive al lado
 * de estos botones en las mismas pantallas.
 *
 * El `gap` baja con el tamaño porque el icono también baja (`h-4` en el normal,
 * `h-3.5` en el chico) y un aire fijo lo dejaría flotando lejos de su palabra.
 */
const BOTON_TAMANO = {
  normal: "min-h-9 gap-2 px-3.5 py-2",
  chico: "min-h-8 gap-1.5 px-3 py-1.5",
} as const;

/** Los cuatro tonos. `sobre` sólo entra donde hay relleno propio que elegir:
 *  el primario lo pone el acento y el fantasma no tiene. */
function tonoDeBoton(
  tono: "primario" | "secundario" | "destructivo" | "fantasma",
  sobre: SobreBoton,
): string {
  switch (tono) {
    case "primario":
      // El par ya medido: 5,66:1 en claro y 8,31:1 en oscuro. El hover se va a
      // `accent-strong`, que en cada tema se mueve para el lado que conserva
      // ese contraste contra el MISMO texto.
      return "bg-accent text-accent-contrast hover:bg-accent-strong";

    case "secundario":
      // **`--panel-borde-campo` y no `--panel-borde`, y esto es el arreglo de
      // un defecto, no una prolijidad.** Un botón de contorno no tiene relleno
      // propio ni sombra: su borde es el único límite del control, y WCAG
      // 1.4.11 le pide 3:1. `--panel-borde` mide 1,23:1 sobre la tarjeta, así
      // que los cuatro botones que lo usaban no tenían límite visible.
      // `--panel-borde-campo` da 3,39:1 sobre la tarjeta, 3,16:1 sobre la
      // hundida y 3,13:1 sobre el gris de la página. Es el mismo criterio que
      // ya se aplicó al campo y al chip inactivo.
      return `border border-panel-borde-campo text-panel-tinta-2 hover:border-accent hover:bg-panel-wash hover:text-panel-tinta ${RELLENO_CONTRARIO[sobre]}`;

    case "destructivo":
      // **El color no alcanza y no está solo.** El tono avisa por dos canales a
      // la vez: el filete rojo Y la palabra en tinta plena —`panel-tinta`,
      // mientras el secundario vecino va en `panel-tinta-2`—, así que la baja
      // se distingue del resto también en escala de grises. La palabra la pone
      // el llamador y es obligatoria: "Dar de baja", "Borrar". Un botón
      // destructivo que dice "Aceptar" es rojo y nada más.
      //
      // La tinta va a contraste pleno y NO teñida de rojo, por lo mismo que la
      // píldora pinta el punto y no la palabra: `--grafico-alerta` como texto
      // depende del tema y de la superficie, y un botón que a veces se lee y a
      // veces no es peor que uno sin color.
      //
      // El filete sí es `--grafico-alerta`, y llega como valor arbitrario
      // porque los `--grafico-*` quedaron a propósito afuera de `@theme` —se
      // usan como `var()` en atributos `style`—. Es la misma escritura que ya
      // tiene `fila-comentario.tsx` para el filete de un comentario de baja.
      // Medido como límite de control: 5,18:1 sobre la tarjeta blanca y 4,78:1
      // sobre el gris de la página en claro; 3,68:1 y 3,37:1 sobre las dos
      // superficies oscuras. Pasa el 3:1 en los seis casos.
      return `border border-[var(--grafico-alerta)] text-panel-tinta hover:bg-[color:color-mix(in_srgb,var(--grafico-alerta)_10%,transparent)] ${RELLENO_CONTRARIO[sobre]}`;

    case "fantasma":
      // Sin caja: es el "Cancelar" que acompaña a un primario. Arranca en
      // `panel-tinta-2` y no en `panel-tinta-3` como el `BOTON_QUIETO` que
      // reemplaza: `tinta-3` es la tinta de los metadatos, y la palabra de un
      // control se lee igual que la de sus vecinos aunque el control pese menos.
      return "text-panel-tinta-2 hover:bg-panel-wash hover:text-panel-tinta";
  }
}

/**
 * Las clases de un botón del panel.
 *
 * Devuelve una cadena y no un componente, por la misma razón que
 * `clasesDeCampo()`: el mismo botón tiene que servir en un `<button>`, en un
 * `<Link>` y en un `<a href>` de descarga, que no comparten props. Cuando hace
 * falta ajustar algo del contorno se concatena —`` `${clasesDeBoton()}
 * shrink-0` ``, ver la nota sobre `cn()` más arriba—, nunca para cambiarle el
 * color ni la altura: para eso están `tono` y `tamano`.
 *
 * Venía escrito SEIS veces en seis archivos: tres alturas (`min-h-9`, `min-h-8`
 * y ninguna), cinco rellenos (`px-4 py-2`, `px-3.5 py-2`, `px-3 py-1.5`…) y dos
 * bordes distintos para el mismo control de contorno. Cada uno de los seis
 * traía escrito arriba por qué NO estaba acá: "un botón no es una superficie".
 * Es cierto y no viene al caso —lo que junta a estas piezas no es ser una
 * superficie, es aparecer en cinco pantallas—, y seis definiciones que derivan
 * son la prueba.
 *
 * Lo que el botón NO decide, y queda para el llamador: qué elemento es, si
 * lleva icono (`h-4` en el normal, `h-3.5` en el chico, siempre `aria-hidden`)
 * y qué dice. Sobre todo qué dice: el tono destructivo no reemplaza la palabra.
 *
 * @param tono `primario` es la acción principal de la pantalla y hay una sola;
 *   `secundario` es el contorno; `destructivo` da de baja o borra; `fantasma`
 *   no tiene caja y es el que acompaña.
 * @param tamano `normal` (36px) o `chico` (32px), las dos únicas alturas.
 * @param sobre Sobre qué superficie apoya, para elegir el relleno contrario.
 */
export function clasesDeBoton(opciones?: {
  tono?: "primario" | "secundario" | "destructivo" | "fantasma";
  tamano?: "normal" | "chico";
  sobre?: SobreBoton;
}): string {
  const {
    tono = "secundario",
    tamano = "normal",
    sobre = "tarjeta",
  } = opciones ?? {};

  // Plantilla y no `cn()`: ver la nota de arriba. Acá no hay nada que fusionar
  // —cada parte manda sobre propiedades distintas— y `cn()` se comería el
  // `text-panel-sm` contra el color del tono.
  return `${BOTON_BASE} rounded-panel-2 ${BOTON_TAMANO[tamano]} ${tonoDeBoton(tono, sobre)}`;
}

/**
 * Las clases del botón que es sólo un icono: cuadrado de 32px, `rounded-panel-3`
 * y nada de texto visible.
 *
 * **Siempre lleva `aria-label`.** Es la mitad de la pieza que no entra en una
 * cadena de clases: un botón cuyo contenido es un `<svg aria-hidden>` no tiene
 * nombre accesible, y sin nombre no existe para un lector de pantalla. Los que
 * ya hay en `editor-nota.tsx` lo hacen bien y este es su formato.
 *
 * No tiene tono `primario`: un icono solo, sin palabra, no puede ser la acción
 * principal de una pantalla. Si hace falta que grite, lleva texto y es un
 * `clasesDeBoton({ tono: "primario" })`.
 *
 * El cuadrado es de 32px exactos —el piso de WCAG 2.5.8 es 24×24— y el radio es
 * `rounded-panel-3`, el escalón que `globals.css` define justamente para "el
 * cuadrado de un icono, un botón que es sólo un icono".
 */
export function clasesDeBotonIcono(opciones?: {
  tono?: "secundario" | "destructivo" | "fantasma";
  sobre?: SobreBoton;
}): string {
  const { tono = "secundario", sobre = "tarjeta" } = opciones ?? {};

  return `${BOTON_BASE} h-8 w-8 shrink-0 rounded-panel-3 ${tonoDeBoton(tono, sobre)}`;
}

/* ---------------------------------------------------------------------------
   Tablas
--------------------------------------------------------------------------- */

/**
 * Las clases de una tabla del panel.
 *
 * Son cadenas y no un componente porque las dos tablas que existen no tienen
 * nada en común salvo la piel: una lista cinco columnas de texto y la otra mete
 * componentes adentro de tres celdas. Lo que se copiaba entre
 * `consultas-migue.tsx` y `suscripciones/page.tsx` era exactamente esto —el
 * inset de la celda, el filete, la banda de la cabecera y el resalte al pasar el
 * mouse—, y ya había empezado a separarse: la cabecera de suscripciones se
 * quedó sin `text-left`, así que sus títulos salían centrados sobre columnas de
 * datos alineadas a la izquierda.
 *
 * Decisiones que vienen puestas:
 *
 * - **El ancho mínimo no está acá.** Es lo único de una tabla que depende de
 *   cuántas columnas tiene (46rem en una, 54rem en la otra), y meterlo en la
 *   pieza sería inventar un número que a las dos les queda mal:
 *   `cn(TABLA.tabla, "min-w-[54rem]")`.
 * - **La banda de la cabecera va en el `<th>` y no en el `<tr>`.** Las celdas
 *   embaldosan la fila entera, así que se ve igual, y de paso la fila del
 *   encabezado no necesita ninguna clase: una pieza menos que acordarse de
 *   poner.
 * - `text-left` va también en el `<th>`, aunque `tabla` ya lo tenga: el
 *   `text-align: center` del `<th>` es una regla del navegador y le gana al
 *   valor heredado. Es justo lo que le faltaba a la tabla de suscripciones.
 * - **Filas regladas con resalte al pasar el mouse**, no bandas alternas. Las
 *   dos resuelven lo mismo —no saltar de renglón en una tabla que se lee
 *   desplazándose al costado— y la banda que sigue al puntero marca la fila que
 *   estás leyendo, no una de cada dos. Como la fila no es un control, no hay
 *   cursor de mano ni click.
 * - **El tamaño y la tinta de las celdas están en `tabla`, no en `celda`, y eso
 *   es lo que hace que se puedan pisar.** `celda` es sólo geometría —inset y
 *   alineación—, así que la columna que manda se marca agregando UNA clase que
 *   no compite con ninguna otra, sólo con lo heredado:
 *
 *       `${TABLA.celda} font-medium text-panel-tinta`
 *       `${TABLA.celda} font-mono text-panel-xs`
 *
 *   Escrito al revés —la tinta secundaria puesta en cada celda— pisarla no
 *   funciona: dos clases de color en la misma cadena las resuelve el orden en
 *   que Tailwind las emitió, y `text-panel-tinta-2` sale DESPUÉS de
 *   `text-panel-tinta`, así que la celda destacada seguiría gris. Medido sobre
 *   el CSS compilado, no supuesto. Y con `cn()` tampoco, porque se lleva puesto
 *   el tamaño (ver la nota de los botones). Lo único que no falla es que no
 *   haya nada que pisar.
 *
 * `zona` es el contenedor que se desplaza, y **casi nunca se usa suelto**: lo
 * que hay que escribir junto con esa clase es `role="region"`, un nombre y
 * `tabIndex={0}`, y para eso está `ZonaDeTabla` acá abajo.
 */
export const TABLA = {
  // Caja con filete y radio propios, y no una tabla a sangre: el foco de la
  // casa es un outline con 3px de offset, y a sangre ese anillo se dibujaría
  // por afuera de la tarjeta que contiene la tabla. El radio es
  // `rounded-panel-2`, el de lo que se apoya DENTRO de una tarjeta.
  zona: "overflow-x-auto rounded-panel-2 border border-panel-borde",
  // Acá viven la voz y el tamaño del cuerpo de la tabla, para que las celdas
  // los HEREDEN y cualquier celda pueda pisarlos con una sola clase.
  tabla:
    "w-full border-collapse text-left font-sans text-panel-sm text-panel-tinta-2",
  // La cabecera va sobre la superficie hundida: en una tabla que se desplaza al
  // costado es lo único que le dice al ojo dónde termina el encabezado y
  // empiezan los datos. El `text-left` va sí o sí aunque `tabla` ya lo tenga:
  // el centrado del `<th>` es una regla del navegador y le gana a lo heredado.
  cabecera:
    "border-b border-panel-borde bg-panel-tarjeta-2 px-3 py-2.5 text-left text-panel-xs font-semibold whitespace-nowrap",
  fila: "border-b border-panel-borde transition-colors last:border-0 hover:bg-panel-wash",
  celda: "px-3 py-2.5 align-top",
} as const;

/**
 * La zona que se desplaza de una tabla, con lo que la hace alcanzable puesto.
 *
 * **Esto es un componente y no una cadena a propósito**, y es la única pieza de
 * la tanda que se sale de la regla. Una tabla más ancha que la pantalla que
 * adentro no tiene un solo elemento enfocable no se puede recorrer con el
 * teclado: en un viewport angosto se ven dos columnas y las de la derecha
 * quedan inalcanzables. Chrome 127+ hace enfocables los scrollers sin hijos
 * enfocables por su cuenta; **Firefox y Safari no**, y el arreglo del navegador
 * no es el arreglo de la página: falla WCAG 2.1.1.
 *
 * Lo que hay que escribir para que ande —`role="region"`, un nombre accesible,
 * `tabIndex={0}` y el `eslint-disable` que ese `tabIndex` necesita— son cuatro
 * cosas, ninguna evidente, y las dos tablas que hay las tienen porque la segunda
 * copió a la primera. La tercera no iba a tener tanta suerte. Con esto, hacerlo
 * bien es pasar dos props.
 *
 * El nombre va en un párrafo `sr-only` aparte y no en el `<caption>` porque
 * describe la ZONA que se desplaza, no la tabla: son dos cosas distintas y cada
 * una lleva la suya.
 *
 * @param id El id del nombre accesible. Se recibe y no se genera con `useId()`
 *   a propósito: estas tablas se arman en el servidor, donde `useId` no va, y
 *   un id inventado al vuelo cambia entre el servidor y el cliente. Como hay una
 *   tabla por pantalla, una constante escrita a mano no se puede duplicar.
 * @param nombre Qué zona es y que se desplaza, para quien no la ve.
 */
export function ZonaDeTabla({
  id,
  nombre,
  className,
  children,
}: {
  id: string;
  nombre: string;
  className?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      role="region"
      aria-labelledby={id}
      // La regla prohíbe `tabIndex` en lo no interactivo para que nadie meta un
      // `div` clickeable en el orden de tabulación. Acá el elemento no hace nada
      // al enfocarse: se enfoca para poder DESPLAZARLO con las flechas, que es
      // la excepción que recomienda la propia APG para un `region` con scroll.
      // Sacarlo es cambiar un aviso de lint por una falla de WCAG 2.1.1 real.
      // Vive acá una sola vez, que es la otra mitad de por qué esto es un
      // componente: escrito así, ninguna pantalla tiene que apagar la regla.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      className={cn(TABLA.zona, className)}
    >
      <p id={id} className="sr-only">
        {nombre}
      </p>
      {children}
    </div>
  );
}
