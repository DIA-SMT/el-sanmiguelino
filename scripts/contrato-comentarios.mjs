/**
 * El contrato de moderación de comentarios, en una función que recibe el repo.
 *
 * Las aserciones son las mismas que se escribieron contra el motor en memoria,
 * palabra por palabra. Lo único que cambió es de dónde sale el `repo`: antes
 * lo importaba el archivo, ahora se lo pasan. Eso es lo que permite correr el
 * MISMO contrato contra los dos motores.
 *
 * Es la prueba de que la frontera del repo es una frontera: si para hacerlo
 * pasar contra Postgres hubiera que editar una aserción, la migración habría
 * cambiado el comportamiento y no sólo el almacenamiento.
 */
export async function correrContrato(repo) {
  let fallos = 0;
  const ok = (cond, msg) => {
    console.log(`${cond ? "  ok  " : " FALLA"} ${msg}`);
    if (!cond) fallos++;
  };


  // Un comentario nuevo, en una nota conocida
  const nuevo = await repo.crear({
    notaSlug: "plan-bacheo-integral",
    usuarioId: "u-test",
    usuarioNombre: "Vecino de prueba",
    texto: "Comentario de prueba para moderacion",
  });
  ok(nuevo.estado === "publicado", "crear() nace publicado");

  const visibleAntes = await repo.listar("plan-bacheo-integral", "u-test");
  ok(
    visibleAntes.some((c) => c.id === nuevo.id),
    "listar() lo muestra mientras esta publicado",
  );

  // Se da de baja
  const bajado = await repo.darDeBaja(nuevo.id, "admin-1", "prueba");
  ok(bajado?.estado === "oculto", "darDeBaja() lo pone oculto");
  ok(bajado?.ocultadoPor === "admin-1", "queda el rastro de quien lo bajo");
  ok(typeof bajado?.ocultadoEn === "string", "queda el rastro de cuando");

  const visibleDespues = await repo.listar("plan-bacheo-integral", "u-test");
  ok(
    !visibleDespues.some((c) => c.id === nuevo.id),
    "listar() ya no lo muestra",
  );

  // El punto fino: ultimoDeEdicion tambien tiene que filtrarlo.
  // Primero hay que probar que la asercion no es vacia: el comentario recien
  // creado es el mas nuevo de la edicion, asi que ANTES de la baja tiene que
  // ser justamente el que ultimoDeEdicion() devuelve. Sin este control, "no lo
  // destaca" pasaria igual aunque el filtro no existiera.
  const slugs = ["plan-bacheo-integral", "septiembre-musical"];
  await repo.restituir(nuevo.id, "admin-1");
  const eraElUltimo = await repo.ultimoDeEdicion(slugs, "u-test");
  ok(
    eraElUltimo?.id === nuevo.id,
    "control: estando publicado, ultimoDeEdicion() SI lo devuelve",
  );
  await repo.darDeBaja(nuevo.id, "admin-1", "prueba");
  const ultimo = await repo.ultimoDeEdicion(slugs, "u-test");
  ok(
    ultimo?.id !== nuevo.id,
    "ultimoDeEdicion() no lo destaca en portada estando oculto",
  );

  // El admin si lo ve
  const paraAdmin = await repo.listarParaModeracion({
    notaSlug: "plan-bacheo-integral",
    moderadorId: "admin-1",
  });
  ok(
    paraAdmin.some((c) => c.id === nuevo.id),
    "listarParaModeracion() si lo muestra al admin",
  );
  const soloOcultos = await repo.listarParaModeracion({ estado: "oculto" });
  ok(
    soloOcultos.every((c) => c.estado === "oculto"),
    "el filtro por estado funciona",
  );

  // Los votos sobreviven a la baja
  await repo.votar(nuevo.id, "otro-user", 1);
  const trasVoto = await repo.listarParaModeracion({ notaSlug: "plan-bacheo-integral" });
  ok(
    trasVoto.find((c) => c.id === nuevo.id)?.likes === 1,
    "los votos siguen colgando del comentario oculto",
  );

  // Restitucion
  const vuelto = await repo.restituir(nuevo.id, "admin-1");
  ok(vuelto?.estado === "publicado", "restituir() lo republica");
  ok(vuelto?.ocultadoPor === undefined, "restituir() limpia el rastro de baja");
  const visibleOtraVez = await repo.listar("plan-bacheo-integral", "u-test");
  ok(
    visibleOtraVez.some((c) => c.id === nuevo.id),
    "listar() lo vuelve a mostrar",
  );

  // Ids que no existen
  ok((await repo.darDeBaja("no-existe", "admin-1")) === null, "darDeBaja() de un id inexistente da null");
  ok((await repo.restituir("no-existe", "admin-1")) === null, "restituir() de un id inexistente da null");

  return fallos;
}
