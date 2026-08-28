/** Entidades del diario. La persistencia real (Postgres + Prisma) se define
 *  con el equipo; mientras tanto los repos in-memory implementan estas formas. */

export interface Usuario {
  /** id del usuario en Cidituc */
  id: string;
  nombre: string;
}

export type BloqueNota =
  | { tipo: "parrafo"; texto: string }
  | { tipo: "subtitulo"; texto: string }
  | {
      tipo: "cita";
      texto: string;
      autor: string;
      cargo?: string;
      /** Retrato de quien habla, para el círculo del impreso. Ruta bajo
       *  /public. Opcional y sin default: sin foto el bloque igual es
       *  correcto, y poner la cara equivocada al lado de una declaración
       *  oficial es peor que no poner ninguna. */
      retrato?: string;
    }
  /** Frase del propio texto, promovida a destacado. No lleva comillas ni
   *  autor: no es una cita, es el redactor subrayando su propia idea. */
  | { tipo: "destacado"; texto: string }
  /** Recuadro de datos: un título y una lista de entradas, cada una con su
   *  encabezado en negrita. En el impreso va en un marco de esquinas
   *  redondeadas y en dos columnas. */
  | {
      tipo: "ficha";
      titulo: string;
      entradas: { lead: string; texto: string }[];
    };

export interface ImagenNota {
  /** epígrafe en itálica bajo la imagen */
  epigrafe: string;
  alt: string;
  /** ruta bajo /public (ej. "/notas/foto.jpg") o URL del blob store. Si no
   *  hay archivo todavía, se renderiza el placeholder editorial */
  src?: string;
}

/**
 * Lo que hace falta para LISTAR una nota: portada, secciones, búsqueda,
 * relacionadas, vista previa. Todo menos el cuerpo.
 *
 * La separación existe por una razón concreta: sin ella, mostrar "3 min de
 * lectura" en un listado obliga a traerse el cuerpo entero de cada nota sólo
 * para contar palabras. Con el mock eso es gratis; contra Postgres son ocho
 * documentos por request para no mostrar ninguno.
 */
export interface NotaResumen {
  slug: string;
  seccion: string;
  titulo: string;
  bajada: string;
  imagen?: ImagenNota;
  /** Derivado del cuerpo. Se calcula al ESCRIBIR, no al leer: es lo que
   *  permite que este resumen no necesite el cuerpo. */
  minutosLectura: number;
}

/** La nota entera, para la pantalla que efectivamente la muestra. */
export interface NotaCompleta extends NotaResumen {
  cuerpo: BloqueNota[];
  /** De qué edición es.
   *
   *  Existe por el archivo: una nota de agosto sigue siendo leíble cuando el
   *  diario ya va por septiembre, y su "Página 5 de 9" tiene que contarse
   *  sobre agosto. Sin esto, el foliado de una nota vieja se calculaba sobre la
   *  edición en la calle y decía cualquier cosa. */
  edicionSlug: string;
}

/** La cabecera de la edición, sin sus notas: mes, número, etiqueta. Es lo
 *  único que necesitan el masthead, el login y los pies. */
export interface EdicionResumen {
  slug: string;
  /** ej.: "Agosto de 2026" */
  mes: string;
  numero: number;
  anio: number;
  etiqueta?: string;
  /** De qué se trata el número: "Historia de San Miguel de Tucumán".
   *  Ausente en las ediciones viejas, que salieron con secciones. */
  tema?: string;
}

/**
 * La próxima edición, cuando ya está cargada y con fecha.
 *
 * Existe para Migue: "¿cuándo sale la próxima?" es la pregunta más obvia que
 * se le puede hacer a un mensual, y hasta ahora contestaba que eso no estaba
 * en la edición de agosto —que es cierto y no sirve para nada—.
 */
export interface ProximaEdicion {
  mes: string;
  numero: number;
  /** El instante de publicación, ya en UTC como lo guarda la base. */
  publicaEn: Date;
}

/** Nota como la necesita el buscador: el resumen más el texto plano del
 *  cuerpo. `textoPlano` es exactamente `cuerpo.map(textoDeBloque).join(" ")`,
 *  y tiene que seguir siéndolo: el resaltado de resultados corta el fragmento
 *  con índices sobre esa misma cadena. */
export interface NotaBuscable extends NotaResumen {
  textoPlano: string;
}

/**
 * La forma del archivo semilla (`src/lib/data/edicion-actual.ts`) y de lo que
 * carga el admin. Acá el cuerpo SÍ está y `minutosLectura` no, porque se
 * deriva. Fuera del repo nadie debería usar estos dos tipos.
 */
export interface NotaSemilla {
  slug: string;
  seccion: string;
  titulo: string;
  bajada: string;
  cuerpo: BloqueNota[];
  imagen?: ImagenNota;
}

/**
 * Lo que el panel manda al guardar una nota.
 *
 * Es `NotaSemilla` más el slug anterior, y no lleva `minutosLectura` ni
 * `textoPlano` a propósito: esos se derivan al escribir, con las funciones de
 * `src/lib/derivar`. Si el borrador los trajera, el panel podría mandar un
 * número que no corresponde al texto y nadie se enteraría.
 */
export interface NotaBorrador extends NotaSemilla {
  /**
   * A qué edición va.
   *
   * Ausente = la que esté en foco, o la publicada. Ese era el único
   * comportamiento posible antes, y no se veía por ningún lado: quien cargaba
   * una nota no tenía forma de saber a qué número iba a parar, ni de mandarla
   * a otro. Una nota de un recital de septiembre terminó publicada en agosto.
   *
   * En una nota que ya existe, cambiarlo la **mueve** de edición.
   */
  edicionSlug?: string;

  /** El slug con el que la nota estaba guardada. Ausente = nota nueva.
   *  Existe porque el slug es la clave: cambiarlo es mover la nota, no crear
   *  otra, y los comentarios tienen que seguirla. */
  slugOriginal?: string;
}

export interface EdicionSemilla extends EdicionResumen {
  notas: NotaSemilla[];
}

/** Un comentario oculto sigue existiendo: se conservan sus votos y queda el
 *  rastro de quién lo bajó. Nunca se borra. */
export type EstadoComentario = "publicado" | "oculto";

export interface Comentario {
  id: string;
  notaSlug: string;
  usuarioId: string;
  usuarioNombre: string;
  texto: string;
  fecha: string; // ISO
  likes: number;
  dislikes: number;
  /** voto del usuario que consulta: 1, -1 o null */
  miVoto: 1 | -1 | null;
  estado: EstadoComentario;
}

/** Comentario como lo ve la moderación: con el rastro de la baja. */
export interface ComentarioModerable extends Comentario {
  ocultadoPor?: string;
  ocultadoEn?: string; // ISO
  motivoBaja?: string;
}
