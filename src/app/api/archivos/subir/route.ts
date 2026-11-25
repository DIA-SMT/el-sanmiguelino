import { open, rm } from "node:fs/promises";
import { type NextRequest } from "next/server";
import {
  confirmarTemporal,
  leerFirmaDeSubida,
  nuevoTemporal,
} from "@/lib/archivos";

/**
 * Recibe un archivo del panel (una foto o el PDF del impreso) y lo deja en el
 * depósito, con el nombre que eligió el servidor.
 *
 * La llave es la firma de `?t=` (ver `lib/archivos.ts`): la emite una acción
 * del panel después de `requerirAdmin()`, vale diez minutos, para UNA clave,
 * con un tipo y un tope de bytes. Igual que la URL firmada que daba Supabase.
 *
 * El cuerpo se escribe a disco mientras llega, sin juntarlo en memoria: un
 * PDF de 50 MB no puede pasar entero por la RAM de un servidor compartido.
 * Si se pasa del tope, se corta y se borra. Esta ruta está fuera del proxy
 * (ver el `matcher` en `src/proxy.ts`), que si no copiaría el cuerpo entero.
 *
 * Después del PUT, el panel llama a la acción que confirma: ahí se miran los
 * bytes (`verificarFotoSubida` / `verificarPdfSubido`).
 */

// Un PDF grande por una conexión municipal tarda. nginx también tiene que
// esperar (proxy_read_timeout) y aceptar el tamaño (client_max_body_size).
export const maxDuration = 300;

export async function PUT(request: NextRequest) {
  const permiso = leerFirmaDeSubida(request.nextUrl.searchParams.get("t"));
  if (!permiso) {
    return Response.json({ error: "El permiso para subir venció o no es válido." }, { status: 403 });
  }
  const tipo = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (tipo !== permiso.mime) {
    return Response.json({ error: "El tipo del archivo no es el que se pidió." }, { status: 415 });
  }
  const declarado = Number(request.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > permiso.maximo) {
    return Response.json({ error: "El archivo es más grande de lo permitido." }, { status: 413 });
  }
  if (!request.body) return Response.json({ error: "No llegó ningún archivo." }, { status: 400 });

  const temporal = await nuevoTemporal();
  const salida = await open(temporal, "wx");
  let total = 0;
  try {
    const lector = request.body.getReader();
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      total += value.byteLength;
      if (total > permiso.maximo) {
        await lector.cancel().catch(() => {});
        throw Object.assign(new Error("grande"), { estado: 413 });
      }
      await salida.write(value);
    }
  } catch (e) {
    await salida.close().catch(() => {});
    await rm(temporal, { force: true });
    const estado = (e as { estado?: number }).estado ?? 400;
    return Response.json(
      { error: estado === 413 ? "El archivo es más grande de lo permitido." : "Se cortó la subida." },
      { status: estado },
    );
  }
  await salida.close();

  if (total === 0) {
    await rm(temporal, { force: true });
    return Response.json({ error: "El archivo está vacío." }, { status: 400 });
  }
  try {
    await confirmarTemporal(temporal, permiso.clave);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "No se pudo guardar." },
      { status: 409 },
    );
  }
  return new Response(null, { status: 200 });
}
