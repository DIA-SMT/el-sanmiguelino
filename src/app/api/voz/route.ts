import { after, NextResponse, type NextRequest } from "next/server";
import { getUsuario } from "@/lib/auth/session";
import { edicionEnFoco } from "@/lib/auth/vista-previa";
import { db } from "@/lib/db";
import { CLAVE_DE_LA_VOZ } from "@/lib/migue/tope";
import { getIndice, getNota, getResumenEdicion } from "@/lib/repos/edicion";
import {
  textoDeResumenDeNota,
  textoDeResumenDeTapa,
} from "@/lib/voz/texto-para-escuchar";
import { generarAudio, vozDeMigueDisponible } from "@/lib/voz/elevenlabs";
import {
  claveDeAudio,
  storageDisponible,
  subirAudio,
  urlDeAudioSiExiste,
} from "@/lib/storage";

/**
 * La voz de Migue: el mp3 de un resumen hablado.
 *
 * POST { que: "nota" | "tapa", slug? } → { url: string | null }
 *
 * Se genera **cuando alguien lo pide**, se guarda en el bucket y se reutiliza
 * para siempre: la clave lleva la huella del texto, así que mientras el editor
 * no toque el título ni la bajada, la segunda persona que aprieta escuchar no
 * cuesta nada.
 *
 * `url: null` NO es un error: es "hoy no hay voz de Migue, leelo con la del
 * navegador". Pasa mientras no haya Voice ID, si ElevenLabs falla o tarda, o si
 * la subida no salió. El respaldo de `usar-voz.ts` existe justamente para que un
 * proveedor caído no deje mudo a Migue en producción, y por eso de acá nunca
 * sale un 500 por un problema de generación: un error sólo confundiría a un
 * cliente que ya sabe cómo seguir solo.
 */

/* ------------------------------------------------------------------------- */
/* POR QUÉ EL CLIENTE NO MANDA EL TEXTO                                       */
/* ------------------------------------------------------------------------- */
/**
 * **El cliente manda `que` y `slug`. El texto lo deriva el servidor de la base,
 * y no hay ninguna forma de que el pedido lo influya.**
 *
 * Esto no es prolijidad: es plata del municipio. Si el cuerpo aceptara texto
 * libre, cualquiera con la consola abierta —o un script— tendría un proxy de
 * texto-a-voz pago, ilimitado y a nuestro nombre: manda el párrafo que quiera,
 * se lleva el mp3 y la factura de ElevenLabs la paga la Municipalidad. Es
 * además un problema de contenido: el bucket es de lectura pública, así que
 * cualquier texto que entre acá termina siendo un archivo servido desde nuestro
 * dominio.
 *
 * Por eso el único parámetro con forma libre es `slug`, y se verifica contra la
 * base antes de usarlo (ver abajo). Lo que se lee siempre salió de
 * `textoDeResumenDeNota` / `textoDeResumenDeTapa` sobre lo que hay guardado: el
 * título y la bajada que escribió y aprobó un redactor.
 *
 * Que nadie "mejore" esto agregando un campo `texto` para ahorrarse una
 * consulta a la base. La consulta es barata; el agujero no.
 */

