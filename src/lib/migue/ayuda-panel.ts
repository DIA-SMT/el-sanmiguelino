/**
 * Lo que Migue sabe del panel de administración: las dudas de cada pantalla,
 * con su respuesta escrita.
 *
 * Sirve dos veces, y por eso vive en un solo lugar:
 *
 * 1. **Las preguntas de cada pantalla** del chat del panel (`MiguePanel`).
 *    Se contestan con este texto, en el cliente, sin llamar al modelo.
 * 2. **La guía que lee el modelo** cuando alguien escribe "otra consulta"
 *    (`lib/migue/panel.ts`). Es lo único que sabe del panel.
 *
 * Así lo que Migue contesta por los dos caminos no se puede contradecir.
 *
 * **Cada respuesta describe lo que el código hace hoy**, con los nombres de los
 * botones tal como se ven. Si se cambia una regla —qué se puede borrar, cuándo
 * sale una edición— o el texto de un botón, se cambia acá en el mismo cambio:
 * una ayuda que miente es peor que no tener ayuda.
 *
 * No lleva `server-only`: el cliente necesita las preguntas. No hay nada
 * secreto; es lo mismo que dicen las pantallas.
 */

export type PantallaDelPanel =
  | "notas"
  | "editor"
  | "ediciones"
  | "comentarios"
  | "migue"
  | "suscripciones"
  | "usuarios"
  | "auditoria";

interface Pregunta {
  pregunta: string;
  respuesta: string;
}

export const AYUDA: Record<
  PantallaDelPanel,
  { nombre: string; preguntas: Pregunta[] }
