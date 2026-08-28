"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { enOraciones } from "@/lib/voz/texto-para-escuchar";

/**
 * La voz del navegador, con todas sus mañas.
 *
 * La síntesis la hace el sistema operativo del lector: no sale nada del
 * dispositivo, no hay endpoint, no hay costo y no queda registro de quién
 * escuchó qué. Eso mantiene la postura de privacidad que el esquema ya defiende
 * para las consultas de Migue.
 *
 * A cambio, `speechSynthesis` es una API vieja, global al documento y con
 * comportamiento distinto en cada navegador. Las reglas de este archivo salieron
 * de esas diferencias y ninguna se ve leyendo el diff. Están comentadas de a
 * una: si alguna parece de más, es porque está funcionando.
 */

/**
 * **La voz de Migue.** Poné acá el nombre de la voz elegida y se prefiere sobre
 * cualquier otra, siempre que el dispositivo la tenga instalada.
 *
 * Es una lista y no un solo nombre porque la misma voz se llama distinto según
 * el sistema: la misma locutora es "Microsoft Elena Desktop" en Windows,
 * "Elena" en macOS y "es-us-x-sfb-network" en Android. Se comparan en minúscula
 * y por coincidencia parcial, así que alcanza con poner el pedazo distintivo.
 *
 * Vacía, Migue usa la mejor voz en español que encuentre según `PRIORIDAD`. Ese
 * es el respaldo y tiene que seguir existiendo igual: la voz elegida puede no
 * estar instalada en el teléfono del lector, y ahí lo correcto es hablar con
 * otra voz en español y no quedarse mudo.
 */
export const VOZ_DE_MIGUE: string[] = [];

/**
 * Qué voz se prefiere, de mejor a peor, cuando no hay una elegida.
 *
 * Rioplatense primero: una voz peninsular leyendo "San Miguel de Tucumán" se
 * entiende, pero suena a otro país leyendo el diario de éste.
 */
const PRIORIDAD = [
  "es-ar",
  "es-419",
  "es-uy",
  "es-cl",
  "es-py",
  "es-bo",
  "es-mx",
  "es-us",
  "es-es",
];

function vocesEnEspanol(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith("es"));
}

/**
 * Elige la mejor voz disponible en español, o `null` si no hay ninguna.
 *
 * Dentro del mismo idioma se prefiere `localService`. No es por velocidad: las
 * voces "Google español" de Chrome de escritorio se sintetizan **en el
 * servidor**, así que sin conexión no suenan y a veces ni siquiera tiran error
 * — el botón se aprieta y no pasa nada.
 */
function mejorVoz(): SpeechSynthesisVoice | null {
  const voces = vocesEnEspanol();
  if (voces.length === 0) return null;

  // La voz elegida para Migue gana, si está. Se compara por pedazo del nombre:
  // ver el comentario de VOZ_DE_MIGUE.
  const elegida = voces.find((v) => {
    const nombre = v.name.toLowerCase();
    return VOZ_DE_MIGUE.some((buscada) =>
      nombre.includes(buscada.toLowerCase().trim()),
    );
  });
  if (elegida) return elegida;

  const puntaje = (v: SpeechSynthesisVoice) => {
    const lang = v.lang.toLowerCase().replace("_", "-");
    const i = PRIORIDAD.indexOf(lang);
    return (i === -1 ? PRIORIDAD.length : i) * 2 + (v.localService ? 0 : 1);
  };

  return [...voces].sort((a, b) => puntaje(a) - puntaje(b))[0] ?? null;
}

/**
 * Se suscribe a la llegada de las voces.
 *
 * En Chrome `getVoices()` devuelve un array VACÍO la primera vez y la lista se
 * llena un instante después avisando por `voiceschanged`. Sin esta suscripción
 * el botón nunca aparecería en Chrome, que es el navegador de la mayoría.
 */
function suscribirAVoces(alCambiar: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return () => {};
  }
  window.speechSynthesis.addEventListener("voiceschanged", alCambiar);
  return () =>
    window.speechSynthesis.removeEventListener("voiceschanged", alCambiar);
}

