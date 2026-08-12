/** Props compartidas por las páginas del diario para que el paso de página
 *  anime según la dirección (los `transitionTypes` los ponen los links del
 *  pasador). Sin tipo de transición no anima: así el back del navegador o un
 *  refresh no disparan el giro. */
export const transicionPagina = {
  enter: {
    "pagina-adelante": "pagina-adelante",
    "pagina-atras": "pagina-atras",
    default: "none",
  },
  exit: {
    "pagina-adelante": "pagina-adelante",
    "pagina-atras": "pagina-atras",
    default: "none",
  },
  default: "none",
} as const;
