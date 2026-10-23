import { cn } from "@/lib/utils";

/**
 * Las imágenes del panel: la foto del banner y los dibujos de los estados
 * vacíos.
 *
 * Los dibujos salen del kit visual que entregó la redacción el 2026-10-23
 * (`03_ilustraciones_editoriales/*.svg`), pero **redibujados con los tokens del
 * panel en vez de copiadas como archivos**. Los SVG del kit traen los colores
 * escritos a fuego —marfil, azul oscuro, celeste de modo claro— y dentro de un
 * `<img>` no hay forma de que sigan al tema: en nocturno habrían sido
 * rectángulos crema encendidos en medio del panel oscuro. Inline, cada trazo
 * toma `--panel-tinta`, `--accent` o `--panel-oro`, y cambia solo con el toggle.
 *
 * Se les sacó también el fondo de cada lienzo (el degradé marfil y la trama de
 * renglones): el fondo lo pone la superficie donde se apoyan, y el dibujo queda
 * recortado a su caja con el `viewBox`.
 *
 * Todas son decorativas y van `aria-hidden`: el estado vacío lo dice el texto
 * que las acompaña, nunca el dibujo. Ninguna representa un edificio real ni el
 * logotipo del diario —el periódico del kit traía "EL SANMIGUELINO" escrito en
 * Georgia, que es una imitación de la marca, y acá es una franja lisa—.
 */

/** Relleno "celeste" de los dibujos: el acento muy diluido sobre la tarjeta,
 *  que en claro da el #E0EBF8 del kit y en oscuro un azul hundido. */
const CELESTE = "color-mix(in srgb, var(--accent) 14%, var(--panel-tarjeta))";

/* ---------------------------------------------------------------------------
   La foto del banner
--------------------------------------------------------------------------- */

/**
 * La panorámica de la ciudad en la cabecera, como en el boceto del kit.
 *
 * **Es la foto que ya usa la landing y NO la del kit.** La cabecera del kit
 * (`cabecera_tucuman_conceptual.jpg`) es una imagen generada, el propio prompt
 * pide no presentarla como foto real, y además trae el logotipo redibujado
 * pegado encima. Ésta es una foto de verdad del centro tucumano, con su
 * procedencia y su licencia anotadas en `public/portada/README.md`: el
 * pendiente de crédito de la CC BY-SA que figura ahí vale también acá.
 *
 * Fondo CSS y no `next/image`, por dos cosas. Esta pieza se importa desde
 * componentes de cliente, así que no puede preguntar con `imagenDisponible()`
 * —que lee el disco— si el archivo está; un fondo que no existe no se dibuja y
 * no deja el ícono de imagen rota. Y en el teléfono la caja es `hidden`, y el
 * navegador no descarga el fondo de un elemento que no se muestra.
 *
 * Va desvanecida hacia la izquierda con una máscara, para que el título y la
 * bajada nunca tengan foto detrás, y con el mismo velo de la landing
 * (`--velo-panorama`), que la pasa al tono del tema: crema en claro, noche en
 * oscuro.
 */
const PANORAMA = "/portada/panoramica-tucuman.jpg";

export function FotoCabecera({
  className,
}: {
  className?: string;
}): React.ReactElement {
  const mascara = "linear-gradient(90deg, transparent 0%, #000 50%)";
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none bg-cover saturate-[0.72]", className)}
      style={{
        backgroundImage: `url(${PANORAMA})`,
        // Más arriba que en la landing (42 %): la tira es tan baja que con el
        // encuadre de allá se pierde la sierra, que es lo que hace a la ciudad.
        backgroundPosition: "50% 28%",
        maskImage: mascara,
        WebkitMaskImage: mascara,
      }}
    >
      <div
        className="absolute inset-0"
        style={{ background: "var(--velo-panorama)" }}
      />
    </div>
  );
}

