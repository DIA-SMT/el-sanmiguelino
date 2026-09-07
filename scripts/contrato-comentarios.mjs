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
 *
 * @param repo el motor a verificar.
 * @param notas dos slugs de notas que EXISTAN en ese motor. Los defaults son
 *   los del archivo semilla, que es lo que tiene el motor en memoria.
 *
 *   Hay que poder elegirlos porque en Postgres `comentarios.notaSlug` es una
 *   clave externa contra `notas.slug`: los slugs del mock no están en la base
 *   —la edición en la calle es otra, y desde que hay facsímiles las notas son
 *   páginas de un PDF—, así que el contrato se caía en el primer `crear()` sin
 *   llegar a verificar nada. El runner de Postgres pasa dos notas de verdad.
 */
export async function correrContrato(
  repo,
  notas = ["plan-bacheo-integral", "septiembre-musical"],
) {
  let fallos = 0;
  const ok = (cond, msg) => {
    console.log(`${cond ? "  ok  " : " FALLA"} ${msg}`);
    if (!cond) fallos++;
  };

  const [NOTA, OTRA_NOTA] = notas;

  // Un comentario nuevo, en una nota conocida
  const nuevo = await repo.crear({
    notaSlug: NOTA,
    usuarioId: "u-test",
    usuarioNombre: "Vecino de prueba",
    texto: "Comentario de prueba para moderacion",
  });
  ok(nuevo.estado === "publicado", "crear() nace publicado");

  const visibleAntes = await repo.listar(NOTA, "u-test");
  ok(
    visibleAntes.some((c) => c.id === nuevo.id),
    "listar() lo muestra mientras esta publicado",
  );

  // Se da de baja
  const bajado = await repo.darDeBaja(nuevo.id, "admin-1", "prueba");
  ok(bajado?.estado === "oculto", "darDeBaja() lo pone oculto");
  ok(bajado?.ocultadoPor === "admin-1", "queda el rastro de quien lo bajo");
  ok(typeof bajado?.ocultadoEn === "string", "queda el rastro de cuando");

  const visibleDespues = await repo.listar(NOTA, "u-test");
  ok(
    !visibleDespues.some((c) => c.id === nuevo.id),
    "listar() ya no lo muestra",
  );

  // El punto fino: ultimoDeEdicion tambien tiene que filtrarlo.
  // Primero hay que probar que la asercion no es vacia: el comentario recien
  // creado es el mas nuevo de la edicion, asi que ANTES de la baja tiene que
  // ser justamente el que ultimoDeEdicion() devuelve. Sin este control, "no lo
  // destaca" pasaria igual aunque el filtro no existiera.
  const slugs = [NOTA, OTRA_NOTA];
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
    notaSlug: NOTA,
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
  const trasVoto = await repo.listarParaModeracion({ notaSlug: NOTA });
  ok(
    trasVoto.find((c) => c.id === nuevo.id)?.likes === 1,
    "los votos siguen colgando del comentario oculto",
  );

  // Restitucion
  const vuelto = await repo.restituir(nuevo.id, "admin-1");
  ok(vuelto?.estado === "publicado", "restituir() lo republica");
  ok(vuelto?.ocultadoPor === undefined, "restituir() limpia el rastro de baja");
  const visibleOtraVez = await repo.listar(NOTA, "u-test");
  ok(
    visibleOtraVez.some((c) => c.id === nuevo.id),
    "listar() lo vuelve a mostrar",
  );

  // --- En revisión -------------------------------------------------------
  // El estado intermedio: sale del diario pero todavía no hay decisión, así
  // que no lleva motivo. Lo que se verifica es lo que el lector NO tiene que
  // ver: un comentario en revisión no puede seguir publicado ni quedar
  // destacado en la tapa.
  const enRevision = await repo.enviarARevision(nuevo.id, "admin-1");
  ok(enRevision?.estado === "en_revision", "enviarARevision() lo pone en revision");
  ok(enRevision?.ocultadoPor === "admin-1", "queda el rastro de quien lo mando a revisar");
  ok(
    enRevision?.motivoBaja === undefined,
    "en revision no hay motivo todavia: la decision no esta tomada",
  );
  const durante = await repo.listar(NOTA, "u-test");
  ok(
    !durante.some((c) => c.id === nuevo.id),
    "listar() no lo muestra mientras esta en revision",
  );
  const tapaEnRevision = await repo.ultimoDeEdicion(slugs, "u-test");
  ok(
    tapaEnRevision?.id !== nuevo.id,
    "ultimoDeEdicion() no lo destaca en portada estando en revision",
  );
  const paraModerar = await repo.listarParaModeracion({ estado: "en_revision" });
  ok(
    paraModerar.some((c) => c.id === nuevo.id),
    "listarParaModeracion({estado:'en_revision'}) lo encuentra",
  );

  // --- Borrado definitivo ------------------------------------------------
  // Sólo se puede borrar lo que ya está de baja, y la regla vive en el repo:
  // primero se baja —lo que deja escrito quién y por qué— y recién después se
  // borra. Desde 'en revision' tiene que negarse.
  ok(
    (await repo.eliminar(nuevo.id, "admin-1")) === "no-estaba-de-baja",
    "eliminar() se niega si el comentario no esta de baja",
  );
  await repo.darDeBaja(nuevo.id, "admin-1", "Insulto o agresión");
  const conMotivo = await repo.listarParaModeracion({ notaSlug: NOTA });
  ok(
    conMotivo.find((c) => c.id === nuevo.id)?.motivoBaja === "Insulto o agresión",
    "el motivo tipificado queda guardado tal cual",
  );
  const borrado = await repo.eliminar(nuevo.id, "admin-1");
  ok(
    borrado !== null && borrado !== "no-estaba-de-baja" && borrado.id === nuevo.id,
    "eliminar() devuelve el comentario que se llevo",
  );
  const trasBorrar = await repo.listarParaModeracion({ notaSlug: NOTA });
  ok(
    !trasBorrar.some((c) => c.id === nuevo.id),
    "eliminar() lo saca hasta de la lista de moderacion",
  );
  ok(
    (await repo.votar(nuevo.id, "otro-user", 1)) === null,
    "los votos de un comentario borrado se van con el",
  );

  // Ids que no existen
  ok((await repo.darDeBaja("no-existe", "admin-1")) === null, "darDeBaja() de un id inexistente da null");
  ok((await repo.restituir("no-existe", "admin-1")) === null, "restituir() de un id inexistente da null");
  ok((await repo.enviarARevision("no-existe", "admin-1")) === null, "enviarARevision() de un id inexistente da null");
  ok((await repo.eliminar("no-existe", "admin-1")) === null, "eliminar() de un id inexistente da null");

  return fallos;
}
