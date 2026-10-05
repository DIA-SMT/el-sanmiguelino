import "server-only";
import { urlIncrustable } from "@/lib/interactivos";

/**
 * El interactivo del Portal de Datos, preparado para ir adentro de la nota.
 *
 * **Por qué el diario arma su propia copia de la página.** La página del Portal
 * está pensada para la ventana entera del navegador: arriba trae el menú, el
 * título y el pie del Portal, y en el recuadro de la nota se veía cortada. Con
 * la línea de tiempo, la página mide 1.238px para un recuadro de 560, y el menú
 * y el título se comen 296. Desde afuera de un <iframe> de otro sitio no hay
 * forma de cambiar eso, y el Portal no va a sumar un modo para incrustar. Así
 * que el diario baja la página, le agrega un ajuste que esconde todo lo del
 * Portal y deja sólo el interactivo a la medida del recuadro, y la sirve desde
 * `/interactivo` (ver `src/app/interactivo/route.ts`). El contenido es el del
 * Portal tal cual: los datos, las imágenes y el código siguen siendo suyos y se
 * bajan de ahí, así que si lo actualizan, el diario lo muestra.
 *
 * **Si el Portal cambia su página, el ajuste se apaga solo.** Va por nombre de
 * clase y no por medidas. Esconder el menú, el título y el pie no depende de
 * nada más: si renombran una clase, esa parte vuelve a verse. Las medidas de la
 * línea de tiempo se aplican sólo si su estructura está entera (ver
 * `guionInicial`): si cambia, se ve la página como es, con su scroll, y no un
 * pedazo aplastado.
 *
 * **Si la copia no puede andar, el recuadro vuelve al Portal.** La copia corre
 * aislada, en un origen anónimo (ver la ruta), y el Portal no deja leer sus
 * archivos desde otro origen: una página que pida datos, fuentes o módulos a
 * su propio servidor se quedaría sin ellos. El guion lo detecta y le avisa al
 * diario, que cambia el recuadro por la página original del Portal (ver
 * `InteractivoIncrustado`). Se ve con el encabezado, como antes, pero anda.
 * Hoy no pasa: la línea de tiempo trae todo adentro, y la de esculturas usa un
 * CDN y Google, que sí dejan.
 */

/** Hasta dónde se espera al Portal, cuerpo incluido. Más que esto y el lector
 *  ya está mirando un recuadro vacío: mejor el aviso con el enlace. */
const ESPERA_MS = 8000;

/** La línea de tiempo pesa 70 KB. Un tope generoso, para que una respuesta
 *  rara del otro lado no se lleve la memoria de la función. Se cuenta mientras
 *  baja: lo que lo pasa se corta ahí, no después de bajarlo entero. */
const TOPE_BYTES = 2_000_000;

/** Cada cuánto se vuelve a bajar del Portal. El contenido cambia muy de vez en
 *  cuando —se arma para cada suplemento—, y así un arreglo de ellos llega en
 *  una hora sin que cada lector le pegue al Portal. */
const VIGENCIA_MS = 60 * 60 * 1000;

/** Cuántas páginas distintas se guardan, como mucho. Hoy hay una. */
const TOPE_COPIAS = 20;

/** Cuántas redirecciones se siguen. Cada una se valida antes de seguirla. */
const TOPE_REDIRECCIONES = 3;

/** La clase que marca que la página va adentro del diario, y la que se suma
 *  cuando la estructura de la línea de tiempo está entera. Con prefijo para
 *  no chocar nunca con una clase del Portal. */
const CLASE = "sm-incrustado";
const CLASE_LINEA = "sm-linea-tiempo";