/* ---------------------------------------------------------------------------
   La silueta del pie de la barra
--------------------------------------------------------------------------- */

/**
 * Una silueta de ciudad en línea fina, para el hueco que queda al pie de la
 * barra lateral en pantalla ancha —la "ilustración arquitectónica discreta"
 * que pide el rediseño—.
 *
 * Sale de la cabecera del kit (`02_fondos_y_cabeceras/banner_editorial.svg`):
 * los mismos edificios con cúpula, sin el fondo marfil y con el trazo en la
 * tinta del panel al 18 %, así que se lee como grabado y sigue al tema. No es
 * ninguna ciudad en particular: son rectángulos y cúpulas, una referencia y no
 * un retrato de San Miguel de Tucumán.
 */
export function SiluetaCiudad({
  className,
}: {
  className?: string;
}): React.ReactElement {
  return (
    <svg
      viewBox="0 140 800 200"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      focusable="false"
      className={cn("pointer-events-none", className)}
    >
      <circle cx="690" cy="190" r="34" fill="var(--panel-oro)" opacity="0.28" />
      <g
        fill="none"
        stroke="var(--panel-tinta)"
        strokeOpacity="0.18"
        strokeWidth="3"
      >
        <path d="M0 310H800" />
        <path d="M22 310V244H82V310M36 244V227H67V244M107 310V193H172V310M117 193V169H161V193M188 310V253H265V310M285 310V202H350V310M299 202V180H338V202M371 310V231H424V310M447 310V170H509V310M459 170V151H496V170M528 310V246H605V310M625 310V208H688V310M704 310V254H783V310" />
      </g>
      <path
        d="M0 322C175 300 300 340 474 318C636 303 722 321 800 304V340H0Z"
        fill="var(--accent)"
        opacity="0.07"
      />
    </svg>
  );
}

/* ---------------------------------------------------------------------------
   Los dibujos de estado vacío
--------------------------------------------------------------------------- */

/** Qué dibujo. Uno por clase de lista vacía, no uno por pantalla. */
export type TemaIlustracion =
  | "periodico"
  | "comentarios"
  | "usuarios"
  | "archivo"
  | "estadisticas"
  | "auditoria";

/** Cada dibujo con su recorte. Las coordenadas son las del lienzo de 800×380
 *  del kit, así que el `viewBox` es la caja del dibujo dentro de ese lienzo. */
const DIBUJOS: Record<
  TemaIlustracion,
  { caja: string; dibujo: React.ReactNode }
