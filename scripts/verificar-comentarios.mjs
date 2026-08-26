/**
 * El contrato de moderación, verificado contra el motor EN MEMORIA.
 *
 * Se corre con `npm run verificar:comentarios`. Las aserciones no viven acá:
 * están en `contrato-comentarios.mjs`, y las mismas se corren contra Postgres
 * con `npm run verificar:comentarios:pg`. Ese es el punto — un contrato que
 * sólo se prueba contra el motor de juguete no prueba nada del real.
 *
 * Límite conocido: importa el `.ts` directo, apoyado en que
 * `comentarios-mock.ts` sólo tiene imports de tipo (que Node borra). Por eso
 * apunta al motor concreto y no a `comentarios.ts`, que sí importa `@/lib/db`
 * como valor y Node no sabría resolver ese alias.
 */
import { correrContrato } from "./contrato-comentarios.mjs";

const mod = await import(
  new URL("../src/lib/repos/comentarios-mock.ts", import.meta.url).href
);

const fallos = await correrContrato(mod.comentariosMockRepo);
console.log(fallos === 0 ? "\nTODO OK (motor en memoria)" : `\n${fallos} FALLAS`);
process.exit(fallos === 0 ? 0 : 1);