/*
 * Lo que se esconde y cómo se acomoda.
 *
 * Lo primero es lo que trae CUALQUIER página del Portal —salen de la misma
 * plantilla—: barra de redes, menú, bloque de título y pie. Va con !important
 * porque es lo único que tiene que ganar siempre.
 *
 * Lo segundo es propio de la línea de tiempo, y por eso cuelga de CLASE_LINEA:
 * la app a la altura exacta del recuadro, y el texto al lado del mapa desde
 * 700px —el Portal lo pone al lado recién desde 1.100, y el recuadro de la nota
 * mide entre 720 y 1.100—. `.main-container` y `.app` también existen en otras
 * páginas del Portal, con otro armado: por eso no se tocan si no es la línea
 * de tiempo.
 *
 * Medido sobre la página real: en 1.040×720 entra entera (texto, mapa, años y
 * botones) y en 28 de los 32 años el texto entra sin bajar; en los otros, se
 * baja adentro de su columna.
 */
const AJUSTE_CSS = `
.${CLASE} .site-top-bar,.${CLASE} .site-header,.${CLASE} .page-title-block,.${CLASE} .site-footer,
.${CLASE} .fullscreen-logo,.${CLASE} .btn-exit-fullscreen{display:none!important}
.${CLASE_LINEA} .main-container{max-width:none;padding:0;height:100vh}
.${CLASE_LINEA} .app{height:100vh;min-height:0;border:0;border-radius:0;box-shadow:none}
@media (min-width:700px){
.${CLASE_LINEA} .tl-escena{grid-template-columns:minmax(280px,36%) 1fr}
.${CLASE_LINEA} .tl-panel{border-right:1px solid var(--border-soft);border-bottom:none}
.${CLASE_LINEA} .tl-stage{height:auto}
}
@media (max-width:699px){.${CLASE_LINEA} .tl-escena{grid-template-rows:minmax(0,1fr) auto}}
`;

/*
 * Corre antes que cualquier script de la página.
 *
 * - Marca <html> con CLASE. Al terminar de leer la página, si están las piezas
 *   de la línea de tiempo (`.app > .tl-escena ~ .tl-eje`, con `.tl-stage`),
 *   suma CLASE_LINEA y con eso las medidas.
 * - Si `localStorage` o `sessionStorage` no se pueden usar —en el documento
 *   aislado tiran error— los cambia por un depósito en memoria con la misma
 *   forma. La línea de tiempo envuelve sus lecturas en try, pero otras páginas
 *   del Portal no (la de esculturas lee su tema sin try) y se cortarían.
 * - Fija el tema que manda el diario y lo siembra en `smt-tema`, la clave con
 *   la que la línea de tiempo lo recuerda, para que su propio arranque elija el
 *   del diario y no el del sistema. Otras páginas usan otra clave: a esas les
 *   llega sólo el atributo.
 * - Escucha al diario para cambiar de tema en vivo. Sólo acepta mensajes de la
 *   ventana que lo contiene y con la forma exacta.
 * - Avisa al diario si un pedido al propio Portal falla habiendo señal (ver
 *   arriba, "Si la copia no puede andar"). Sólo mira lo que necesita permiso
 *   de origen cruzado: fetch, XHR y módulos. Un <script> o una hoja de estilos
 *   comunes cargan igual desde un origen anónimo, y lo que sea de otro sitio
 *   (un CDN) falla o anda igual en la copia que en el original.
 */
