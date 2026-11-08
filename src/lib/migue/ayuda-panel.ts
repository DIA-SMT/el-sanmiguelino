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
  | "newsletter"
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
        pregunta: "¿Cómo edito las notas de otra edición?",
        respuesta:
          "Arriba de la lista, en «Edición», elegí la que quieras: la que se está armando o una anterior. La lista pasa a mostrar sus notas y cada una se edita como siempre. Mientras tanto el diario también te muestra esa edición a vos (a los lectores no). Para volver, elegí «La que está en la calle».",
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

  newsletter: {
    nombre: "Newsletter",
    preguntas: [
      {
        pregunta: "¿Cómo armo un newsletter?",
        respuesta:
          "Tocá «Nuevo newsletter». Escribí el asunto y, en «Agregar notas del diario», elegí primero la edición y después las notas (o «Todas» para buscar en todas las ediciones). Ordenalas con las flechas. A la derecha ves el correo tal cual llega, en «Compu» o «Celular». Tocá «Guardar borrador» para guardarlo.",
      },
      {
        pregunta: "¿Cómo lo mando a los suscriptores?",
        respuesta:
          "Abajo del editor, en «Enviar a la lista», elegí «Ahora» o una fecha y hora (de Tucumán) y confirmá. Sale lo que está guardado. Desde ese momento ya no se edita: si lo programaste, hasta la hora elegida podés tocar «Cancelar y volver a editar». Mientras el aviso de arriba diga que el envío es de práctica, recorre la lista pero no le llega a nadie.",
      },
      {
        pregunta: "¿Cómo pongo un video de YouTube u otro enlace?",
        respuesta:
          "En «Notas», tocá «Agregar un bloque con enlace». Pegá la dirección, escribí un título, un texto corto y el texto del botón (por ejemplo «Ver la entrevista»). Si es un video de YouTube, la foto se pone sola; si no, podés subir una con «Subir una foto». Se ordena con las flechas, igual que las notas.",
      },
      {
        pregunta: "¿Por qué no puedo enviar la prueba?",
        respuesta:
          "Porque el newsletter todavía está vacío. Escribile una introducción, o agregale al menos una nota del diario o un bloque con enlace, y el botón «Enviar prueba» se habilita. Un newsletter puede ser sólo texto, por ejemplo un aviso.",
      },
      {
        pregunta: "¿Cómo uso «Armar con IA»?",
        respuesta:
          "Arriba del editor, elegí la edición y tocá «Proponer con IA». Elige de 4 a 6 notas y escribe el asunto, la introducción, el texto de cada nota y el cierre, sólo con lo que dicen esas notas. Si escribe un dato que no está en las notas, ese texto se descarta y te avisa. No se guarda ni se manda solo: leelo, cambiá lo que quieras y tocá «Guardar borrador».",
      },
      {
        pregunta: "¿Qué muestran los números de «Cómo viene»?",
        respuesta:
          "Cuánta gente se anotó, confirmó y se dio de baja en los últimos 30 días, y de cada envío a cuántos les llegó, a cuántos no y cuántos se dieron de baja con el enlace del correo en la semana siguiente. No se mide quién abre los correos ni en qué hace clic.",
      },
      {
        pregunta: "¿Cuánto tarda en llegarle a todos?",
        respuesta:
          "Sale de a tandas, unas 700 personas por hora, para que el correo del diario no quede marcado como spam. En la pantalla del envío ves cuántos van, a quiénes no les llegó y por qué. Si un envío falla por un problema pasajero, se reintenta solo.",
      },
      {
        pregunta: "¿Puedo frenar un envío que ya empezó?",
        respuesta:
          "Sí, con «Detener el envío». A quien ya le llegó, le llegó; al resto no le llega. No se puede retomar: para mandarlo a los que faltaron habría que armar uno nuevo.",
      },
      {
        pregunta: "¿Cómo me mando una prueba?",
        respuesta:
          "Escribí tu correo en «Mandarme una prueba a» y tocá «Enviar prueba». Sale desde sanmiguelino@smt.gob.ar con «[Prueba]» en el asunto, y queda anotada en «Correos de prueba».",
      },
      {
        pregunta: "¿Qué texto aparece debajo de cada nota?",
        respuesta:
          "La bajada de la nota. Si querés otro, escribilo en «Texto en el correo» de esa nota. Las notas se toman como estén al momento de enviar: si corregís un título en el diario, sale corregido.",
      },
      {
        pregunta: "¿Quiénes lo recibirían?",
        respuesta:
          "Sólo quienes confirmaron su correo con el enlace que les llega al anotarse. Los que figuran como «Falta que confirmen» no lo reciben hasta que confirmen. La lista se toma en el momento en que el newsletter empieza a salir.",
      },
    ],
  },

  suscripciones: {
    nombre: "Suscripciones",
    preguntas: [
      {
        pregunta: "¿Qué es esta lista?",
        respuesta:
          "Las personas que se anotaron al newsletter, con nombre, correo, estado y fecha. «Confirmada» quiere decir que confirmó su correo y lo recibe; «Falta confirmar», que todavía no; «De baja», que pidió no recibirlo más. Las que se habían anotado para el diario en papel siguen en la lista, sin confirmar.",
      },
      {
        pregunta: "¿Cómo doy de baja a alguien?",
        respuesta:
          "Con «Dar de baja» en su fila, cuando lo pide por teléfono o en persona. Queda anotado en la auditoría. Desde acá no se puede anotar a nadie: cada persona se anota desde el diario y confirma con su correo.",
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
