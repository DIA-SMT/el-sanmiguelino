import { NextResponse } from "next/server";
import { sesionActual } from "@/lib/auth/dal";

/**
 * "¿Quién soy?" — sólo fuera de producción.
 *
 * Existe para resolver un problema de arranque muy concreto: el rol de
 * administrador se otorga poniendo un `id_persona` en `CIDITUC_ADMINS`, y para
 * poner el propio hay que conocerlo primero. Las dos formas que había eran
 * malas: leer la salida del servidor —que no siempre es la terminal que uno
 * está mirando— o abrir las herramientas del navegador, copiar una cookie
 * `httpOnly` y decodificar el base64 a mano.
 *
 * Devuelve la sesión de **quien pregunta**, y nada más: no acepta parámetros, no
 * busca a nadie, no puede hablar de terceros. Aun así responde 404 en
 * producción, y no porque filtre algo —tu propia identidad no es un secreto para
 * vos— sino porque una ruta que allá no hace falta no se despliega.
 *
 * **No queda redundante cuando exista /admin/usuarios**, aunque la primera
 * versión de este comentario decía que sí. La tabla de roles va a nacer vacía y
 * el primer administrador se va a seguir poniendo en `CIDITUC_ADMINS`, así que
 * necesitar el propio `id_persona` sigue siendo igual de cierto. Se borra el día
 * que el panel pueda promover a alguien buscándolo por nombre.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const sesion = await sesionActual();
  if (!sesion) {
    return NextResponse.json(
      {
        error: "No hay sesión.",
        como: "Ingresá por http://localhost:3000/login y volvé a esta URL.",
      },
      { status: 401 },
    );
  }

  return NextResponse.json({
    id_persona: sesion.usuario.id,
    nombre: sesion.usuario.nombre,
    rol: sesion.rol,
    para_entrar_al_panel: [
      `CIDITUC_ADMINS=${sesion.usuario.id}`,
      "ADMIN_HABILITADO=1",
    ],
    nota: "Pegá esas dos líneas en .env.local y reiniciá el dev server.",
  });
}
