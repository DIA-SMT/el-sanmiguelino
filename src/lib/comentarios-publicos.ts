import { firmaPublica } from "@/lib/auth/cidituc/nombre";
import type { Comentario, ComentarioPublico } from "@/lib/types";

/**
 * La única puerta por la que un comentario sale hacia un lector: el listado de
 * la nota, la respuesta al publicar y la respuesta al votar. Se arma campo por
 * campo, a propósito: si mañana `Comentario` suma algo, no sale solo.
 */
export function aPublico(c: Comentario): ComentarioPublico {
  return {
    id: c.id,
    notaSlug: c.notaSlug,
    autor: firmaPublica(c.usuarioNombre),
    texto: c.texto,
    fecha: c.fecha,
    likes: c.likes,
    dislikes: c.dislikes,
    miVoto: c.miVoto,
  };
}