/* ------------------------------------------------------------------------- */
/* EL TECHO DE GASTO                                                          */
/* ------------------------------------------------------------------------- */
/**
 * El fusible de gasto vive EN LA BASE, con clave propia, y no en memoria.
 *
 * Estuvo en memoria del módulo, con este argumento: los audios son un conjunto
 * cerrado y chiquito —una nota por nota más la tapa, hoy nueve mp3—, cada uno se
 * paga una sola vez y después contesta el bucket, así que un contador por
 * instancia alcanzaba para "el doble click y las dos pestañas del mismo lector".
 *
 * **Ese razonamiento se cae en serverless, y se cae caro.** En Vercel no hay una
 * instancia: hay N, y cada una arranca en frío con el contador en cero, así que
 * el techo real era 60 × N. Una sola pestaña alcanza para verlo —el login sigue
 * siendo el mock, o sea que se saca sesión sin credenciales—:
 *
 *     await Promise.all([...Array(500)].map(() => fetch('/api/voz', {
 *       method: 'POST', headers: { 'content-type': 'application/json' },
 *       body: '{"que":"tapa"}' })))
 *
 * Los 500 pedidos son del MISMO audio, caen repartidos sobre instancias frías, y
 * `enVuelo` —que deduplica dentro de una— no ve nada raro porque cada instancia
 * ve pocos. Salen min(500, N × 60) generaciones del mismo mp3 en menos de un
 * minuto: a unos US$0,05 cada una son ~US$15 de una sentada, repetibles cada
 * hora. Contra una cuota prepaga del municipio, eso es el mes entero en una
 * tarde.
 *
 * Para que el techo sea techo, el contador tiene que ser **compartido**. Se
 * reusa el mecanismo de `src/lib/migue/tope.ts` —el modelo `ConsumoMigue`, con
 * clave `(clave, ventana)` y un upsert con `increment` atómico, que es lo que
 * hace que dos pedidos simultáneos no lean el mismo número— pero NO su función.
 * La objeción vieja contra `contarConsultaAlModelo()` sigue siendo buena, sólo
 * que era una objeción a MEZCLAR PRESUPUESTOS y no al mecanismo: `consumoMigue`
 * decide si Migue puede llamar al modelo y alimenta el tablero, y un vecino
 * escuchando notas no puede dejar a Migue sin responder preguntas. Por eso las
 * filas de la voz van con clave propia (`CLAVE_DE_CONSUMO`) y no con el hash de
 * una persona: son valores de espacios distintos —el otro es un HMAC de 32
 * caracteres— así que no se pisan nunca.
 *
 * **Deuda anotada, a propósito y no por descuido:** `tope.ts` suma la ventana
 * entera sin filtrar por clave (el `aggregate` de `contarConsultaAlModelo` y el
 * `findMany` de `consumoDeLaHora`), así que hoy las filas de la voz también
 * cuentan contra `MIGUE_TOPE_GLOBAL` y se ven en el tablero de Migue. En régimen
 * son nueve audios por edición —ruido— y bajo ráfaga son sesenta por hora como
 * mucho, pero es contaminación real y el arreglo es de un renglón por consulta:
 * `clave: { not: "voz" }`. Va en `tope.ts`, que esta tanda no toca.
 *
 * El tope por persona no se copia: el adapter mock de Cidituc le da a todo el
 * mundo el id `cidituc-demo-001`, así que cualquier tope "por persona" es hoy un
 * tope global disfrazado y un solo lector insistente le apagaría la voz a todos.
 * Para algo que ya tiene respaldo gratis, es mucho castigo para muy poco ahorro.
 */

/**
 * Cuántos audios NUEVOS se generan por hora, como mucho, ENTRE TODOS.
 *
 * Es un fusible, no una cuota: con nueve audios por edición, llegar a sesenta en
 * una hora significa que algo anda mal —un cliente en bucle, o la subida
 * fallando y regenerando siempre lo mismo—. Nadie legítimo lo toca.
 */
const TOPE_DE_GENERACIONES_POR_HORA = 60;

/**
 * La clave con la que la voz anota su consumo en `ConsumoMigue`.
 *
 * Literal y no derivada de nadie: es el presupuesto de la voz, no el de una
 * persona. Ver el bloque de arriba.
 *
 * **Se importa de `tope.ts` y no se declara acá**: es la misma constante que
 * usan las dos consultas que la EXCLUYEN del presupuesto del modelo. Con una
 * copia de cada lado, cambiar el string en uno solo dejaría el filtro sin
 * efecto sin que nada falle, y la voz volvería a comerle a Migue sus llamadas
 * de la hora.
 */
const CLAVE_DE_CONSUMO = CLAVE_DE_LA_VOZ;

