"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { PaginaEdicion } from "@/lib/data/paginas";

/**
 * Cómo le llega al mando de paso de página el foliado de un número del
 * ARCHIVO.
 *
 * El problema que resuelve: `MandoPaginas` vive en el layout del escritorio, y
 * tiene que vivir ahí —al pasar de página el segmento se suspende y desmonta
 * todo lo que tenga adentro, así que en la página las flechas desaparecían
 * justo durante la carga—. Pero el layout recibe el foliado **de la edición en
 * la calle** y no puede saber cuál se está leyendo: la documentación de Next lo
 * dice con todas las letras, *"layouts do not re-render on navigation, so they
 * do not access pathname which would otherwise become stale"*. O sea que no
 * alcanza con pasarle la ruta por una cabecera: quedaría congelada en la
 * primera carga y mentiría en cuanto el lector navegue.
 *
 * Consecuencia visible, que es de donde salió esto: al abrir una nota de agosto
 * el pathname no figuraba en el foliado de septiembre, el mando se apagaba
 * entero y el número viejo se leía nota por nota, sin flechas, sin teclado y
 * sin gesto. Se podía entrar a una nota y no salir de ella.
 *
 * La solución es al revés de lo que uno intenta primero: **la página le avisa
 * al mando**, porque la página SÍ re-renderiza en cada navegación. El
 * proveedor envuelve al layout entero para que la página —que va adentro de
 * `children`— y el mando —que es su hermano— compartan el mismo estado.
 *
 * Lo que NO se hace acá, a propósito:
 *
 * - **Mandar el foliado de todos los números desde el layout.** Sería una
 *   consulta por edición publicada en cada carga de cada pantalla del diario, y
 *   crece con el archivo: doce números por año.
 * - **Limpiar el registro al desmontar.** Sería volver al mismo pozo: entre
 *   una página de agosto y la siguiente, el segmento se suspende, la página
 *   vieja se va y el mando se quedaría sin foliado en el medio del giro. No
 *   hace falta: un registro viejo sólo se usa si la dirección actual figura en
 *   él, así que sobrar es inofensivo.
 *
 * **Lo que sí cuesta**, y conviene tenerlo escrito: al abrir el enlace DIRECTO
 * de una nota del archivo, el HTML del servidor sale con el foliado del número
 * en la calle, así que las flechas aparecen recién cuando hidrata y corre este
 * efecto. Recorriendo el diario —que es como se llega casi siempre— no se nota,
 * porque para entonces ya hidrató. El pasador del PIE no tiene esa demora: ése
 * sale armado del servidor (ver `hoja-diario.tsx`), así que aun en el peor caso
 * siempre hay con qué pasar de página.
 */
const ContextoFoliado = createContext<{
  extra: PaginaEdicion[];
  registrar: (paginas: PaginaEdicion[]) => void;
}>({ extra: [], registrar: () => {} });

export function ProveedorFoliado({ children }: { children: React.ReactNode }) {
  const [extra, setExtra] = useState<PaginaEdicion[]>([]);
  const valor = useMemo(() => ({ extra, registrar: setExtra }), [extra]);
  return (
    <ContextoFoliado.Provider value={valor}>{children}</ContextoFoliado.Provider>
  );
}

/** El foliado que registró la página, si registró alguno. */
export function useFoliadoExtra(): PaginaEdicion[] {
  return useContext(ContextoFoliado).extra;
}

/**
 * Lo pone una página que NO es de la edición en la calle, para que el mando
 * pueda recorrer su número.
 *
 * No dibuja nada. Va en el servidor dentro de la página y sus props viajan ya
 * resueltas: acá no se consulta nada.
 */
export function FoliadoDeLaPagina({ paginas }: { paginas: PaginaEdicion[] }) {
  const { registrar } = useContext(ContextoFoliado);
  useEffect(() => {
    registrar(paginas);
    // `paginas` se rearma en cada render del servidor, así que la identidad no
    // sirve como dependencia: se compara por las direcciones, que es lo que de
    // verdad decide si el mando tiene que cambiar de número.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginas.map((p) => p.href).join("|"), registrar]);
  return null;
}
