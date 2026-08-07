import type { Edicion } from "@/lib/types";

/** Edición mock basada en el impreso aprobado. Cuando se conecte la
 *  persistencia real, esto pasa a un repo de ediciones. */
export const edicionActual: Edicion = {
  slug: "agosto-2026",
  mes: "Agosto de 2026",
  numero: 8,
  anio: 2026,
  etiqueta: "Edición mensual",
  notas: [
    {
      slug: "parque-9-de-julio-museo-a-cielo-abierto",
      seccion: "Ciudad",
      titulo: "El Parque 9 de Julio, un museo a cielo abierto a descubrir",
      bajada:
        "Esculturas clásicas restauradas devuelven al gran pulmón verde de la ciudad su carácter de galería al aire libre, un patrimonio que forma parte del paisaje cotidiano desde hace casi un siglo.",
      imagen: {
        alt: "Escultura Laocoonte y sus hijos en el Parque 9 de Julio, con su placa restaurada al pie",
        epigrafe:
          "Laocoonte y sus hijos. Esta escultura inmortaliza el trágico mito del sacerdote troyano que intentó alertar a su pueblo sobre el peligro del caballo de Troya.",
      },
      cuerpo: [
        {
          tipo: "parrafo",
          texto:
            "El Parque 9 de Julio no es solo el gran pulmón verde de San Miguel de Tucumán. Entre sus avenidas, rosedales, fuentes y rincones arbolados, aguarda también un patrimonio artístico singular: un conjunto de esculturas que, desde hace casi un siglo, forman parte del paisaje cotidiano de la ciudad.",
        },
        {
          tipo: "parrafo",
          texto:
            "Muchas de estas piezas llegaron al parque durante la década de 1920, en un momento de fuerte modernización urbana y cultural. La provincia buscaba afirmarse como un centro de progreso, educación y refinamiento artístico, en diálogo con las grandes tradiciones europeas. En ese contexto, el arte clásico ocupó un lugar central: sus formas armónicas, sus figuras mitológicas y su ideal de belleza fueron incorporados al espacio público como parte de un proyecto cultural más amplio.",
        },
        {
          tipo: "cita",
          texto:
            "Con la restauración de estas esculturas valiosísimas, estamos rescatando nuestra historia, nuestra cultura y el arte en este paseo, que es de todos los ciudadanos.",
          autor: "Rossana Chahla",
          cargo: "intendenta",
        },
        {
          tipo: "parrafo",
          texto:
            "En 1927 y 1928, durante la gestión del gobernador Miguel Campero, con la colaboración de Juan B. Terán y de la Comisión Administradora del Parque Centenario, se adquirieron numerosas reproducciones de esculturas griegas, helenísticas y neoclásicas. Algunas fueron realizadas en mármol de Carrara; otras, en hierro fundido, provenientes de prestigiosas fundiciones europeas como Val d'Osne, de París, y Cesare della Seta, de Roma.",
        },
        {
          tipo: "parrafo",
          texto:
            "Así, el parque comenzó a transformarse en una verdadera galería al aire libre.",
        },
        { tipo: "subtitulo", texto: "Belleza clásica en el paisaje tucumano" },
        {
          tipo: "parrafo",
          texto:
            "Entre las obras incorporadas se encontraban piezas emblemáticas como la Venus de Milo, la Venus de Médici, el Discóbolo, la Diana de Gabios, el Gálata moribundo, la Meditación y el propio Laocoonte. Su presencia respondía a una idea muy clara: el espacio público también debía educar la sensibilidad, acercando la vida ciudadana al arte y ofreciendo a la ciudadanía una experiencia estética directa.",
        },
        {
          tipo: "parrafo",
          texto:
            "La disposición de las esculturas no fue casual. Cada pieza fue ubicada en diálogo con el entorno: entre la vegetación, junto a las fuentes o al remate de una avenida, de modo que la figura, la luz y los senderos formaran una misma composición. De ese modo, el arte no solo embellecía el paseo: convertía en museo lo que la naturaleza ya ofrecía como escenario.",
        },
        { tipo: "subtitulo", texto: "Un patrimonio centenario" },
        {
          tipo: "parrafo",
          texto:
            "En 1927, con la creación de la Comisión Administradora, el parque consolidó su fisonomía actual y sus esculturas quedaron integradas de manera definitiva al recorrido. Hoy, con los trabajos de restauración encarados por la Municipalidad, cada pieza recupera su placa identificatoria con código QR, que permite conocer su historia desde el celular.",
        },
        {
          tipo: "parrafo",
          texto:
            "La invitación queda hecha: recorrer el Parque 9 de Julio con otros ojos, descubrir sus esculturas y reencontrarse con un patrimonio que es de todos los sanmiguelinos.",
        },
      ],
    },
    {
      slug: "peatonal-luminarias-led",
      seccion: "Obras",
      titulo: "La peatonal se renueva: nuevas luminarias LED y más accesibilidad",
      bajada:
        "El plan de puesta en valor del microcentro suma iluminación de bajo consumo, rampas renovadas y señalética táctil en las esquinas de mayor circulación.",
      imagen: {
        alt: "Peatonal del microcentro de San Miguel de Tucumán con las nuevas luminarias encendidas al atardecer",
        epigrafe:
          "La peatonal Mendoza, con las nuevas columnas de iluminación de bajo consumo ya en funcionamiento.",
      },
      cuerpo: [
        {
          tipo: "parrafo",
          texto:
            "El microcentro avanza en su puesta en valor con la renovación integral del sistema de iluminación de la peatonal. Las nuevas luminarias LED reducen el consumo eléctrico a la mitad y mejoran la visibilidad nocturna, un reclamo histórico de comerciantes y vecinos.",
        },
        {
          tipo: "parrafo",
          texto:
            "Los trabajos incluyen además la renovación de rampas de accesibilidad en todas las esquinas, la incorporación de señalética táctil y la nivelación de solados para garantizar la circulación segura de personas con movilidad reducida.",
        },
        {
          tipo: "parrafo",
          texto:
            "La obra se ejecuta por etapas para no interrumpir la actividad comercial y estará finalizada antes de las fiestas de fin de año, según informó la Secretaría de Obras Públicas.",
        },
      ],
    },
    {
      slug: "agenda-cultural-agosto",
      seccion: "Cultura",
      titulo: "Agenda de agosto: teatro, ferias y música en los espacios públicos",
      bajada:
        "El mes del aniversario de la ciudad llega con una programación gratuita que recorre plazas, museos y centros culturales de todos los barrios.",
      cuerpo: [
        {
          tipo: "parrafo",
          texto:
            "Agosto llega cargado de propuestas para disfrutar en familia. La Municipalidad preparó una agenda con más de cuarenta actividades gratuitas: ciclos de teatro independiente, ferias de diseño y gastronomía, y conciertos al aire libre en las plazas de los distintos barrios.",
        },
        {
          tipo: "parrafo",
          texto:
            "Entre los destacados figuran la Feria del Libro Infantil en el Museo de la Ciudad, los sábados de música en vivo en la plaza Urquiza y el ciclo de cine bajo las estrellas en el Parque 9 de Julio, con funciones todos los viernes a las 20.",
        },
        {
          tipo: "parrafo",
          texto:
            "La programación completa, con fechas y sedes, puede consultarse en los canales oficiales del municipio y a través de Migue, el asistente virtual.",
        },
      ],
    },
    {
      slug: "migue-asistente-24-horas",
      seccion: "Innovación",
      titulo: "Migue, el asistente que responde consultas las 24 horas",
      bajada:
        "El asistente virtual del municipio suma nuevas capacidades y ahora también acompaña la lectura de El Sanmiguelino: se le puede preguntar sobre cualquier nota de la edición.",
      cuerpo: [
        {
          tipo: "parrafo",
          texto:
            "Desde su lanzamiento, Migue se convirtió en la puerta de entrada digital a los servicios municipales: turnos, trámites, reclamos y consultas se resuelven conversando, a cualquier hora y desde cualquier dispositivo.",
        },
        {
          tipo: "parrafo",
          texto:
            "Ahora, además, Migue acompaña este diario. Desde la burbuja azul en la esquina inferior de la pantalla se le puede preguntar sobre el contenido de la edición: qué notas hay, de qué trata cada una o dónde encontrar un dato puntual.",
        },
        {
          tipo: "parrafo",
          texto:
            "El desarrollo está a cargo de la Dirección de IA de la Municipalidad, el mismo equipo detrás de esta edición digital.",
        },
      ],
    },
  ],
};

export function getNota(slug: string) {
  return edicionActual.notas.find((n) => n.slug === slug) ?? null;
}