/**
 * Cuánto se espera a ElevenLabs antes de contestar "usá la voz del navegador".
 *
 * En el plan Hobby de Vercel la función se corta a los 10 segundos, y ahí el
 * cliente no recibe JSON sino un error de plataforma. Cortando nosotros dos
 * segundos antes del filo, el lector recibe siempre un `{ url: null }` limpio y
 * arranca a escuchar con la voz del sistema en vez de quedarse mirando un botón
 * que no hace nada.
 *
 * **Sigue en ocho a pesar del `after` de abajo, y eso es una decisión.** La
 * tentación es bajarlo "para darle aire" a la subida que queda corriendo, y no
 * sirve de nada: el reloj de la plataforma corre desde que entra el pedido, no
 * desde que se escribe la respuesta, así que la cola tiene `10s − lo que ya
 * pasó` cortemos donde cortemos. Mover el corte mueve la espera del lector y
 * nada más —y hacia abajo la empeora, porque le saca la chance de escuchar la
 * voz buena en el mismo click—. Además `TECHO_DEL_PEDIDO_MS` de `usar-voz.ts`
 * está escrito contra estos ocho segundos, y ese archivo no es de esta tanda.
 *
 * **Hay un reloj de más, y queda anotado:** `TIMEOUT_MS` de
 * `src/lib/voz/elevenlabs.ts` son 15 segundos, más largos que este corte y que
 * los 10 de Hobby, así que no dispara nunca —la plataforma mata la invocación
 * antes—. Lo correcto sería un solo reloj: que esta ruta le pase a
 * `generarAudio` un `AbortSignal` con su propio vencimiento, para que la
 * generación se corte a tiempo y deje lugar a la subida. No se hizo porque
 * cambia la firma de `generarAudio`, que es de otro archivo. Mientras tanto no
 * rompe nada: el resultado de que el reloj largo no dispare es el mismo que si
 * disparara —no hay audio y se lee con la voz del navegador—.
 */
const ESPERA_MAXIMA_MS = 8_000;

/** El comienzo de la hora en curso. Igual que en `tope.ts`: la misma hora tiene
 *  que caer en la misma fila para que el incremento sea atómico. */
function ventanaActual(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  return d;
}

let ventanaDeLaHora = 0;
let generadasEnLaInstancia = 0;

/**
 * El fusible local, que sobrevive a que la base no esté.
 *
 * Ya no es la defensa —la de verdad es la fila compartida— pero se queda porque
 * es gratis y porque cubre el hueco del otro: si falta `DATABASE_URL` o Postgres
 * no contesta, el contador compartido deja pasar (mismo criterio que `tope.ts`:
 * una caída de la base no puede apagar el diario), y sin esto "deja pasar"
 * querría decir "sin techo".
 */
function hayLugarEnLaInstancia(): boolean {
  const hora = Math.floor(Date.now() / 3_600_000);
  if (hora !== ventanaDeLaHora) {
    ventanaDeLaHora = hora;
    generadasEnLaInstancia = 0;
  }
  if (generadasEnLaInstancia >= TOPE_DE_GENERACIONES_POR_HORA) return false;
  generadasEnLaInstancia++;
  return true;
}

/**
 * Consume un lugar del fusible de la hora, entre todas las instancias.
 *
 * **Incrementa primero y pregunta después**, en una sola sentencia atómica, por
 * lo mismo que lo hace `contarConsultaAlModelo`: leer-decidir-escribir deja
 * pasar a todos los que leyeron el mismo número, que es exactamente el caso que
 * hay que atajar acá —una ráfaga simultánea, no un goteo—.
 *
 * Si la base no está, deja pasar: queda el fusible local, que es el techo de
 * antes. Nunca es peor que lo que había.
 */
async function hayLugarParaGenerar(): Promise<boolean> {
  if (!hayLugarEnLaInstancia()) return false;
  if (!process.env.DATABASE_URL) return true;

  // Se resuelve UNA vez: llamarla en el `where` y en el `create` por separado
  // deja abierta la chance de que el pedido cruce la hora en el medio y busque
  // en una ventana y cree otra.
  const ventana = ventanaActual();

  try {
    const fila = await db().consumoMigue.upsert({
      where: { clave_ventana: { clave: CLAVE_DE_CONSUMO, ventana } },
      create: { clave: CLAVE_DE_CONSUMO, ventana, consultas: 1 },
      update: { consultas: { increment: 1 } },
      select: { consultas: true },
    });
    return fila.consultas <= TOPE_DE_GENERACIONES_POR_HORA;
  } catch {
    // Ver arriba: ante la duda, que Migue hable. La limpieza de ventanas viejas
    // la hace `limpiarVentanasViejas()` desde /api/migue y barre esta fila
    // también: es la misma tabla.
    return true;
  }
}

