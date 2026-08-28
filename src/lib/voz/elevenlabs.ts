import "server-only";

/**
 * La voz de Migue, vía ElevenLabs.
 *
 * Se habla la API con `fetch` y no con el SDK, por lo mismo que
 * `src/lib/migue/openrouter.ts` y `src/lib/storage.ts`: es una sola llamada, y
 * lo que no está instalado no se importa por accidente desde un componente
 * cliente con la clave adentro.
 *
 * **Nada de este archivo puede correr en el navegador.** El `import
 * "server-only"` de arriba no es decorativo: si alguna vez alguien importa
 * este módulo desde un componente cliente, el BUILD se rompe. Sin eso, el
 * mismo error compila igual y publica la clave de ElevenLabs —que es plata del
 * municipio— en un bundle que baja cualquiera.
 *
 * **Esto es el lujo, no el servicio.** Cuando algo acá no sale —falta la
 * clave, falta el Voice ID, ElevenLabs tarda o devuelve cualquier cosa— el
 * llamador se cae a `speechSynthesis` del navegador (`src/lib/voz/usar-voz.ts`)
 * y el vecino escucha igual, con otra voz. Un proveedor caído no puede dejar a
 * Migue mudo.
 */

/**
 * El Voice ID de Migue en ElevenLabs.
 *
 * Va en código y no en `.env` a propósito: no es un secreto —identifica una
 * voz, no autoriza nada— y es una decisión editorial, no de infraestructura.
 * Que la voz del diario sea la misma en cada entorno y quede en el historial
 * de git vale más que poder cambiarla sin desplegar.
 *
 * Vacío es el estado seguro por omisión: `vozDeMigueDisponible()` devuelve
 * false, no se llama a nadie y no se gasta un centavo. Tener el id **no**
 * alcanza: sin `ELEVENLABS_API_KEY` sigue ganando la voz del navegador.
 */
export const VOZ_DE_MIGUE_ID: string = "QK4xDwo9ESPHA4JNUpX3";

/**
 * El modelo.
 *
 * `eleven_multilingual_v2` y no `eleven_flash_v2_5` porque acá la calidad se
 * paga una sola vez: el audio se genera cuando alguien lo pide, se guarda y se
 * reutiliza para siempre (ver `claveDeAudio` en `src/lib/storage.ts`). Flash
 * cuesta la mitad y responde más rápido, pero eso importa cuando se genera en
 * cada reproducción; acá el ahorro es de una vez y el defecto de pronunciación
 * queda cacheado para todos los que escuchen esa nota.
 *
 * Y suena una voz que dice ser del municipio: en español rioplatense, con
 * nombres de calles y de barrios, multilingual_v2 se equivoca bastante menos.
 *
 * Está acá arriba para que cambiar de idea sea tocar una línea.
 */
const MODELO = "eleven_multilingual_v2";

/**
 * El formato del audio. Es el que ElevenLabs usa por defecto, pero se manda
 * explícito: el resto del camino —la extensión del archivo en el bucket, el
 * `content-type` con que se sirve, el `<audio>` que lo reproduce— da por
 * sentado que esto es un mp3. Si algún día cambia el defecto del proveedor,
 * que no cambie el nuestro por sorpresa.
 */
const FORMATO = "mp3_44100_128";

/**
 * Cuánto texto se le manda como máximo.
 *
 * ElevenLabs cobra por carácter, así que esto es control de gasto, no
 * validación: lo que llega ya viene armado por `textoDeResumenDeNota` y son
 * unos 250 caracteres. El tope está para el día en que alguien pegue el cuerpo
 * entero de una nota —o para un bug que lo haga solo— y eso se convierta en
 * una factura.
 *
 * Mil deja lugar de sobra para una bajada larga o para la tapa, que suma
 * cabecera y tema, sin dejar pasar un texto de otro orden de magnitud.
 *
 * **Si se pasa, NO se corta: se devuelve null.** Cortar generaría un audio que
 * termina en la mitad de una frase, y ese audio se guarda y se reutiliza para
 * siempre: el error queda congelado y nadie se entera hasta que un vecino lo
 * escucha. Devolviendo null se cae a la voz del navegador, que lee el texto
 * completo. Peor voz, pero entera.
 */
const MAXIMO_CARACTERES = 1000;

/**
 * Cuánto se espera antes de cortar.
 *
 * Para ~250 caracteres la generación son unos pocos segundos; quince aguantan
 * un arranque en frío del proveedor sin que el botón parezca roto. Es más
 * generoso que los doce del chat porque esta espera se paga UNA sola vez —
 * después el audio queda guardado y nadie más la sufre—, y más corto que la
 * paciencia de alguien mirando un botón que no hace nada.
 *
 * Pasado ese tiempo se corta y se lee con la voz del navegador.
 */
const TIMEOUT_MS = 15_000;

/**
 * El piso de bytes para creerle a la respuesta.
 *
 * A 128 kbps, medio segundo de audio son más de 8 KB. Cualquier cosa por
 * debajo de un kilobyte no es un mp3: es un cuerpo de error, o nada.
 */
const MINIMO_BYTES = 1024;

/**
 * La clave, tratando la cadena vacía como ausente.
 *
 * Es la misma trampa que documenta `src/lib/migue/tope.ts`: en un `.env` una
 * variable declarada y sin valor llega como `""`, no como `undefined`, así que
 * `??` no la ataja. Y `.env.example` se copia con TODAS las variables
 * presentes y vacías, o sea que el caso normal de alguien que arranca el
 * proyecto es exactamente éste. Sin el `trim()`, además, un espacio pegado sin
 * querer al copiar la clave pasaría como clave válida y volvería un 401.
 */
