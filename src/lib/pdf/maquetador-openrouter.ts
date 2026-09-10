import type { Consulta } from "./maquetador.ts";

/**
 * Cómo se le habla al modelo que maqueta, vía OpenRouter.
 *
 * Va aparte de `maquetador.ts` para que ese módulo siga siendo puro y se pueda
 * probar sin gastar una llamada, y aparte de `migue/openrouter.ts` porque son
 * dos usos con requisitos opuestos: Migue le contesta a un vecino que está
 * esperando —doce segundos de techo, cuatrocientos tokens, el modelo más barato
 * que sirva— y esto corre una vez por mes contra ocho páginas, sin nadie
 * mirando, y lo que importa es que no se equivoque.
 *
 * **El modelo por defecto no es el de Migue.** Esta tarea necesita mirar una
 * página A3 densa y devolver un reparto exacto de ciento treinta líneas; el
 * modelo barato que alcanza para responder una consulta no alcanza para eso. Y
 * el costo no es un argumento acá: son ocho llamadas por edición, una vez al
 * mes, contra las que Migue hace todos los días.
 */

/** El modelo que maqueta. Se cambia por entorno, sin tocar código: la idea es
 *  poder comparar dos sobre la misma edición y quedarse con el que acierte. */
const MODELO_POR_DEFECTO = "anthropic/claude-sonnet-5";

/**
 * La digitalización corre dentro de una Server Action de Vercel. No podemos
 * dejar que una página esperando al proveedor consuma todo el presupuesto de
 * la acción: si el proveedor no responde, la acción termina con el mensaje
 * genérico "An unexpected response was received from the server" aunque el
 * PDF ya haya sido procesado. Hay un segundo intento en `maquetador.ts`, por
 * eso dos timeouts de 15 s siguen dejando margen para guardar y revalidar.
 */
const TIMEOUT_MS = 15_000;

/** El reparto de una página de ciento treinta líneas es largo. Quedarse corto
 *  acá se ve como un JSON cortado a la mitad, que el control rechaza. */
const MAXIMO_TOKENS = 16_000;

export function hayModeloParaMaquetar(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function modeloQueMaqueta(): string {
  return process.env.MAQUETADOR_MODELO || MODELO_POR_DEFECTO;
}

/** Está apagado salvo que se lo prenda: el conversor tiene que seguir andando
 *  igual sin clave, y una carga no puede empezar a costar plata por sorpresa. */
export function maquetadorHabilitado(): boolean {
  return process.env.MAQUETADOR === "1" && hayModeloParaMaquetar();
}

export function consultaOpenRouter(): Consulta {
  return async ({ instrucciones, pedido, imagenBase64 }) => {
    const clave = process.env.OPENROUTER_API_KEY;
    if (!clave) throw new Error("falta OPENROUTER_API_KEY");

    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(
        process.env.OPENROUTER_URL ??
          "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          signal: control.signal,
          headers: {
            Authorization: `Bearer ${clave}`,
            "Content-Type": "application/json",
            "HTTP-Referer":
              process.env.SITIO_URL ?? "https://sanmiguelino.smt.gob.ar",
            "X-Title": "El Sanmiguelino maquetador",
          },
          body: JSON.stringify({
            model: modeloQueMaqueta(),
            max_tokens: MAXIMO_TOKENS,
            // Cero: acá no se quiere ninguna variación. Dos corridas sobre la
            // misma página tienen que repartir las líneas igual.
            temperature: 0,
            messages: [
              { role: "system", content: instrucciones },
              {
                role: "user",
                content: [
                  {
                    type: "image_url",
                    image_url: { url: `data:image/png;base64,${imagenBase64}` },
                  },
                  { type: "text", text: pedido },
                ],
              },
            ],
          }),
        },
      );

      if (!res.ok) {
        throw new Error(`OpenRouter respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
      }
      const datos = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const texto = datos.choices?.[0]?.message?.content;
      if (!texto) throw new Error("la respuesta vino vacía");
      return texto;
    } finally {
      clearTimeout(reloj);
    }
  };
}