> = {
  notas: {
    nombre: "Notas",
    preguntas: [
      {
        pregunta: "¿Cómo cargo una nota nueva?",
        respuesta:
          "Apretá «Nota nueva», arriba a la derecha. Completá título, sección y el cuerpo, y tocá «Guardar». La nota recién existe cuando la guardás.",
      },
      {
        pregunta: "¿Cómo cambio el orden de las notas?",
        respuesta:
          "Con las flechas de cada fila: subir o bajar. Sólo se mueven las notas escritas. Las páginas de un PDF van en el orden del papel, y en una edición digitalizada nada puede ir antes de la tapa impresa.",
      },
      {
        pregunta: "¿Qué quiere decir «Tapa»?",
        respuesta:
          "Es la primera nota de la edición: la que abre la portada del diario. Si la edición es un PDF sin digitalizar, la tapa es la página 1 del PDF y no se marca ninguna fila.",
      },
      {
        pregunta: "¿Lo que guardo se publica enseguida?",
        respuesta:
          "Sí. Todavía no hay borradores ni historial de versiones: lo que guardás sale publicado al instante. Si la nota está en una edición programada o sin fecha, los lectores la ven recién cuando esa edición sale.",
      },
    ],
  },

  editor: {
    nombre: "Editor de nota",
    preguntas: [
      {
        pregunta: "¿Cómo agrego una foto a la nota?",
        respuesta:
          "En la tarjeta «Foto», tocá «Subir una foto» (JPG, PNG o WebP, hasta 8 MB). Completá el «Texto alternativo»: sin él la foto no se guarda. «Epígrafe» y «Crédito» son opcionales. La foto queda publicada recién cuando guardás.",
      },
      {
        pregunta: "¿Qué bloques puedo usar en el cuerpo?",
        respuesta:
          "Párrafo, Subtítulo, Cita, Destacado, Ficha de datos, Foto, Lista e Interactivo. Con «Agregar bloque» sumás uno, y cada bloque se puede mover o borrar. El cuerpo no puede quedar vacío.",
      },
      {
        pregunta: "¿Cómo elijo dónde va la nota en la edición?",
        respuesta:
          "Con «Ubicación en la edición»: «Primera (va a la tapa)» o «Después de» otra nota. Si cambiás la «Edición», la nota pasa al final de esa edición. Las páginas de un PDF no se pueden mover.",
      },
      {
        pregunta: "¿Cómo borro una nota?",
        respuesta:
          "Abajo de todo, en «Borrar la nota». Te muestra qué se pierde y no hay papelera: no se puede deshacer. Si la nota tiene comentarios, te pide escribir su slug para confirmar.",
      },
    ],
  },

  ediciones: {
    nombre: "Ediciones",
    preguntas: [
      {
        pregunta: "¿Cómo creo una edición nueva?",
        respuesta:
          "En el formulario «Edición nueva»: mes, slug, número, año y, si querés, «Sale el» en hora de Tucumán. Tocá «Crear edición». El número no se puede repetir en el mismo año.",
      },
      {
        pregunta: "¿Cómo programo cuándo sale?",
        respuesta:
          "Con la fecha «Sale el», en hora de Tucumán: la edición sale sola en ese momento, sin que nadie apriete nada. Para sacarla ya, usá «Poner en la calle», que sólo se puede si la edición tiene contenido.",
      },
      {
        pregunta: "¿Cómo cargo el PDF del impreso?",
        respuesta:
          "En el bloque «Diario en PDF», con «Cargar el PDF» (hasta 50 MB). Después de subirlo se digitaliza solo, y puede tardar unos minutos. La tapa es la página 1, y las notas escritas quedan después de las páginas del papel.",
      },
      {
        pregunta: "¿Puedo ver una edición antes de que salga?",
        respuesta:
          "Sí, con «Verla en el diario»: la ves como la va a ver un lector. Para volver a la edición en la calle, tocá «Dejar de verla».",
      },
    ],
  },

  comentarios: {
    nombre: "Comentarios",
    preguntas: [
      {
        pregunta: "¿Cómo saco un comentario ofensivo?",
        respuesta:
          "Tocá «Dar de baja», elegí el motivo —por ejemplo «Insulto o agresión»—, agregá un detalle si hace falta y confirmá con «Confirmar la baja». Deja de verse en el diario, y queda anotado quién lo bajó y por qué.",
      },
      {
        pregunta: "¿Puedo borrarlo del todo?",
        respuesta:
          "Sí, pero primero hay que darlo de baja: «Borrar» aparece recién en los comentarios de baja. «Borrarlo para siempre» lo elimina con sus votos y no se puede deshacer. La auditoría guarda quién, de qué nota y el motivo, nunca el texto.",
      },
      {
        pregunta: "¿Qué es «Mandar a revisión»?",
        respuesta:
          "Saca el comentario del diario mientras decidís qué hacer. Después lo podés volver a mostrar con «Publicar de nuevo», o darlo de baja.",
      },
      {
        pregunta: "¿Cómo bloqueo a quien escribe agresiones?",
        respuesta:
          "Desde el comentario, con «Bloquear a quien lo escribió» y «Confirmar el bloqueo». El comentario no cambia de estado: bajalo aparte si hace falta. Para desbloquear, andá a Usuarios.",
      },
    ],
  },

  migue: {
    nombre: "Migue",
    preguntas: [
      {
        pregunta: "¿Qué muestra esta pantalla?",
        respuesta:
          "Lo que los vecinos le preguntaron a Migue en el diario en los últimos 30 días: cuántas preguntas hubo, cuántas supo contestar, la actividad por día y cada consulta, una por una.",
      },
      {
        pregunta: "¿Para qué sirve «Lo que no supimos contestar»?",
        respuesta:
          "Junta las preguntas que Migue no pudo responder, agrupadas por texto. Es la mejor pista de qué temas faltan en la edición.",
      },
      {
        pregunta: "¿Se guarda quién preguntó?",
        respuesta:
          "No. Se guarda la pregunta, cómo terminó y desde qué página se hizo, pero no quién la hizo.",
      },
    ],
  },

  suscripciones: {
    nombre: "Suscripciones",
    preguntas: [
      {
        pregunta: "¿Qué es esta lista?",
        respuesta:
          "Las personas que se anotaron para recibir el diario impreso, con nombre, edad, correo, dirección y fecha. Desde acá sólo se consulta: no se edita ni se borra.",
      },
      {
        pregunta: "¿Cómo bajo la lista?",
        respuesta:
          "Con «Bajar la lista en CSV». Cada descarga queda anotada en la auditoría, porque son datos personales de vecinos: bajala sólo cuando haga falta.",
      },
    ],
  },

  usuarios: {
    nombre: "Usuarios",
    preguntas: [
      {
        pregunta: "¿Cómo le doy permiso de administración a alguien?",
        respuesta:
          "Buscá a la persona y tocá «Hacer administradora». Tiene que haber ingresado al menos una vez con Ciudadano Digital para aparecer en la lista.",
      },
      {
        pregunta: "¿Qué pasa cuando bloqueo a alguien?",
        respuesta:
          "Deja de poder comentar y de entrar al panel desde su próximo pedido, y no puede abrir una sesión nueva. Si ya tenía una abierta, puede seguir leyendo hasta que se le venza. Se revierte con «Permitir de nuevo».",
      },
      {
        pregunta: "¿Por qué a alguien no le aparecen los botones?",
        respuesta:
          "Porque su rol viene de la configuración del sistema: la fila lo dice, y desde esta pantalla no se puede cambiar. Tampoco te podés bloquear a vos, ni dejar el diario sin ninguna persona que administre.",
      },
    ],
  },

  auditoria: {
    nombre: "Auditoría",
    preguntas: [
      {
        pregunta: "¿Qué se anota acá?",
        respuesta:
          "Cada cambio que se hace en el panel: qué se hizo, quién y cuándo. Se anota solo, y ningún renglón se puede borrar desde acá.",
      },
      {
        pregunta: "¿Por qué no aparece el texto de un comentario borrado?",
        respuesta:
          "Es a propósito: el registro no guarda el contenido de lo moderado. Guardar el texto de un comentario borrado sería conservar lo que se quiso sacar.",
      },
      {
        pregunta: "¿Cómo encuentro algo puntual?",
        respuesta:
          "Usá el buscador —busca en lo que pasó, en quién lo hizo y en el identificador— y los filtros por tipo. «Sólo lo que se llevó algo» deja a la vista los borrados, los bloqueos y las descargas del padrón.",
      },
    ],
  },
};

/** Para validar lo que llega del cliente. */
export function esPantallaDelPanel(valor: unknown): valor is PantallaDelPanel {
  return typeof valor === "string" && Object.hasOwn(AYUDA, valor);
}

/**
 * En qué pantalla está parado, por la ruta. Mismo criterio que la marca de la
 * barra lateral: el editor vive en `/admin/nota/…` y tiene sus propias dudas, y
 * todo lo que no se reconoce cae en Notas, que es la entrada del panel.
 */
export function pantallaDeRuta(ruta: string | null): PantallaDelPanel {
  const tramo = (ruta ?? "").split("/")[2] ?? "";
  if (tramo === "nota") return "editor";
  return esPantallaDelPanel(tramo) ? tramo : "notas";
}

/** Toda la ayuda en texto, para el modelo. */
export function guiaDelPanel(): string {
  return Object.values(AYUDA)
    .map(
      ({ nombre, preguntas }) =>
        `## Pantalla ${nombre}\n` +
        preguntas.map((p) => `- ${p.pregunta} ${p.respuesta}`).join("\n"),
    )
    .join("\n\n");
}
