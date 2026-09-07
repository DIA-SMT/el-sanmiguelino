"use client";

import { useId, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { FilaUsuario } from "@/components/admin/fila-usuario";
import {
  ChipFiltro,
  PaginadoNumerado,
  clasesDeBoton,
  clasesDeCampo,
} from "@/components/admin/piezas";
import type { UsuarioDelPanel } from "@/lib/repos/usuarios";
import { cn } from "@/lib/utils";

/**
 * La gente que entró, con sus filtros.
 *
 * **El orden principal es por fecha de registro**, no por último ingreso. Es lo
 * que cambia: ordenada por ingreso, la lista se rebaraja sola cada vez que
 * alguien abre el diario, así que volver a la persona que estabas mirando es
 * buscarla de nuevo, y "quién se sumó esta semana" —la pregunta que de verdad
 * se le hace a esta pantalla— no se podía contestar. El otro orden sigue a un
 * toque, porque para saber quién está entrando ahora sí sirve.
 *
 * Todo el filtrado es **en memoria**, sobre la lista que ya llegó del servidor.
 * No hay fetch, no hay estado en la URL y no hay `useSearchParams`: es el mismo
 * criterio que la tabla de consultas de Migue. Con la URL de por medio cada
 * tecla del buscador sería una navegación y una vuelta al servidor, y para el
 * tamaño de este padrón no compra nada.
 *
 * Las cuentas de los chips se calculan **sobre lo que quedó del buscador**, no
 * sobre el total: así cada chip promete lo que va a pasar si se lo aprieta. Si
 * dice 3, quedan 3 filas.
 */

/** Cuántas filas entran en una página. Veinticinco es lo que se ve sin que la
 *  tarjeta se coma la pantalla: cada fila de esta lista lleva dos renglones y
 *  dos botones, así que pesa más que una fila de tabla. */
const POR_PAGINA = 25;

/** Los filtros, con lo que cada uno deja pasar. Una tabla y no una escalera de
 *  `if`: sumar "editoras" el día que el rol signifique algo es una línea. */
const FILTROS = [
  { clave: "todas", nombre: "Todas", pasa: () => true },
  {
    clave: "administran",
    nombre: "Administran",
    color: "var(--grafico-acento)",
    pasa: (u: UsuarioDelPanel) => u.rol === "admin" && !u.bloqueado,
  },
  {
    clave: "lectoras",
    nombre: "Lectoras",
    pasa: (u: UsuarioDelPanel) => u.rol !== "admin" && !u.bloqueado,
  },
  {
    clave: "bloqueadas",
    nombre: "Bloqueadas",
    color: "var(--grafico-alerta)",
    pasa: (u: UsuarioDelPanel) => u.bloqueado,
  },
] as const;

type ClaveFiltro = (typeof FILTROS)[number]["clave"];

const ORDENES = {
  registro: {
    nombre: "Por registro",
    ayuda: "La última persona que se sumó, arriba",
    valor: (u: UsuarioDelPanel) => u.creadoEn,
  },
  ingreso: {
    nombre: "Por último ingreso",
    ayuda: "Quien entró hace menos, arriba",
    valor: (u: UsuarioDelPanel) => u.ultimoIngreso,
  },
} as const;

type ClaveOrden = keyof typeof ORDENES;

/** Para buscar sin que el acento decida: "lucia" encuentra "Lucía". Se saca el
 *  diacrítico descomponiendo en NFD; nadie escribe con acento en un buscador. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function ListaUsuarios({
  usuarios,
  yo,
}: {
  usuarios: UsuarioDelPanel[];
  /** El `id_persona` de quien está mirando, para no ofrecerle bloquearse. */
  yo: string;
}) {
  const idBuscador = useId();
  const idLista = useId();
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<ClaveFiltro>("todas");
  const [orden, setOrden] = useState<ClaveOrden>("registro");
  const [pagina, setPagina] = useState(1);

  /* Buscar, filtrar o reordenar vuelve a la primera página. Sin esto, alguien
     parado en la página 4 que escribe algo que deja seis filas se queda mirando
     una lista vacía. Va acá, en el evento, y NO en un efecto que observe estos
     estados: eso sería reaccionar a un cambio que este mismo componente
     provocó, o sea un render de más y un estado a medias en el medio. */
  function buscar(texto: string) {
    setBusqueda(texto);
    setPagina(1);
  }

  function filtrarPor(clave: ClaveFiltro) {
    setFiltro(clave);
    setPagina(1);
  }

  function ordenarPor(clave: ClaveOrden) {
    setOrden(clave);
    setPagina(1);
  }

  const porBusqueda = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return usuarios;
    // También por id: es lo único que identifica a quien todavía no tiene
    // nombre normalizado, y es lo que aparece en el rastro de "quién lo
    // cambió".
    return usuarios.filter(
      (u) => normalizar(u.nombre).includes(q) || u.id.includes(q),
    );
  }, [usuarios, busqueda]);

  const cuentas = useMemo(() => {
    const m = {} as Record<ClaveFiltro, number>;
    for (const f of FILTROS) m[f.clave] = porBusqueda.filter(f.pasa).length;
    return m;
  }, [porBusqueda]);

  const filtradas = useMemo(() => {
    const pasa = FILTROS.find((f) => f.clave === filtro)!.pasa;
    const valor = ORDENES[orden].valor;
    /* Copia antes de ordenar: `sort` muta, y el arreglo que llega es el que
       React tiene guardado como props. Las fechas son ISO, así que comparar
       las cadenas ordena igual que comparar los instantes y no hay que
       construir un `Date` por fila. */
    return porBusqueda
      .filter(pasa)
      .slice()
      .sort((a, b) => valor(b).localeCompare(valor(a)));
  }, [porBusqueda, filtro, orden]);

  const hayFiltro = busqueda.trim() !== "" || filtro !== "todas";

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  /* La página que se muestra es DERIVADA y no el estado crudo: el estado
     guarda en qué página estás, pero la lista de abajo cambia de tamaño con el
     buscador. Acotarlo acá lo resuelve sin un efecto que corrija el estado
     después de haber dibujado mal. */
  const paginaActual = Math.min(pagina, totalPaginas);
  const primeraFila = (paginaActual - 1) * POR_PAGINA;
  const enPantalla = filtradas.slice(primeraFila, primeraFila + POR_PAGINA);

  /** Al cambiar de página se sube al principio de la lista: sin eso, apretar
   *  "2" desde el pie deja al lector parado en el final de una página nueva.
   *  Va sin desplazamiento suave a propósito — un salto instantáneo no compite
   *  con `prefers-reduced-motion`. */
  function irA(destino: number) {
    setPagina(Math.min(Math.max(destino, 1), totalPaginas));
    document.getElementById(idLista)?.scrollIntoView({ block: "start" });
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="relative min-w-[13rem] flex-1 sm:max-w-xs">
          <label htmlFor={idBuscador} className="sr-only">
            Buscar por nombre
          </label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-panel-tinta-3"
            aria-hidden="true"
          />
          {/* El aspecto sale de `clasesDeCampo` —el mismo campo de todo el
              panel, con su borde de control de 3:1—. Lo único propio es el
              `pl-9`, que le hace lugar a la lupa. */}
          <input
            id={idBuscador}
            type="search"
            value={busqueda}
            onChange={(e) => buscar(e.target.value)}
            placeholder="Buscar por nombre"
            className={cn(clasesDeCampo("tarjeta"), "pl-9")}
          />
        </div>

        {/* Los chips son botones y no enlaces: este filtro NO vive en la URL
            —es en memoria, sobre las filas que ya llegaron— así que lo correcto
            es `aria-pressed`, que es lo que la pieza pone por defecto. */}
        <div className="flex flex-wrap gap-panel-controles">
          {FILTROS.map((f) => (
            <ChipFiltro
              key={f.clave}
              cuenta={cuentas[f.clave]}
              color={"color" in f ? f.color : undefined}
              activo={filtro === f.clave}
              onClick={() => filtrarPor(f.clave)}
            >
              {f.nombre}
            </ChipFiltro>
          ))}
        </div>
      </div>

      {/* El orden va en su propia fila y con su nombre delante: son dos
          criterios distintos de mirar la misma lista, no dos filtros más, y
          mezclarlos con los chips de arriba haría creer que se combinan. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          id={`${idLista}-orden`}
          className="text-panel-xs font-medium text-panel-tinta-3"
        >
          Ordenar
        </span>
        <div
          role="group"
          aria-labelledby={`${idLista}-orden`}
          className="flex flex-wrap gap-panel-controles"
        >
          {(Object.keys(ORDENES) as ClaveOrden[]).map((clave) => (
            <ChipFiltro
              key={clave}
              activo={orden === clave}
              onClick={() => ordenarPor(clave)}
              title={ORDENES[clave].ayuda}
            >
              {ORDENES[clave].nombre}
            </ChipFiltro>
          ))}
        </div>
      </div>

      {/* El contador dice siempre "N de M", con filtro o sin él: si sólo
          apareciera al filtrar, ver 25 filas de 300 y no notar el cartel sería
          un error de lectura caro. Es además la región viva que anuncia cuántas
          quedaron al filtrar, sin tener que recorrer la lista. */}
      <p
        aria-live="polite"
        className="text-panel-xs tabular-nums text-panel-tinta-3"
      >
        {filtradas.length} de {usuarios.length}{" "}
        {usuarios.length === 1 ? "persona" : "personas"}
        {hayFiltro ? " · hay un filtro puesto" : ""}
      </p>

      {filtradas.length === 0 ? (
        <div className="rounded-panel-2 border border-panel-borde bg-panel-tarjeta-2 px-4 py-5 text-center">
          <p className="text-panel-base text-panel-tinta-2">
            Nadie coincide con este filtro.
          </p>
          <button
            type="button"
            onClick={() => {
              buscar("");
              filtrarPor("todas");
            }}
            /* Se concatena y no se pasa por `cn()`: `cn` es tailwind-merge y se
               comería el `text-panel-sm` de la pieza (está explicado arriba de
               `BOTON_BASE`, en `piezas.tsx`). */
            className={`${clasesDeBoton({
              tamano: "chico",
              sobre: "hundida",
            })} mt-3`}
          >
            Limpiar el filtro
          </button>
        </div>
      ) : (
        <ul
          id={idLista}
          className="-mx-4 divide-y divide-panel-borde border-y border-panel-borde sm:-mx-5"
        >
          {enPantalla.map((u) => (
            <FilaUsuario key={u.id} usuario={u} yo={yo} />
          ))}
        </ul>
      )}

      <PaginadoNumerado
        pagina={paginaActual}
        totalPaginas={totalPaginas}
        alIr={irA}
        etiqueta="Páginas de la lista de usuarios"
        resumen={
          <>
            {primeraFila + 1}–{primeraFila + enPantalla.length} de{" "}
            {filtradas.length}
          </>
        }
      />

      {/* Va SIEMPRE en el DOM, incluso sin paginado: una región viva que
          aparece junto con su primer mensaje no se anuncia, porque el lector de
          pantalla no la tenía vigilada. */}
      <p role="status" aria-live="polite" className="sr-only">
        {filtradas.length === 0
          ? "Nadie coincide con este filtro."
          : `Página ${paginaActual} de ${totalPaginas}. Personas ${primeraFila + 1} a ${primeraFila + enPantalla.length} de ${filtradas.length}.`}
      </p>
    </div>
  );
}
