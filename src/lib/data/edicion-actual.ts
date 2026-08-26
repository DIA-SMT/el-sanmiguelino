import type { EdicionSemilla } from "@/lib/types";

/** Edición mock basada en el impreso aprobado. Cuando se conecte la
 *  persistencia real, esto pasa a un repo de ediciones. */
export const edicionActual: EdicionSemilla = {
  slug: "agosto-2026",
  mes: "Agosto de 2026",
  numero: 8,
  anio: 2026,
  etiqueta: "Edición mensual",
  notas: [
    {
      slug: "septiembre-musical-plaza-independencia",
      seccion: "Cultura",
      titulo:
        "El Septiembre Musical vuelve a la plaza Independencia con un show de apertura gratuito",
      bajada:
        "El festival más tradicional de la provincia abre su edición 2026 en el corazón fundacional de la ciudad: un espectáculo al aire libre con la Orquesta Estable, artistas locales y un mapping sobre los edificios históricos.",
      imagen: {
        src: "/notas/plaza-independencia.webp",
        alt: "Vista aérea de la plaza Independencia de San Miguel de Tucumán, rodeada por los edificios del centro",
        epigrafe:
          "La plaza Independencia, corazón fundacional de la ciudad, será el escenario de la apertura del festival.",
      },
      cuerpo: [
        {
          tipo: "parrafo",
          texto:
            "La plaza Independencia se prepara para una noche que promete quedar en la memoria de los sanmiguelinos. El viernes 4 de septiembre, desde las 20, el tradicional Septiembre Musical abrirá su edición 2026 con un gran espectáculo gratuito al aire libre: la Orquesta Estable de la Provincia compartirá escenario con artistas tucumanos de folclore, rock y música urbana, en un recorrido pensado para todas las generaciones.",
        },
        {
          tipo: "parrafo",
          texto:
            "El cierre estará a cargo de un mapping monumental proyectado sobre las fachadas del Casino y de la Casa de Gobierno, que repasará la historia del festival y los paisajes de la provincia. Habrá además una feria de emprendedores y food trucks sobre calle 25 de Mayo, con propuestas de gastronomía regional.",
        },
        {
          tipo: "cita",
          texto:
            "Queremos que la apertura sea una fiesta de todos: que la música vuelva a llenar la plaza y que cada vecino sienta que el festival también le pertenece.",
          autor: "Carolina Páez",
          cargo: "secretaria de Cultura",
        },
        { tipo: "subtitulo", texto: "Un escenario con historia" },
        {
          tipo: "parrafo",
          texto:
            "No es casual la elección del lugar: la plaza Independencia fue escenario de las grandes celebraciones de la ciudad desde el siglo XIX, y volverá a serlo con una puesta que combina tradición y tecnología. El escenario principal se montará frente a la fuente central, con pantallas laterales para que el show se disfrute desde cualquier sector del paseo.",
        },
        { tipo: "subtitulo", texto: "Operativo y accesos" },
        {
          tipo: "parrafo",
          texto:
            "Desde las 18 se cortará el tránsito en las cuatro calles perimetrales y se dispondrán accesos señalizados, sanitarios y un sector reservado para personas con movilidad reducida frente al Correo. La programación completa del festival puede consultarse en los canales oficiales y preguntándole a Migue desde este diario.",
        },
      ],
    },
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
      slug: "casa-historica-reconocimiento-nacional",
      seccion: "Historia",
      titulo:
        "La Casa Histórica recibió a autoridades nacionales por un nuevo reconocimiento patrimonial",
      bajada:
        "La presidenta de la Comisión Nacional de Monumentos encabezó el acto en el que el museo más visitado del norte argentino fue distinguido por su plan de conservación, un trabajo conjunto entre Nación, provincia y municipio.",
      imagen: {
        src: "/notas/casa-historica.jpg",
        alt: "Fachada restaurada de la Casa Histórica de la Independencia, blanca con puerta azul y banderas argentinas",
        epigrafe:
          "La fachada de la Casa Histórica, restaurada con técnicas tradicionales, lució sus banderas para recibir a la comitiva.",
      },
      cuerpo: [
        {
          tipo: "parrafo",
          texto:
            "La Casa Histórica de la Independencia volvió a vestirse de gala. Una comitiva encabezada por la presidenta de la Comisión Nacional de Monumentos, de Lugares y de Bienes Históricos recorrió el museo y encabezó el acto en el que se distinguió el plan integral de conservación del edificio donde se declaró la Independencia argentina en 1816.",
        },
        {
          tipo: "parrafo",
          texto:
            "El reconocimiento pone en valor casi una década de trabajo silencioso: la restauración de la fachada con cal y técnicas tradicionales, la recuperación del mobiliario original del Salón de la Jura y la modernización del guion museográfico, que hoy combina piezas históricas con recursos interactivos y visitas accesibles.",
        },
        {
          tipo: "cita",
          texto:
            "Esta casa no es solo de los tucumanos: es el living de la Patria. Cuidarla entre todos los niveles del Estado es la mejor manera de honrar lo que acá se juró.",
          autor: "María Inés Rodríguez",
          cargo: "presidenta de la Comisión Nacional de Monumentos",
        },
        { tipo: "subtitulo", texto: "Un símbolo que se renueva" },
        {
          tipo: "parrafo",
          texto:
            "Con más de medio millón de visitantes por año, la Casa Histórica es el museo más concurrido del norte argentino. Durante el acto se anunció además la ampliación del espectáculo nocturno de luz y sonido, que desde octubre sumará una función accesible con intérprete de lengua de señas y audiodescripción.",
        },
        {
          tipo: "parrafo",
          texto:
            "La jornada cerró con un detalle que emocionó a los presentes: el izamiento conjunto de las banderas de las catorce provincias que juraron la Independencia, a cargo de estudiantes de escuelas públicas de la ciudad.",
        },
      ],
    },
    {
      slug: "plan-bacheo-integral",
      seccion: "Obras",
      titulo:
        "Bacheo en marcha: la Municipalidad repara más de 200 cuadras en toda la ciudad",
      bajada:
        "Cuadrillas trabajan de día y de noche con asfalto en caliente sobre los corredores del transporte público y las avenidas troncales; el plan sigue por los barrios con un cronograma semanal.",
      imagen: {
        src: "/notas/bacheo-calles.jpg",
        alt: "Operarios municipales con palas y una minicargadora reparando el pavimento en una avenida, con un colectivo detrás",
        epigrafe:
          "Cuadrillas municipales trabajan sobre la avenida Sáenz Peña, uno de los corredores priorizados por el plan.",
      },
      cuerpo: [
        {
          tipo: "parrafo",
          texto:
            "El plan integral de bacheo ya se siente en las calles: más de 200 cuadras fueron intervenidas en los primeros dos meses de trabajo, con cuadrillas propias que operan en simultáneo en distintos puntos de la ciudad. La prioridad son los corredores por donde circula el transporte público y las avenidas de acceso al microcentro, donde el deterioro del pavimento afectaba a miles de vecinos por día.",
        },
        {
          tipo: "parrafo",
          texto:
            "La novedad de esta etapa es la incorporación de asfalto en caliente de producción propia, que permite reparaciones más durables y reduce los tiempos de corte: un bache tipo se cierra y queda habilitado al tránsito en menos de tres horas. En los corredores más transitados, los equipos trabajan en horario nocturno para no entorpecer la circulación.",
        },
        {
          tipo: "cita",
          texto:
            "No es parche sobre parche: cada intervención se hace con base compactada y asfalto en caliente, para que la reparación dure. La meta es llegar a fin de año con los cuarenta corredores del transporte público al cien por ciento.",
          autor: "Gustavo Medina",
          cargo: "secretario de Obras Públicas",
        },
        { tipo: "subtitulo", texto: "Cronograma por barrios" },
        {
          tipo: "parrafo",
          texto:
            "Superada la etapa de corredores, el plan continúa por los barrios con un cronograma semanal que se publica en los canales oficiales del municipio. Los vecinos pueden reportar baches directamente a Migue, el asistente virtual, indicando la esquina: el reclamo se georreferencia y entra en la programación de las cuadrillas.",
        },
      ],
    },
    {
      slug: "nuevo-sistema-transporte-publico",
      seccion: "Transporte",
      titulo:
        "El transporte público se renueva: pago con QR y colectivos en tiempo real",
      bajada:
        "La ciudad avanza hacia un sistema de transporte inteligente: a la tarjeta se suma el pago con código QR desde el celular, y una app mostrará en qué momento llega cada colectivo a la parada.",
      imagen: {
        src: "/notas/colectivo-101.webp",
        alt: "Pasajeros subiendo a un colectivo rojo de la línea 101 en una parada del centro de San Miguel de Tucumán",
        epigrafe:
          "La línea 101, una de las primeras en incorporar los validadores con lectura de código QR.",
      },
      cuerpo: [
        {
          tipo: "parrafo",
          texto:
            "Viajar en colectivo por San Miguel de Tucumán está por cambiar. El nuevo sistema de transporte público, que comienza a implementarse por etapas este mes, suma el pago con código QR desde cualquier billetera virtual a la tarjeta tradicional, y pone en marcha el seguimiento satelital de toda la flota: cada unidad informará su posición en tiempo real.",
        },
        {
          tipo: "parrafo",
          texto:
            "Para el pasajero, la diferencia se notará en la espera: una aplicación gratuita —y las pantallas que se instalarán en las paradas de mayor demanda— mostrarán cuántos minutos falta para que llegue cada línea. Se acabó el asomarse a la esquina a adivinar: la información estará en el bolsillo.",
        },
        {
          // Un destacado repite una frase del propio cuerpo: eso es lo que
          // hace en el papel, levantar una idea que ya está escrita.
          tipo: "destacado",
          texto:
            "Se acabó el asomarse a la esquina a adivinar: la información estará en el bolsillo.",
        },
        { tipo: "subtitulo", texto: "Cómo funciona" },
        {
          tipo: "parrafo",
          texto:
            "El validador de cada unidad aceptará tres formas de pago: la tarjeta de siempre, el código QR generado desde la app o la billetera virtual, y en una etapa posterior las tarjetas bancarias sin contacto. El boleto estudiantil y los pases especiales migran automáticamente al nuevo sistema, sin trámites adicionales.",
        },
        {
          tipo: "ficha",
          titulo: "Las formas de pagar el boleto",
          entradas: [
            {
              lead: "La tarjeta de siempre",
              texto:
                "Sigue funcionando igual. El boleto estudiantil y los pases especiales migran solos al nuevo sistema, sin trámites.",
            },
            {
              lead: "Código QR",
              texto:
                "Se genera desde la aplicación o desde cualquier billetera virtual y se valida en el lector de la unidad.",
            },
            {
              lead: "Tarjetas sin contacto",
              texto:
                "Las tarjetas bancarias se incorporan en una etapa posterior del despliegue.",
            },
            {
              lead: "Dónde arranca",
              texto:
                "Las líneas 101, 102 y 8 concentran un tercio de los viajes diarios y son las primeras; el resto de la flota se suma antes de fin de año.",
            },
          ],
        },
        {
          tipo: "cita",
          texto:
            "El colectivo es el modo en que se mueve la mayoría de la ciudad. Modernizarlo no es solo tecnología: es devolverle tiempo a la gente, que es lo más valioso que tiene.",
          autor: "Javier Núñez",
          cargo: "subsecretario de Movilidad Urbana",
        },
        { tipo: "subtitulo", texto: "Etapas de implementación" },
        {
          tipo: "parrafo",
          texto:
            "La primera etapa alcanza a las líneas 101, 102 y 8, que concentran un tercio de los viajes diarios; el resto de la flota se incorporará antes de fin de año. Los horarios y recorridos también podrán consultarse conversando con Migue, que ya está aprendiendo a responder sobre el nuevo sistema.",
        },
      ],
    },
    {
      slug: "peatonal-luminarias-led",
      seccion: "Obras",
      titulo:
        "La peatonal se renueva: nuevas luminarias LED y más accesibilidad",
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
      titulo:
        "Agenda de agosto: teatro, ferias y música en los espacios públicos",
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