/**
 * Las generaciones que están ocurriendo ahora mismo, por clave.
 *
 * Dos lectores pidiendo la misma nota en el mismo segundo miran el bucket antes
 * de que el primero haya subido nada: los dos ven que no está y los dos pagan el
 * mismo mp3. Con esto, el segundo se cuelga de la promesa del primero y paga
 * cero. Se borra cuando la promesa REAL termina —no cuando vence la espera— así
 * que si a alguien se le acabó la paciencia, el que venga después se engancha al
 * trabajo que ya está en curso en lugar de arrancar otro.
 *
 * Es por instancia y así se queda: deduplicar adentro de una instancia sigue
 * sirviendo, no cuesta nada, y el techo entre instancias ya lo pone el fusible
 * compartido de arriba.
 */
const enVuelo = new Map<string, Promise<string | null>>();

/** Espera una promesa hasta `ms`, y si no llegó devuelve null. */
async function conLimiteDeEspera<T>(
  promesa: Promise<T>,
  ms: number,
): Promise<T | null> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promesa,
      new Promise<null>((resolver) => {
        temporizador = setTimeout(() => resolver(null), ms);
      }),
    ]);
  } finally {
    clearTimeout(temporizador);
  }
}

/**
 * Genera el audio y lo sube. Devuelve la URL, o null si algo no salió.
 *
 * Nunca tira: cada salida sin audio es un `{ url: null }` y el cliente lee con
 * la voz del navegador.
 */
async function generarYSubir(
  texto: string,
  clave: string,
): Promise<string | null> {
  const bytes = await generarAudio(texto);
  if (!bytes) return null;

  try {
    return await subirAudio(bytes, clave);
  } catch (e) {
    // La subida es lo único de este camino que puede tirar (`generarAudio` no
    // tira por contrato). Perder el mp3 recién pagado es una lástima, pero no es
    // motivo para romperle la pantalla a nadie.
    //
    // **En desarrollo SÍ avisa, y no es un detalle.** Este `catch` mudo esconde
    // el único fallo del camino que además CUESTA PLATA: el audio ya se pagó y
    // se tira, y el próximo lector lo vuelve a pagar, para siempre. Sin este
    // aviso el síntoma es "anda igual pero con la otra voz", que es
    // indistinguible de no tener clave configurada. Es el mismo criterio que
    // `registrarConsulta`: mudo en producción, hablador acá.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[voz] no se pudo guardar el audio en el bucket:", e);
    }
    return null;
  }
}

/**
 * Los porteros que contestan `{ url: null }` sin generar nada. `null` acá
 * significa "seguí, se puede generar".
 *
 * Los tres son baratos: dos leen variables de entorno y el tercero mira una
 * cookie —`edicionEnFoco()` sale por `null` antes de resolver la sesión cuando
 * la cookie no está, que es el caso de todos los lectores—. Ninguno toca la red
 * ni la base.
 */
async function corteAntesDeGenerar(): Promise<NextResponse | null> {
  /**
   * Sin voz de Migue no se toca el storage ni se llama a nadie.
   *
   * Es el camino NORMAL mientras el usuario no complete el Voice ID, no una
   * falla: el cliente recibe `null` y lee con `speechSynthesis`, que es el
   * respaldo de siempre.
   */
  if (!vozDeMigueDisponible()) return NextResponse.json({ url: null });

  /**
   * Y sin storage tampoco: no es un chequeo de más.
   *
   * Lo único que esta ruta sabe devolver es una URL. Si falta la configuración
   * de Supabase, el mp3 no se puede guardar ni servir, así que generarlo sería
   * pagarle a ElevenLabs por bytes que se tiran en la misma función.
   */
  if (!storageDisponible()) return NextResponse.json({ url: null });

  /**
   * **Con una edición en foco no se genera NADA.**
   *
   * Con foco puesto, `getNota()` y `getResumenEdicion()` devuelven la edición
   * que todavía no salió: correcto para el diario, y una filtración acá. El
   * bucket es de lectura PÚBLICA y sin credenciales, y la clave del objeto no
   * caduca nunca, así que un admin que pone septiembre en foco, entra a la tapa
   * y aprieta "Escuchar la tapa" deja un `voz/tapa-…mp3` con el titular de un
   * número embargado, legible para siempre por cualquiera que dé con la URL.
   *
   * Y de paso tapa un derroche: como la clave lleva la huella del texto, cada
   * corrección de la bajada es una generación nueva pagada, así que un editor
   * puliendo un titular quema el fusible de la hora él solo.
   *
   * El admin escucha con la voz del navegador, que para revisar una bajada
   * alcanza y sobra.
   */
  if (await edicionEnFoco()) return NextResponse.json({ url: null });

  return null;
}