function guionInicial(tema: "light" | "dark"): string {
  return `(function(){
var raiz=document.documentElement;raiz.classList.add(${JSON.stringify(CLASE)});
document.addEventListener("DOMContentLoaded",function(){if(document.querySelector(".app>.tl-escena~.tl-eje")&&document.querySelector(".tl-escena .tl-stage"))raiz.classList.add(${JSON.stringify(CLASE_LINEA)})});
function memoria(){var m=new Map();return{getItem:function(k){k=String(k);return m.has(k)?m.get(k):null},setItem:function(k,v){m.set(String(k),String(v))},removeItem:function(k){m.delete(String(k))},clear:function(){m.clear()},key:function(i){return Array.from(m.keys())[i]||null},get length(){return m.size}}}
["localStorage","sessionStorage"].forEach(function(n){try{window[n].getItem("x")}catch(e){try{Object.defineProperty(window,n,{value:memoria(),configurable:true})}catch(e2){}}});
function tema(t){raiz.setAttribute("data-theme",t);try{localStorage.setItem("smt-tema",t)}catch(e){}}
tema(${JSON.stringify(tema)});
window.addEventListener("message",function(ev){var d=ev.data;if(ev.source!==window.parent||!d||d.tipo!=="sanmiguelino:tema")return;if(d.tema==="light"||d.tema==="dark")tema(d.tema)});
var sitio=new URL(document.baseURI).host,avisado=false;
function delPortal(u){try{return new URL(u,document.baseURI).host===sitio}catch(e){return false}}
function directo(){if(avisado||!navigator.onLine)return;avisado=true;window.parent.postMessage({tipo:"sanmiguelino:directo"},"*")}
var f=window.fetch;if(f)window.fetch=function(r){var u=typeof r==="string"?r:(r&&r.url)||String(r);return f.apply(this,arguments).catch(function(e){if(delPortal(u))directo();throw e})};
var abrir=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){if(delPortal(u))this.addEventListener("error",directo);return abrir.apply(this,arguments)};
window.addEventListener("error",function(ev){var t=ev.target;if(t&&t.tagName==="SCRIPT"&&t.type==="module"&&delPortal(t.src))directo()},true);
})();`;
}

/** Para meter la dirección en un atributo HTML sin que una comilla la corte. */
function escaparAtributo(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** `</script>` adentro del guion lo cortaría. No aparece hoy, pero el guion
 *  lleva el tema, y esto lo deja a salvo de cualquier valor. */
function escaparGuion(codigo: string): string {
  return codigo.replace(/<\/(script)/gi, "<\\/$1");
}

/**
 * Mete `agregado` adentro del <head>, al principio.
 *
 * No alcanza con buscar `<head>` en el texto: puede aparecer adentro de un
 * comentario o de un script, y ahí lo agregado quedaba comentado o rompía el
 * script. Así que se recorre salteando comentarios, <script> y <style>. Si la
 * página no trae <head> —es opcional en HTML— va después de <html> o del
 * doctype, NUNCA antes: algo antes del doctype pone la página entera en modo
 * de compatibilidad, con otro cálculo de alturas.
 */
function insertarEnCabeza(original: string, agregado: string): string {
  const fichas =
    /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<head(?:\s[^>]*)?>/gi;
  for (let m = fichas.exec(original); m; m = fichas.exec(original)) {
    if (/^<head/i.test(m[0])) {
      const i = m.index + m[0].length;
      return original.slice(0, i) + agregado + original.slice(i);
    }
  }
  const inicio =
    /^﻿?\s*(?:<!--[\s\S]*?-->\s*)*(?:<!doctype[^>]*>)?(?:\s*<!--[\s\S]*?-->)*\s*(?:<html(?:\s[^>]*)?>)?/i.exec(
      original,
    )?.[0] ?? "";
  return inicio + agregado + original.slice(inicio.length);
}

type Copia = { original: string; final: string; bajadaEn: number };
type Fallo = { motivo: "portal" | "no-es-pagina" };

/** Lo bajado, por dirección. Vive en la instancia del servidor: en Vercel cada
 *  instancia baja la página una vez por hora como mucho. Si el Portal falla al
 *  renovarla, se sigue mostrando la copia anterior. */
const copias = new Map<string, Copia>();
/** Lo que se está bajando, para que diez lectores a la vez no sean diez
 *  pedidos al Portal. */
const enCurso = new Map<string, Promise<Copia | Fallo>>();

/** Lee el cuerpo contando bytes y corta apenas pasa el tope. */
async function leerConTope(respuesta: Response): Promise<string | null> {
  const lector = respuesta.body?.getReader();
  if (!lector) return "";
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > TOPE_BYTES) {
      await lector.cancel().catch(() => {});
      return null;
    }
    partes.push(value);
  }
  const juntos = new Uint8Array(total);
  let i = 0;
  for (const parte of partes) {
    juntos.set(parte, i);
    i += parte.byteLength;
  }
  const charset = /charset=([^;]+)/i.exec(
    respuesta.headers.get("content-type") ?? "",
  )?.[1];
  try {
    return new TextDecoder(charset?.trim() || "utf-8").decode(juntos);
  } catch {
    return new TextDecoder("utf-8").decode(juntos);
  }
}