/**
 * El identificador de la voz elegida, o `""` si no hay voz en español.
 *
 * **Devuelve el `voiceURI` y no el objeto `SpeechSynthesisVoice`, a propósito.**
 * `getVoices()` puede devolver instancias nuevas en cada llamada; un snapshot
 * con identidad nueva cada vez mete a `useSyncExternalStore` en un bucle
 * infinito de renders. Una cadena se compara por valor y eso no pasa.
 *
 * El snapshot del servidor es `""`: en el server no hay `speechSynthesis`, y
 * decirlo explícitamente es lo que evita el desajuste de hidratación. Es el
 * mismo idioma que usan `CompartirNota` y el toggle de tema.
 */
export function useVozEnEspanol(): string {
  return useSyncExternalStore(
    suscribirAVoces,
    () => mejorVoz()?.voiceURI ?? "",
    () => "",
  );
}

/**
 * De dónde sacar el mp3 con la voz de Migue, cuando existe.
 *
 * **Acá no viaja el texto, y es a propósito.** El cliente dice QUÉ quiere
 * escuchar y el servidor deriva el texto de la base con las mismas funciones
 * que usa la página. Si el texto lo mandara el navegador, cualquiera podría
 * hacerle decir cualquier cosa a la voz oficial del municipio —y encima
 * pagarla.
 */
export interface FuenteDeAudio {
  que: "nota" | "tapa";
  /** El slug de la nota. Sobra cuando `que` es "tapa". */
  slug?: string;
}

/**
 * Un wav mudo de 44 bytes: cabecera RIFF y cero muestras.
 *
 * Es la llave del desbloqueo de iOS que está explicado adentro de `leer()`.
 * Va acá arriba porque es un dato, no una decisión, y para que nadie lo
 * confunda con el audio de verdad.
 */
const SILENCIO =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

export interface LecturaEnVoz {
  /** Hay voz en español instalada. Si es `false`, el control no se dibuja. */
  disponible: boolean;
  leyendo: boolean;
  /**
   * La lectura ya arrancó pero todavía no suena: se está generando o bajando
   * el mp3. **No es un tercer estado de la lectura**, es un detalle de
   * `leyendo`: mientras esto es `true`, `leyendo` también lo es y `detener()`
   * corta igual. Existe sólo para que el control pueda decir algo y el lector
   * no crea que su click se perdió.
   */
  preparando: boolean;
  /**
   * Arranca la lectura. **Tiene que llamarse desde el `onClick`, sin `await`
   * en el medio.** Ver el comentario de adentro.
   *
   * Con `fuente`, primero pide el mp3 de la voz de Migue a `/api/voz`; si no
   * hay, cae a la voz del navegador con el mismo texto. Sin `fuente`, habla el
   * navegador y listo, igual que siempre.
   */
  leer: (texto: string, fuente?: FuenteDeAudio) => void;
  /**
   * Corta la lectura, venga del mp3 o del navegador, y también la que todavía
   * se está generando. Quien aprieta Parar no sabe cuál de las dos suena.
   *
   * **Corta la del documento, no sólo la de esta instancia**: si lo que suena
   * lo largó el otro control de la pantalla, se corta igual y se le avisa.
   * Quien aprieta Parar quiere silencio, no quiere saber quién lo largó.
   */
  detener: () => void;
}

/** Cuánto se espera a que la voz arranque antes de dar la lectura por perdida. */
const GRACIA_DE_ARRANQUE_MS = 6000;

/**
 * Techo del pedido a `/api/voz`, del lado del cliente.
 *
 * Es más grande que el corte de 8s que el servidor le pone a ElevenLabs
 * a propósito: ese corte cubre al proveedor, éste cubre el tramo
 * navegador-servidor, y tienen que poder pasar los dos en orden. Sin este
 * techo un `fetch` que se cuelga sin cortar —túnel, portal cautivo, 3G
 * muerta— no rechaza hasta el vencimiento del navegador, que en Chrome son
 * ~300 segundos: cinco minutos de "Preparando" y `aria-pressed` en true.
 */
const TECHO_DEL_PEDIDO_MS = 10_000;

/**
 * Techo entre que el mp3 tiene url y que efectivamente suena.
 *
 * Un stream que se traba a mitad de la bajada no dispara `playing` ni
 * `error`: el elemento se queda esperando callado y para siempre. El vigía no
 * lo cubre porque mientras `preparando` es true retorna temprano, así que sin
 * este reloj no hay nada que destrabe el botón.
 */