/**
 * No se declara `runtime`: `nodejs` ya es el default y `edge` está deprecado
 * (ver node_modules/next/dist/docs/.../route-segment-config/runtime.md). Tampoco
 * `dynamic`: un handler POST nunca se prerrenderiza. Es lo mismo que hace
 * /api/migue, que también llama a un proveedor externo y no declara nada.
 *
 * `maxDuration` tampoco: en Hobby el techo son 10 segundos, así que escribir
 * `maxDuration = 10` no compraría ni un segundo y dejaría un número clavado que
 * habría que acordarse de subir el día que cambie el plan. Sí importa saber que
 * ese techo es el que también acota al `after` de abajo.
 */
export async function POST(request: NextRequest) {
  const usuario = await getUsuario();
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: { que?: unknown; slug?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const que = body.que;
  if (que !== "nota" && que !== "tapa") {
    return NextResponse.json(
      { error: 'El campo "que" tiene que ser "nota" o "tapa".' },
      { status: 400 },
    );
  }
  const slugPedido = typeof body.slug === "string" ? body.slug : undefined;

  /**
   * EL ORDEN DE LOS PORTEROS CAMBIA SEGÚN EL ENTORNO, y es a propósito.
   *
   * **En producción cortan primero**, antes de tocar la base. Mientras no esté
   * `ELEVENLABS_API_KEY` —que es hoy— el 100% de los pedidos termina en
   * `{ url: null }`, y con los porteros abajo cada uno se comía igual sus
   * consultas Prisma antes de darse cuenta. El botón está en todas las notas del
   * diario y el pool es de tres conexiones por instancia (`DB_POOL_MAX`): es
   * carga sobre la base para no hacer nada, compitiendo con las consultas que sí
   * dibujan la página.
   *
   * **En desarrollo cortan después**, para no perder el 400. Si el chequeo de la
   * clave fuera primero, un cliente que manda un slug que no existe recibiría el
   * mismo `null` de siempre, leería con la voz del navegador y nadie se enteraría
   * del error hasta el día que se configure ElevenLabs. Un 400 mientras se
   * programa es la única forma de que ese bug aparezca cuando todavía es barato,
   * y en la máquina de quien programa una consulta de más no le hace daño a
   * nadie.
   */
  const enProduccion = process.env.NODE_ENV === "production";
  if (enProduccion) {
    const corte = await corteAntesDeGenerar();
    if (corte) return corte;
  }

  let texto: string;
  let nombre: string;

  if (que === "nota") {
    /**
     * El slug se verifica CONTRA LA BASE, con `getNota()`, que es la MISMA
     * función que usa la página de la nota.
     *
     * Que sean la misma importa por el archivo: `getNota()` mira
     * `edicionesLegibles`, o sea todas las ediciones publicadas, y la página
     * sirve notas de cualquiera de ellas —"una nota de agosto sigue siendo
     * leíble cuando el diario ya va por septiembre"—. Validar contra
     * `getIndice()`, que es sólo la edición en la calle, dejaba al archivo sin
     * voz de Migue por construcción: alguien comparte una nota en agosto, en
     * septiembre otro lector abre el link, la página le dibuja el botón y esta
     * ruta le contesta 400. Funcionaba —cae a la voz del navegador— pero llenaba
     * producción de 400 que eran el camino normal de un lector legítimo.
     *
     * Sigue siendo la mitad de la defensa de la ruta: `que` ya está acotado a
     * dos valores, así que el slug es el único campo con forma libre que llega
     * de afuera y termina metido en una clave del bucket. Un slug que no existe
     * no es "un audio vacío" ni un objeto raro en el storage: es un 400.
     *
     * Y es UNA consulta, no dos: este camino ya no necesita el índice ni la
     * cabecera de la edición.
     */
    const nota = slugPedido ? await getNota(slugPedido) : null;
    if (!nota) {
      return NextResponse.json(
        { error: "Esa nota no existe o todavía no se publicó." },
        { status: 400 },
      );
    }
    texto = textoDeResumenDeNota(nota);
    // El slug ya está verificado contra la base, así que es seguro usarlo como
    // parte del nombre del objeto. Va en el nombre para que el bucket se pueda
    // mirar a ojo y se entienda qué es cada mp3; lo que hace única a la clave es
    // igual la huella del texto que le agrega `claveDeAudio`.
    nombre = `nota-${nota.slug}`;
  } else {
    const [edicion, indice] = await Promise.all([
      getResumenEdicion(),
      getIndice(),
    ]);
    const principal = indice[0];
    if (!principal) {
      // Edición sin notas cargadas. No hay nada que leer, y tampoco hay nada
      // roto que reportar.
      return NextResponse.json({ url: null });
    }
    texto = textoDeResumenDeTapa(edicion, principal);
    nombre = `tapa-${edicion.slug}`;
  }

  if (!enProduccion) {
    const corte = await corteAntesDeGenerar();
    if (corte) return corte;
  }

  const clave = claveDeAudio(nombre, texto);

  /**
   * Primero el bucket. Si el mp3 ya está, se devuelve y chau: ni una llamada a
   * ElevenLabs. Es lo que hace que todo esto cueste una vez y no una por lector.
   */
  try {
    const guardada = await urlDeAudioSiExiste(clave);
    if (guardada) return NextResponse.json({ url: guardada });
  } catch {
    // Si el storage no contesta, se sigue igual: como mucho se paga un audio
    // que ya existía. Dejar al lector sin voz por una consulta de existencia
    // sería peor.
  }

  let trabajo = enVuelo.get(clave);
  if (!trabajo) {
    if (!(await hayLugarParaGenerar())) {
      // Se agotó el fusible de la hora. El lector no se entera: escucha con la
      // voz del navegador, como cuando todavía no había Voice ID.
      return NextResponse.json({ url: null });
    }
    trabajo = generarYSubir(texto, clave)
      // Cinturón: `generarYSubir` no tira, pero si algún día lo hiciera, un
      // rechazo acá saldría por la promesa que comparten todos los que se
      // engancharon a ella. Un `null` de más es un audio menos; una excepción
      // suelta es un 500 en la cara de un cliente que tiene respaldo.
      .catch(() => null)
      .finally(() => {
        enVuelo.delete(clave);
      });
    enVuelo.set(clave, trabajo);
  }

  /**
   * **`after` es lo que evita tirar un audio YA PAGADO.**
   *
   * Sin esto: ElevenLabs tarda nueve segundos, a los ocho contestamos
   * `{ url: null }`, el lector escucha con la voz del navegador (bien) y la
   * promesa queda corriendo suelta. En Vercel la instancia se congela apenas se
   * escribe la respuesta, así que `subirAudio` no corre nunca: el mp3 se pagó y
   * se perdió, el pedido siguiente no lo encuentra y lo vuelve a pagar. Para
   * siempre, porque la clave del objeto no cambia.
   *
   * `after` mantiene viva la invocación hasta que la promesa termine. Lo que NO
   * hace es regalar tiempo: node_modules/next/dist/docs/01-app/03-api-reference/
   * 04-functions/after.md dice, en "Duration", que «`after` will run for the
   * platform's default or configured max duration of your route» —o sea que la
   * cola corre DENTRO del techo de la ruta, que en Hobby son 10 segundos
   * contados desde que entró el pedido—. Con el corte en ocho quedan unos dos
   * segundos para terminar de generar y subir; alcanza para el caso medido (3,8s
   * de generación, la subida arranca mucho antes del corte) y no alcanza para
   * una generación de más de diez segundos, que se pierde igual y no hay forma
   * de salvarla desde acá. Ver `ESPERA_MAXIMA_MS` sobre por qué mover el corte
   * no cambia ese número.
   *
   * Se registra para TODOS los que se cuelgan de la promesa, no sólo para el que
   * la creó: la instancia que la arrancó pudo haber contestado ya, y basta con
   * que una invocación viva la sostenga. Registrar una promesa ya resuelta no
   * cuesta nada.
   */
  after(trabajo);

  const url = await conLimiteDeEspera(trabajo, ESPERA_MAXIMA_MS);
  return NextResponse.json({ url: url ?? null });
}