/**
 * Baja la página. Las redirecciones se siguen a mano y cada destino pasa por
 * `urlIncrustable` ANTES de pedirlo: el servidor del diario no se conecta a
 * nada fuera de los sitios habilitados, ni siquiera de paso. El tiempo de
 * espera cubre también el cuerpo, y nada se cachea si falló.
 */
async function bajar(url: string): Promise<Copia | Fallo> {
  const senal = AbortSignal.timeout(ESPERA_MS);
  try {
    let actual = url;
    for (let salto = 0; ; salto++) {
      const respuesta = await fetch(actual, {
        headers: { accept: "text/html" },
        redirect: "manual",
        cache: "no-store",
        signal: senal,
      });
      if (respuesta.status >= 300 && respuesta.status < 400) {
        await respuesta.body?.cancel().catch(() => {});
        const destino = respuesta.headers.get("location");
        const siguiente =
          destino && urlIncrustable(new URL(destino, actual).toString());
        if (!siguiente || salto >= TOPE_REDIRECCIONES) {
          return { motivo: "no-es-pagina" };
        }
        actual = siguiente;
        continue;
      }
      const tipo = respuesta.headers.get("content-type") ?? "";
      const largo = Number(respuesta.headers.get("content-length") ?? 0);
      if (!respuesta.ok || !tipo.includes("text/html") || largo > TOPE_BYTES) {
        await respuesta.body?.cancel().catch(() => {});
        return { motivo: respuesta.ok ? "no-es-pagina" : "portal" };
      }
      const original = await leerConTope(respuesta);
      if (original === null) return { motivo: "no-es-pagina" };
      return { original, final: actual, bajadaEn: Date.now() };
    }
  } catch {
    return { motivo: "portal" };
  }
}

async function copiaDe(url: string): Promise<Copia | Fallo> {
  const guardada = copias.get(url);
  if (guardada && Date.now() - guardada.bajadaEn < VIGENCIA_MS) return guardada;

  let pedido = enCurso.get(url);
  if (!pedido) {
    pedido = bajar(url).finally(() => enCurso.delete(url));
    enCurso.set(url, pedido);
  }
  const r = await pedido;
  if ("motivo" in r) return guardada ?? r;

  copias.delete(url);
  copias.set(url, r);
  if (copias.size > TOPE_COPIAS) {
    const masVieja = copias.keys().next().value;
    if (masVieja !== undefined) copias.delete(masVieja);
  }
  return r;
}

export type ResultadoInteractivo =
  | { ok: true; html: string }
  | { ok: false; motivo: "portal" | "no-es-pagina" };

/**
 * La página del Portal con el ajuste del diario. `url` tiene que haber pasado
 * ya por `urlIncrustable`.
 */
export async function prepararInteractivo(
  url: string,
  tema: "light" | "dark",
): Promise<ResultadoInteractivo> {
  const r = await copiaDe(url);
  if ("motivo" in r) return { ok: false, motivo: r.motivo };

  // El <base> va primero: el primer <base> es el que vale, y las imágenes de
  // la página son relativas a la dirección del Portal. El guion tiene que
  // correr antes que los de la página. El estilo va en el mismo lugar: sus
  // reglas tienen más especificidad que las del Portal, así que no necesitan
  // ir después.
  const agregado =
    `<base href="${escaparAtributo(r.final)}">` +
    `<script>${escaparGuion(guionInicial(tema))}</script>` +
    `<style>${AJUSTE_CSS}</style>`;
  return { ok: true, html: insertarEnCabeza(r.original, agregado) };
}