function clave(): string | null {
  const valor = process.env.ELEVENLABS_API_KEY?.trim();
  return valor ? valor : null;
}

/**
 * ¿Se puede generar audio con la voz de Migue?
 *
 * Hacen falta las dos cosas: el Voice ID acá en el código y la clave en el
 * entorno. Lo consultan la ruta `/api/voz` —para contestar `{ url: null }` sin
 * llamar a nadie— y cualquiera que quiera saber si ofrecer la voz buena.
 */
export function vozDeMigueDisponible(): boolean {
  return VOZ_DE_MIGUE_ID.trim().length > 0 && clave() !== null;
}

/**
 * Genera el mp3 de `texto` y devuelve sus bytes.
 *
 * **Nunca tira.** Devuelve `null` y listo, y el llamador se cae a la voz del
 * navegador. Es a propósito y no es pereza: una excepción obliga a cada
 * llamador a acordarse de envolverlo en un try, y al primero que se olvide la
 * caída de ElevenLabs se le convierte en un 500 en la cara del vecino. Acá el
 * fracaso no es excepcional —la clave puede faltar, la red se cae, el
 * proveedor se queda sin crédito— y hay una salida buena para todos los casos,
 * así que el "no se pudo" es un valor de retorno normal y no un error.
 *
 * Por eso también los motivos se distinguen sólo en el log de desarrollo: para
 * quien llama, todos los "no" son el mismo "no".
 */
export async function generarAudio(texto: string): Promise<Uint8Array | null> {
  // Se ata la clave a una variable en vez de mirar sólo
  // `vozDeMigueDisponible()`: así no hay forma de llegar al fetch con una
  // clave vacía si alguien alguna vez toca esa condición.
  const xiApiKey = clave();
  const voz = VOZ_DE_MIGUE_ID.trim();
  if (!xiApiKey || !voz) return null;

  const limpio = texto.trim();
  if (!limpio) return null;

  if (limpio.length > MAXIMO_CARACTERES) {
    // Ver MAXIMO_CARACTERES: cortar dejaría un audio mutilado guardado para
    // siempre. Se avisa fuerte en desarrollo porque, si esto pasa, lo que está
    // mal es quien armó el texto.
    avisar(
      `el texto tiene ${limpio.length} caracteres y el tope es ${MAXIMO_CARACTERES}: no se genera audio`,
    );
    return null;
  }

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voz)}?output_format=${FORMATO}`,
      {
        method: "POST",
        signal: control.signal,
        headers: {
          "xi-api-key": xiApiKey,
          "Content-Type": "application/json",
          // Sin esto, ante un error el proveedor puede contestar JSON; pedir
          // audio explícitamente deja el content-type como señal confiable.
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: limpio,
          model_id: MODELO,
          voice_settings: {
            // Alta a propósito: es la voz de una publicación oficial leyendo
            // un titular, no una actuación. Con la estabilidad baja el modelo
            // se toma libertades de entonación y dos notas seguidas no suenan
            // a la misma persona.
            stability: 0.5,
            // Que se parezca a la voz elegida. Más arriba empieza a arrastrar
            // los ruidos de la grabación original.
            similarity_boost: 0.75,
          },
        }),
      },
    );

    if (!res.ok) {
      // El cuerpo del error dice cosas útiles y distintas —cuota agotada,
      // voice_id inexistente, clave sin permiso—, y sin leerlo esto se depura
      // a ciegas. Recortado, y NUNCA la clave ni un header: el cuerpo de
      // ElevenLabs no la contiene, los headers del pedido sí.
      avisar(
        `ElevenLabs respondió ${res.status}: ${(await res.text()).slice(0, 200)}`,
      );
      return null;
    }

    // Un 200 no alcanza. Hay que confirmar que esto es audio de verdad y no un
    // JSON de error con status 200 —pasa— ni un cuerpo vacío. Se miran las dos
    // cosas: el content-type, que ataja el JSON, y el tamaño, que ataja el
    // vacío con el content-type correcto.
    //
    // No se va más allá (leer la cabecera del mp3, contar frames) a propósito:
    // acá un falso negativo no es gratis, porque significa no guardar nada y
    // volver a pagar la generación en cada pedido. Estas dos señales cubren
    // las formas en que esto falla de verdad.
    const tipo = res.headers.get("content-type") ?? "";
    if (!tipo.startsWith("audio/")) {
      avisar(`ElevenLabs devolvió 200 pero con content-type "${tipo}"`);
      return null;
    }

    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length < MINIMO_BYTES) {
      avisar(`ElevenLabs devolvió sólo ${bytes.length} bytes de audio`);
      return null;
    }

    return bytes;
  } catch (e) {
    // Cae acá el timeout (el abort llega como excepción), la red caída y el
    // DNS. Todos terminan igual: sin audio, y Migue lee con la voz del
    // navegador.
    avisar(`no se pudo hablar con ElevenLabs: ${e}`);
    return null;
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * Avisa en desarrollo, mudo en producción.
 *
 * Mismo criterio que `registrarConsulta` en `src/lib/repos/migue.ts`: en
 * producción el fracaso ya tiene salida —la voz del navegador— y no vale
 * ensuciar los logs con algo que no rompe nada; en desarrollo sí, porque si no
 * la voz buena puede estar apagada durante semanas sin que nadie lo note. El
 * síntoma es que "anda igual", que es el peor de todos.
 */
function avisar(mensaje: string): void {
  if (process.env.NODE_ENV !== "production") {
    console.warn("[voz]", mensaje);
  }
}