> = {
  periodico: {
    caja: "235 35 316 326",
    dibujo: (
      <g transform="translate(245 45)">
        <rect x="28" y="35" width="268" height="271" rx="8" fill="var(--panel-borde)" />
        <rect
          width="268"
          height="271"
          rx="7"
          fill="var(--panel-tarjeta)"
          stroke="var(--panel-tinta)"
          strokeWidth="3"
        />
        {/* La cabecera del periódico es una franja y no una palabra: ver
            arriba por qué no se escribe el nombre del diario. */}
        <rect x="20" y="20" width="228" height="24" rx="2" fill="var(--panel-tinta)" />
        <path d="M20 55H248" stroke="var(--panel-tinta)" strokeWidth="3" />
        <rect x="20" y="76" width="139" height="109" rx="4" fill={CELESTE} />
        <circle cx="128" cy="104" r="16" fill="var(--panel-oro)" />
        <path
          d="M25 168L77 123L114 154L158 130"
          stroke="var(--accent)"
          strokeWidth="5"
          fill="none"
        />
        <g stroke="var(--panel-tinta)" strokeOpacity="0.4" strokeWidth="4">
          <path d="M175 85H249M175 104H249M175 123H249M175 142H249M175 161H249M175 180H249M20 207H248M20 222H248M20 237H248M20 252H248" />
        </g>
      </g>
    ),
  },
  comentarios: {
    caja: "225 50 345 260",
    dibujo: (
      <g transform="translate(235 77)">
        <path
          d="M24 0H274Q298 0 298 25V145Q298 171 271 171H123L56 220V171H24Q0 171 0 145V25Q0 0 24 0Z"
          fill={CELESTE}
          stroke="var(--panel-tinta)"
          strokeWidth="7"
        />
        <g fill="var(--accent)">
          <circle cx="80" cy="87" r="13" />
          <circle cx="149" cy="87" r="13" />
          <circle cx="218" cy="87" r="13" />
        </g>
        <circle cx="300" cy="17" r="27" fill="var(--panel-oro)" />
      </g>
    ),
  },
  usuarios: {
    caja: "230 55 335 285",
    dibujo: (
      <g
        transform="translate(255 60)"
        fill={CELESTE}
        stroke="var(--panel-tinta)"
        strokeWidth="7"
      >
        <circle cx="141" cy="76" r="59" />
        <path d="M27 270Q31 162 141 162Q252 162 255 270Z" />
        <circle cx="20" cy="120" r="32" />
        <circle cx="264" cy="120" r="32" />
        <path d="M0 222V175Q5 158 27 158M284 222V175Q276 158 256 158" fill="none" />
      </g>
    ),
  },
  archivo: {
    caja: "255 65 280 250",
    dibujo: (
      <g
        transform="translate(270 63)"
        fill="none"
        stroke="var(--panel-tinta)"
        strokeWidth="7"
        strokeLinejoin="round"
      >
        <rect x="0" y="74" width="250" height="168" rx="9" fill="var(--panel-tarjeta)" />
        <path d="M0 92L50 12H196L250 92" fill={CELESTE} />
        <rect
          x="93"
          y="116"
          width="65"
          height="69"
          rx="5"
          fill="var(--panel-oro)"
          stroke="none"
          opacity="0.55"
        />
        <path d="M0 92H250M76 121H174M108 148H143" />
      </g>
    ),
  },
  estadisticas: {
    caja: "240 65 320 270",
    dibujo: (
      <g transform="translate(250 55)">
        <rect
          x="0"
          y="20"
          width="300"
          height="250"
          rx="12"
          fill="var(--panel-tarjeta)"
          stroke="var(--panel-tinta)"
          strokeWidth="6"
        />
        <path d="M40 217H260" stroke="var(--panel-tinta)" strokeWidth="5" />
        <rect
          x="53"
          y="148"
          width="45"
          height="69"
          rx="5"
          fill="color-mix(in srgb, var(--accent) 38%, var(--panel-tarjeta))"
        />
        <rect x="125" y="100" width="45" height="117" rx="5" fill="var(--accent)" />
        <rect x="197" y="52" width="45" height="165" rx="5" fill="var(--panel-oro)" />
      </g>
    ),
  },
  auditoria: {
    caja: "270 44 260 275",
    dibujo: (
      <g
        transform="translate(275 54)"
        stroke="var(--panel-tinta)"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      >
        <circle cx="124" cy="140" r="115" fill={CELESTE} />
        <path d="M124 61V141L180 181" />
        <path d="M123 0V31M0 140H30M221 140H249" />
        <circle cx="124" cy="140" r="10" fill="var(--accent)" stroke="none" />
      </g>
    ),
  },
};

/**
 * Un dibujo de estado vacío. Mide lo que diga `className` —por defecto 96px
 * de alto— y nunca más: el kit lo pide contenido, y un dibujo grande en una
 * lista vacía se lee como una pantalla de error.
 */
export function IlustracionPanel({
  tema,
  className,
}: {
  tema: TemaIlustracion;
  className?: string;
}): React.ReactElement {
  const { caja, dibujo } = DIBUJOS[tema];
  return (
    <svg
      viewBox={caja}
      aria-hidden="true"
      focusable="false"
      className={cn("h-24 w-auto", className)}
    >
      {dibujo}
    </svg>
  );
}
