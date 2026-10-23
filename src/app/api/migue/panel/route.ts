import { NextResponse, type NextRequest } from "next/server";
import { nombreDeDiario } from "@/lib/auth/cidituc/nombre";
import { conAdmin } from "@/lib/auth/dal";
import { esPantallaDelPanel } from "@/lib/migue/ayuda-panel";
import { migueTieneModelo, type Turno } from "@/lib/migue/openrouter";
import { preguntarSobreElPanel } from "@/lib/migue/panel";
import { contarConsultaAlModelo } from "@/lib/migue/tope";

/**
 * Migue del panel: POST { pregunta, pantalla, historial } → { respuesta }.
 *
 * Sólo para quien puede entrar al panel (`conAdmin`, que contesta 404 a
 * cualquier otro, igual que `/admin`). La guardia va acá y no confiando en que
 * el chat sólo se dibuja en el panel: una ruta de API se llama sin pasar por
 * ninguna pantalla.
 *
 * Sólo llegan acá las preguntas LIBRES ("Otra consulta"). Las preguntas de
 * cada pantalla traen su respuesta escrita y se contestan en el cliente sin
 * llamar a nadie: no cuestan nada y no pueden salir mal.
 *
 * **No se anota en `consultas_migue`**, a propósito: esa tabla es lo que
 * preguntan los vecinos, y alimenta los gráficos de la pantalla Migue y las
 * métricas que se agregan entre instancias. Mezclarle las consultas de la
 * redacción sobre cómo usar el panel le cambiaría el sentido a cada número.
 *
 * El tope por persona SÍ se cuenta, y es el mismo presupuesto que el del
 * diario: quien administra también es una persona que le pregunta al modelo,
 * y el tope es una protección de costos.
 */

const LARGO_MAXIMO = 500;

/** Lo que se contesta cuando el modelo no está o no respondió. No es un error
 *  de conexión: Migue sigue ahí, sólo que sin poder razonar la pregunta. */
const RESPALDO =
  "Esa no la tengo. Mirá las preguntas de esta pantalla, que tienen la respuesta escrita, o consultalo con quien administra el sistema.";

const SIN_TOPE =
  "Por esta hora ya hice muchas consultas. Mientras tanto, las preguntas de esta pantalla te las contesto igual.";

function historialValido(crudo: unknown): Turno[] {
  if (!Array.isArray(crudo)) return [];
  return crudo
    .filter(
      (t): t is Turno =>
        typeof t === "object" &&
        t !== null &&
        (t.rol === "usuario" || t.rol === "migue") &&
        typeof t.texto === "string",
    )
    .slice(-12)
    .map((t) => ({ rol: t.rol, texto: t.texto.slice(0, 1000) }));
}

export const POST = conAdmin(async (sesion, request: NextRequest) => {
  let body: { pregunta?: unknown; pantalla?: unknown; historial?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const pregunta =
    typeof body.pregunta === "string" ? body.pregunta.trim() : "";
  if (!pregunta || pregunta.length > LARGO_MAXIMO) {
    return NextResponse.json({ error: "Pregunta inválida" }, { status: 400 });
  }
  // Una pantalla que no se conoce no es un error de quien pregunta: el chat
  // pudo quedar viejo después de un despliegue. Se contesta como desde Notas.
  const pantalla = esPantallaDelPanel(body.pantalla) ? body.pantalla : "notas";

  if (!migueTieneModelo()) {
    return NextResponse.json({ respuesta: RESPALDO });
  }

  const tope = await contarConsultaAlModelo(sesion.usuario.id);
  if (!tope.permitido) {
    return NextResponse.json({ respuesta: SIN_TOPE });
  }

  const respuesta = await preguntarSobreElPanel({
    pregunta,
    pantalla,
    nombre: nombreDeDiario(sesion.usuario.nombre).split(" ")[0],
    historial: historialValido(body.historial),
  });

  return NextResponse.json({ respuesta: respuesta ?? RESPALDO });
});