const TECHO_DE_ARRANQUE_DEL_MP3_MS = 8000;

/**
 * **El mp3 que suena en el documento, sea de la instancia que sea.**
 *
 * `speechSynthesis` es global al documento: su `cancel()` calla cualquier
 * lectura, venga de donde venga. El elemento `Audio` no lo es, y hay DOS
 * instancias de `useLecturaEnVoz()` montadas a la vez en /nota/[slug] —el
 * MigueChat del layout y el BotonEscuchar de la nota—. Con el elemento
 * guardado sólo en el ref de cada instancia pasaba esto: con el mp3 de Migue
 * sonando se apretaba "Escuchar el resumen", el `detener()` del botón hacía
 * `cancel()` (global, pero no había síntesis) y miraba SU ref, que era null;
 * no cortaba nada y arrancaba una segunda lectura. Dos voces encima de la
 * misma nota, y el único control que cortaba ese mp3 era el "Parar" de la
 * cabecera del chat, que podía estar detrás del chat cerrado. Al revés era
 * idéntico.
 *
 * Esta variable de módulo es exactamente lo que `speechSynthesis` da gratis y
 * el `Audio` no: un solo lugar donde mirar para callar lo que esté sonando.
 */
let audioActivo: HTMLAudioElement | null = null;

/**
 * Los que quieren enterarse de que les callaron el audio.
 *
 * Cortarle el elemento a otra instancia no le apaga el estado: quedaría
 * diciendo "Detener", con `aria-pressed` en true, sin nada que escuchar. Por
 * eso el corte avisa y cada instancia se reconoce por identidad del elemento.
 *
 * Es un `Set` de funciones y no un evento del DOM ni un store de React porque
 * son dos suscriptores como mucho, viven lo que vive el módulo, y el aviso
 * tiene que llegar en el MISMO tick que el corte: si llegara un tick después,
 * la instancia que corta ya arrancó su propia lectura y el aviso tardío le
 * apagaría el estado a ella.
 */
const suscriptores = new Set<(audio: HTMLAudioElement) => void>();

/** Apaga un elemento de audio y lo desmaneja, sin avisarle a nadie. */
function soltarAudio(audio: HTMLAudioElement | null): void {
  if (!audio) return;
  // Los manejadores se sacan antes de tocar el elemento: bajarle la fuente
  // dispara `emptied` y, en algunos navegadores, `error`, y sin esto ese error
  // se leería como "el mp3 falló" y caeríamos a la voz del sistema justo
  // cuando el lector pidió silencio.
  audio.onended = null;
  audio.onerror = null;
  audio.onplaying = null;
  audio.pause();
  // Sacarle el src corta la descarga: sin esto el navegador sigue bajando un
  // mp3 que ya nadie va a escuchar.
  audio.removeAttribute("src");
  audio.load();
  if (audioActivo === audio) audioActivo = null;
}

/**
 * Calla el mp3 que esté sonando en el documento, sea de quien sea, y le avisa
 * a su dueño. Es la mitad `Audio` de lo que `speechSynthesis.cancel()` hace
 * solo para la síntesis.
 */
function callarElAudioDelDocumento(): void {
  const audio = audioActivo;
  if (!audio) return;
  soltarAudio(audio);
  // Sobre una copia: un suscriptor puede darse de baja mientras se le avisa.
  for (const avisar of [...suscriptores]) avisar(audio);
}

/**
 * Leer un texto en voz alta, y poder pararlo.
 *
 * Hay dos motores atrás de esto: el mp3 con la voz de Migue —que se pide a
 * `/api/voz` y sólo existe si alguien ya lo generó o si el proveedor contesta—
 * y `speechSynthesis`, que es el respaldo y **nunca se apaga**. Un proveedor
 * caído no puede dejar a Migue mudo en producción.
 *
 * Para afuera son uno solo: `leyendo` es "hay una lectura en curso", venga de
 * donde venga, y `detener()` la corta. El que aprieta Parar no sabe ni tiene
 * por qué saber cuál de los dos está sonando.
 *
 * El estado vuelve a "quieto" por seis caminos distintos, y los seis hacen
 * falta. Ver cada uno abajo: el `onend`/`onerror` de la síntesis, el `onended`
 * del mp3, el vigía, los dos relojes del camino del mp3, los tres cortes, y el
 * aviso de que otra instancia calló este audio.
 */
