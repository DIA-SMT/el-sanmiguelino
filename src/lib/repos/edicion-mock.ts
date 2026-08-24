import type { EdicionRepo } from "@/lib/repos/edicion";
import { edicionActual } from "@/lib/data/edicion-actual";
import { minutosDeLectura } from "@/lib/utils";
import type {
  NotaBuscable,
  NotaCompleta,
  NotaResumen,
  NotaSemilla,
} from "@/lib/types";

/**
 * Motor en memoria: proyecta la edición hardcodeada de
 * `src/lib/data/edicion-actual.ts`.
 *
 * **Este es el único archivo de la app que puede importar `edicionActual`.**
 * Es el portón de la migración: mientras `git grep edicionActual` no devuelva
 * nada fuera de acá, la frontera está bien puesta y cambiar de motor es
 * cambiar una línea en `edicion.ts`.
 *
 * El archivo de datos se queda en el árbol después de que exista Supabase: es
 * la semilla con la que se carga la base la primera vez.
 *
 * Los campos derivados (`minutosLectura`, `textoPlano`) se calculan acá al
 * proyectar. Contra la base van a ser columnas escritas por el admin al
 * guardar; el contrato hacia afuera no cambia.
 */

function textoPlanoDe(nota: NotaSemilla): string {
  return nota.cuerpo.map((b) => b.texto).join(" ");
}

function aResumen(nota: NotaSemilla): NotaResumen {
  return {
    slug: nota.slug,
    seccion: nota.seccion,
    titulo: nota.titulo,
    bajada: nota.bajada,
    imagen: nota.imagen,
    minutosLectura: minutosDeLectura(nota.cuerpo),
  };
}

function aCompleta(nota: NotaSemilla): NotaCompleta {
  return { ...aResumen(nota), cuerpo: nota.cuerpo };
}

function aBuscable(nota: NotaSemilla): NotaBuscable {
  return { ...aResumen(nota), textoPlano: textoPlanoDe(nota) };
}

export const edicionMockRepo: EdicionRepo = {
  async resumen() {
    const { slug, mes, numero, anio, etiqueta } = edicionActual;
    return { slug, mes, numero, anio, etiqueta };
  },

  async indice() {
    return edicionActual.notas.map(aResumen);
  },

  async nota(slug) {
    const encontrada = edicionActual.notas.find((n) => n.slug === slug);
    return encontrada ? aCompleta(encontrada) : null;
  },

  async completas(slugs) {
    // Se respeta el orden pedido, no el de la edición: quien pide
    // ["b", "a"] espera recibirlas así.
    return slugs
      .map((slug) => edicionActual.notas.find((n) => n.slug === slug))
      .filter((n): n is NotaSemilla => Boolean(n))
      .map(aCompleta);
  },

  async buscables() {
    return edicionActual.notas.map(aBuscable);
  },
};