export function useLecturaEnVoz(): LecturaEnVoz {
  const vozURI = useVozEnEspanol();
  const [leyendo, setLeyendo] = useState(false);
  const [preparando, setPreparando] = useState(false);
  /** El instante en que se apretó, para la gracia de arranque del vigía. */
  const arranqueRef = useRef(0);
  /** Si la voz llegó a sonar alguna vez en esta lectura. */
  const sonoRef = useRef(false);
  /** El elemento del mp3 mientras esta lectura va por ahí. `null` quiere decir
   *  que manda el navegador, y el vigía lo lee para saber a quién vigilar. */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** Para cortar el pedido a `/api/voz` que quedó en el aire. */
  const pedidoRef = useRef<AbortController | null>(null);
  /**
   * El reloj de esta lectura: primero le pone techo al pedido y después al
   * arranque del mp3. Alcanza con uno solo porque las dos etapas no se pisan
   * —el segundo se arma justo cuando el primero ya no hace falta— y así hay
   * un único lugar del que acordarse de limpiar.
   */
  const relojRef = useRef<number | null>(null);
  /**
   * Qué número de lectura es la actual.
   *
   * Es el guard contra el bug clásico de esto: apretar Parar MIENTRAS se
   * genera el audio y que tres segundos después Migue arranque a hablar solo.
   * `abort()` no alcanza —entre que el fetch resolvió y que corre el `await`
   * de abajo hay un tick en el que abortar ya no cancela nada—, así que cada
   * callback compara contra este número y la lectura vieja se calla sola.
   */
  const turnoRef = useRef(0);

  const pararReloj = useCallback(() => {
    if (relojRef.current !== null) {
      window.clearTimeout(relojRef.current);
      relojRef.current = null;
    }
  }, []);

  const armarReloj = useCallback(
    (ms: number, quePasa: () => void) => {
      pararReloj();
      relojRef.current = window.setTimeout(quePasa, ms);
    },
    [pararReloj],
  );

  /**
   * Corta SÓLO la lectura de esta instancia y deja en paz el mp3 de la otra.
   *
   * Existe aparte de `detener()` por el desmontaje: al pasar de hoja se
   * desmonta el BotonEscuchar, y si ese desmontaje se llevara puesto el mp3
   * del chat rompería la decisión —ya tomada y documentada en migue-chat.tsx—
   * de que Migue siga leyendo mientras el lector pasa de página. Una instancia
   * que se va tiene que dejar de sonar ella, no callar a las demás.
   *
   * El `cancel()` de la síntesis sí es global y sigue siéndolo: ahí no hay
   * opción, la API no permite cortar sólo lo propio. Es la asimetría que ya
   * existía y no cambia acá.
   */
  const soltarLoMio = useCallback(() => {
    // El turno sube PRIMERO: todo lo que venga en camino de la lectura
    // anterior queda viejo antes de que lleguemos a cortar nada.
    turnoRef.current += 1;
    pedidoRef.current?.abort();
    pedidoRef.current = null;
    pararReloj();

    soltarAudio(audioRef.current);
    audioRef.current = null;

    setLeyendo(false);
    setPreparando(false);
    sonoRef.current = false;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [pararReloj]);

  /**
   * Silencio en el documento: lo mío y lo de cualquier otra instancia.
   *
   * Es lo que espera quien aprieta Parar —o quien arranca una lectura nueva—:
   * que deje de sonar lo que sonaba, sin tener que saber cuál de los dos
   * controles de la pantalla lo largó. Primero lo propio; lo que quede en
   * `audioActivo` después de eso es de la otra instancia, y se corta avisando.
   */
  const detener = useCallback(() => {
    soltarLoMio();
    callarElAudioDelDocumento();
  }, [soltarLoMio]);

  /**
   * Enterarse de que otra instancia me calló el audio.
   *
   * Sin esto el control queda diciendo "Detener" —y `aria-pressed` en true—
   * con el elemento ya apagado. El elemento es la identidad: si el que
   * cortaron no es el mío, no era mi lectura y no toco nada.
   */
  useEffect(() => {
    const meCallaron = (audio: HTMLAudioElement) => {
      if (audioRef.current !== audio) return;
      audioRef.current = null;
      // El turno sube igual que en `detener()`: lo que venga en camino de esta
      // lectura ya no manda, o el `catch` del pedido la haría caer al respaldo
      // y arrancaría a hablar justo después de que la callaron.
      turnoRef.current += 1;
      pedidoRef.current?.abort();
      pedidoRef.current = null;
      pararReloj();
      sonoRef.current = false;
      setLeyendo(false);
      setPreparando(false);
    };
    suscriptores.add(meCallaron);
    return () => {
      suscriptores.delete(meCallaron);
    };
  }, [pararReloj]);

  /**
   * El vigía. Diez líneas que matan toda la familia de bugs del botón clavado.
   *
   * Después de `cancel()` el `onend` NO dispara, y después del corte de los 15
   * segundos de Chrome tampoco. Si el estado "quieto" dependiera sólo del
   * `onend`, alcanzaría con un tropiezo para dejar el botón diciendo "Detener"
   * —con `aria-pressed` en true— para siempre, sin nada que escuchar.
   *
   * La gracia de arranque existe porque en la primera lectura de la sesión
   * Chrome puede tardar más de un segundo en empezar: sin ella el vigía
   * apagaría el estado antes de que la voz diga la primera palabra.
   */
  useEffect(() => {
    // El vigía es del camino del navegador y sólo de él. Mientras se genera el
    // mp3 o mientras suena, `speechSynthesis` está quieto a propósito: el
    // vigía vería el silencio, diría que la lectura murió y apagaría el botón
    // con el audio andando. El ref alcanza y no hace falta que sea estado
    // porque los dos únicos momentos en que el camino cambia —arranca la
    // lectura, y contesta /api/voz— mueven `leyendo` o `preparando`, que sí
    // están en las dependencias.
    if (!leyendo || preparando || audioRef.current !== null) return;
    const id = window.setInterval(() => {
      const sintesis = window.speechSynthesis;
      if (sintesis.speaking || sintesis.pending) {
        sonoRef.current = true;
        return;
      }
      const esperando =
        !sonoRef.current && Date.now() - arranqueRef.current < GRACIA_DE_ARRANQUE_MS;
      if (!esperando) {
        setLeyendo(false);
        sonoRef.current = false;
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [leyendo, preparando]);

  /**
   * Los tres cortes. `speechSynthesis` es **global al documento**, así que una
   * navegación del App Router no lo apaga solo.
   *
   * Cada corte vale para lo que dice y para nada más. Escrito así porque el
   * comentario anterior prometía una garantía que sólo se cumplía en uno de
   * los dos consumidores, y es el tipo de comentario que después se usa como
   * prueba de que no hace falta revisar.
   *
   * - El `return` del efecto cubre el desmontaje, **y sólo desmonta el
   *   BotonEscuchar**: vive dentro de la nota, así que al pasar de hoja el
   *   segmento se suspende en su `loading.tsx` y el componente se va. Sin esto
   *   el lector seguiría escuchando la nota anterior mientras mira otra, sin
   *   ningún botón para pararlo hasta recargar. El MigueChat NO se desmonta
   *   nunca al cambiar de nota —está montado en el layout—, así que para él
   *   este corte no existe y Migue puede seguir leyendo la nota A con la B en
   *   pantalla. Eso no es un olvido: está decidido y escrito en migue-chat.tsx
   *   ("la voz sobrevive al paso de página igual que la conversación"), y el
   *   chat sí ofrece su "Parar" mientras tanto. Por lo mismo el desmontaje
   *   suelta sólo lo propio (ver `soltarLoMio`).
   * - `pagehide` cubre irse del sitio y el bfcache, para los dos consumidores:
   *   es un evento de la ventana y lo escuchan todas las instancias montadas.
   * - `visibilitychange` cubre cambiar de pestaña, también para los dos. Cada
   *   navegador hace algo distinto ahí —Chrome de escritorio sigue hablando en
   *   una pestaña oculta, los móviles pausan o matan—; no se intenta unificar
   *   el comportamiento, se corta, que es predecible en todos lados.
   */
  useEffect(() => {
    const callar = () => detener();
    const alEsconderse = () => {
      if (document.visibilityState === "hidden") detener();
    };
    window.addEventListener("pagehide", callar);
    document.addEventListener("visibilitychange", alEsconderse);
    return () => {
      window.removeEventListener("pagehide", callar);
      document.removeEventListener("visibilitychange", alEsconderse);
      soltarLoMio();
    };
  }, [detener, soltarLoMio]);

  /**
   * Hablar con la voz del sistema.
   *
   * Es el cuerpo de siempre, movido tal cual a su propia función para que el
   * camino del mp3 pueda caer acá sin duplicar una línea. No cambió nada
   * adentro: las mañas comentadas abajo siguen siendo las mismas.
   */
  const hablarConElNavegador = useCallback(
    (texto: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

      const pedazos = enOraciones(texto);
      if (pedazos.length === 0) return;

      const sintesis = window.speechSynthesis;

      /*
       * TODO ESTO ES SINCRÓNICO, Y NO ES UN DETALLE.
       *
       * En Safari de iOS `speak()` tiene que salir del MISMO tick del gesto del
       * usuario. Un `await`, un `fetch` o un `setTimeout` entre el click y esta
       * línea y el botón deja de sonar — y sólo en iPhone. Pasa el lint, pasa el
       * build, pasa cualquier revisión de código, y sale roto a la calle para
       * una parte grande de los lectores.
       *
       * Por eso el texto llega ya armado por props y las voces ya están en
       * memoria: acá no se resuelve nada, se habla.
       */
      sintesis.cancel();

      const voz = vozURI
        ? (vocesEnEspanol().find((v) => v.voiceURI === vozURI) ?? null)
        : null;

      pedazos.forEach((pedazo, i) => {
        const dicho = new SpeechSynthesisUtterance(pedazo);
        if (voz) {
          dicho.voice = voz;
          dicho.lang = voz.lang;
        } else {
          dicho.lang = "es-AR";
        }

        // Sólo el último pedazo apaga el estado: los del medio terminan todo el
        // tiempo y el botón no tiene que parpadear entre oración y oración.
        if (i === pedazos.length - 1) {
          dicho.onend = () => {
            setLeyendo(false);
            sonoRef.current = false;
          };
        }
        dicho.onstart = () => {
          sonoRef.current = true;
        };
        dicho.onerror = (e) => {
          // "interrupted" y "canceled" son nuestro propio `cancel()`: el usuario
          // apretó Detener o pasó de hoja. No es un error que reportar, y el
          // estado ya lo apagó quien canceló.
          if (e.error === "interrupted" || e.error === "canceled") return;
          setLeyendo(false);
          sonoRef.current = false;
        };

        sintesis.speak(dicho);
      });

      arranqueRef.current = Date.now();
      sonoRef.current = false;
      setLeyendo(true);
    },
    [vozURI],
  );

  const leer = useCallback(
    (texto: string, fuente?: FuenteDeAudio) => {
      if (typeof window === "undefined") return;

      // Corta lo que estuviera sonando o generándose, de cualquiera de los dos
      // caminos, y de paso sube el turno: lo de antes ya no manda.
      detener();
      const turno = turnoRef.current;

      // Sin fuente no hay nada que pedir: habla el navegador y se acabó,
      // exactamente igual que antes de que existiera el mp3.
      if (!fuente) {
        hablarConElNavegador(texto);
        return;
      }

      /*
       * EL DESBLOQUEO DE iOS. Parece basura y no lo es: no lo borres.
       *
       * En Safari de iPhone `audio.play()` sólo corre si sale del MISMO tick
       * del gesto del usuario, y acá en el medio hay un `fetch` a /api/voz que
       * puede tardar segundos generando el audio. Para cuando llega la url el
       * permiso del gesto ya venció y `play()` se rechaza con NotAllowedError:
       * el botón se aprieta, dice que está leyendo, y no suena nada. Sólo en
       * iPhone, y sólo en la calle.
       *
       * El rodeo conocido es este: crear el elemento y darle `play()` ACÁ,
       * sincrónico, sobre un wav mudo. El permiso queda pegado a ESE elemento
       * —no al documento—, así que después se le puede cambiar el `src` por el
       * mp3 real y volver a llamar a `play()` sin gesto y sin que se queje.
       *
       * Por lo mismo se usa `new Audio()` de JavaScript y no un `<audio>` de
       * JSX: el elemento tiene que existir antes de que exista el audio que va
       * a reproducir, y además `jsx-a11y/media-has-caption` está en ERROR en
       * este repo y exigiría un `<track kind="captions">` para un elemento
       * invisible, sin subtítulos, que lee un texto que ya está impreso arriba.
       */
      const audio = new Audio(SILENCIO);
      audio.play().catch(() => {
        // Que el desbloqueo falle no es motivo para abandonar: en escritorio
        // ni hace falta, y si el navegador de verdad no deja reproducir, el
        // `play()` del mp3 va a fallar también y ahí caemos a la voz del
        // sistema, que es lo correcto.
      });
      audioRef.current = audio;
      // Desde acá el documento tiene un audio con dueño: cualquier `detener()`
      // de cualquier instancia lo encuentra y lo calla. Ver `audioActivo`.
      audioActivo = audio;

      /*
       * El respaldo tiene el MISMO problema y también hay que desbloquearlo
       * acá. Si /api/voz contesta que no hay voz de Migue, el que tiene que
       * hablar es `speechSynthesis`, y para ese momento el gesto ya se venció
       * igual que para el audio. Una utterance de un espacio, adentro del
       * gesto, deja el motor destrabado para el resto de la página.
       *
       * No se le ponen manejadores a propósito: no es una lectura, es una
       * llave. El `cancel()` que hace `hablarConElNavegador` la barre antes de
       * decir lo que importa.
       */
      if ("speechSynthesis" in window) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(" "));
      }

      /**
       * Caer al respaldo con el mismo texto: no hay mp3, pero se lee igual.
       *
       * Se entra por cinco caminos —sin url, `error`, `play()` rechazado, el
       * `catch` del pedido y el reloj de arranque— y **dos de ellos se
       * disparan solos al usar el tercero**: apagar el elemento rechaza el
       * `play()` que estaba pendiente, y ese rechazo vuelve a llamar acá. Sin
       * la tranca, el reloj que cae al respaldo termina hablando dos veces y
       * la segunda cancela y reinicia a la primera: se escucha arrancar la
       * lectura y volver a empezar.
       */
      let yaCayoAlNavegador = false;
      const alNavegador = () => {
        if (yaCayoAlNavegador) return;
        yaCayoAlNavegador = true;
        // El reloj se para acá y no en cada sitio que llama, por lo mismo:
        // olvidarse en uno solo deja un timer suelto que después corta una
        // lectura que ya es otra.
        pararReloj();
        soltarAudio(audio);
        // El ref se limpia ANTES de cambiar `preparando`, porque es lo que
        // mira el vigía cuando el efecto se vuelve a correr por ese cambio.
        audioRef.current = null;
        setPreparando(false);
        if (!("speechSynthesis" in window)) {
          // Ni mp3 ni voz del sistema: no queda nada que hacer sonar. Hay que
          // apagar el estado a mano, porque el vigía —que es quien lo apagaría—
          // vive justamente de preguntarle a `speechSynthesis` si sigue vivo.
          setLeyendo(false);
          return;
        }
        hablarConElNavegador(texto);
      };

      const control = new AbortController();
      pedidoRef.current = control;
      setLeyendo(true);
      setPreparando(true);

      void (async () => {
        try {
          /*
           * EL TECHO DEL PEDIDO.
           *
           * `control.signal` sólo cubre el Parar del usuario: si nadie aprieta
           * nada, un fetch colgado no rechaza hasta el vencimiento del
           * navegador. Ver `TECHO_DEL_PEDIDO_MS`.
           *
           * `AbortSignal.any` está en el lib.dom de este TypeScript, pero en
           * el navegador es reciente (Chrome 116, Safari 17.4, Firefox 124) y
           * acá hay iPhones viejos leyendo el diario: sin el chequeo, en esos
           * dispositivos tiraría TypeError, se lo comería el `catch` y se
           * perdería la voz de Migue entera. Donde no está, el techo se pone a
           * mano sobre el mismo controller.
           */
          const hayCombinador =
            typeof AbortSignal.any === "function" &&
            typeof AbortSignal.timeout === "function";
          if (!hayCombinador) {
            armarReloj(TECHO_DEL_PEDIDO_MS, () => control.abort());
          }

          const res = await fetch("/api/voz", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fuente),
            signal: hayCombinador
              ? AbortSignal.any([
                  control.signal,
                  AbortSignal.timeout(TECHO_DEL_PEDIDO_MS),
                ])
              : control.signal,
          });
          if (!res.ok) throw new Error(String(res.status));
          const data: { url: string | null } = await res.json();
          // El guard, otra vez: acá ya pasaron varios ticks desde el click.
          if (turnoRef.current !== turno) return;
          if (!data.url) {
            alNavegador();
            return;
          }

          /** Si el mp3 llegó a sonar. Un error después de esto es un corte de
           *  red en el medio, y volver a empezar con otra voz sería peor. */
          let arranco = false;
          audio.onplaying = () => {
            if (turnoRef.current !== turno) return;
            /*
             * Barrer la llave del desbloqueo de iOS.
             *
             * La utterance en blanco se encola SIEMPRE, también cuando el mp3
             * después sí arranca, y el `cancel()` que la limpiaba vive dentro
             * de `hablarConElNavegador`, que en este camino no corre. Queda
             * estado global sucio, y en Chrome una utterance vacía a veces no
             * dispara `end` y se queda colgada en la cola.
             *
             * Que sea global no molesta acá porque va DESPUÉS del guard del
             * turno: si otra instancia arrancó a leer mientras tanto, nos
             * calló y nos subió el turno, así que este `cancel()` no llega a
             * correr y no le pisa la voz.
             */
            if ("speechSynthesis" in window) window.speechSynthesis.cancel();
            pararReloj();
            arranco = true;
            setPreparando(false);
          };
          audio.onended = () => {
            if (turnoRef.current !== turno) return;
            pararReloj();
            soltarAudio(audio);
            audioRef.current = null;
            setLeyendo(false);
            setPreparando(false);
          };
          audio.onerror = () => {
            if (turnoRef.current !== turno) return;
            if (arranco) {
              pararReloj();
              soltarAudio(audio);
              audioRef.current = null;
              setLeyendo(false);
              return;
            }
            alNavegador();
          };
          audio.src = data.url;

          /*
           * EL SEGUNDO RELOJ: que el mp3 arranque, no sólo que tenga url.
           *
           * Un stream que se traba a mitad no dispara `playing` ni `error`, y
           * mientras `preparando` es true el vigía retorna temprano: sin esto
           * el botón se queda en "Preparando" para siempre. Se limpia en
           * `onplaying`, en `onended`, en `alNavegador` y en `detener`.
           */
          armarReloj(TECHO_DE_ARRANQUE_DEL_MP3_MS, () => {
            if (turnoRef.current !== turno || arranco) return;
            alNavegador();
          });

          audio.play().catch(() => {
            if (turnoRef.current !== turno) return;
            alNavegador();
          });
        } catch (e) {
          // Un abort entra por acá y sale por el guard sin hacer nada, que es
          // justo lo que se quiere: el usuario ya apretó Parar.
          if (turnoRef.current !== turno) return;
          // Un 400 de /api/voz caía acá y no se veía en ningún lado: en
          // pantalla no cambia nada porque el respaldo lee igual. La ruta
          // paga dos lecturas a la base argumentando que "un 400 en desarrollo
          // es la única forma de que el bug aparezca cuando todavía es
          // barato", y ese 400 no llegaba a los ojos de nadie. Mudo en
          // producción, hablador acá: mismo criterio que `registrarConsulta`
          // y que el `avisar()` de elevenlabs.ts.
          if (process.env.NODE_ENV !== "production") {
            console.warn(
              "[voz] /api/voz falló, se lee con la voz del navegador",
              e,
            );
          }
          alNavegador();
        }
      })();
    },
    [detener, hablarConElNavegador, armarReloj, pararReloj],
  );

  return { disponible: vozURI !== "", leyendo, preparando, leer, detener };
}
