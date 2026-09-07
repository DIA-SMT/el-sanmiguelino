-- Cuándo se registró cada persona: la primera vez que entró por Cidituc.
--
-- Hasta acá la tabla sólo tenía `ultimoIngreso`, que se pisa en cada entrada.
-- Con esa sola columna el panel no podía contestar quién se sumó esta semana:
-- alguien de hace dos años que entró ayer y alguien que se registró ayer se
-- veían exactamente igual, y el listado ordenado por último ingreso barajaba el
-- padrón de nuevo cada vez que alguien abría el diario.
--
-- El default es la hora del servidor y sólo aplica a las filas nuevas; el
-- `create` del upsert de ingreso no la escribe y su `update` tampoco, así que
-- una vez puesta no se mueve más.
ALTER TABLE "usuarios" ADD COLUMN "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Las filas que ya existían no tienen fecha de alta y no se puede inventar una.
-- Se les copia su `ultimoIngreso`, que es lo único que se puede AFIRMAR: esa
-- persona ya estaba registrada ese día. Dejarles la hora de la migración habría
-- sido peor que un dato viejo — un dato falso, y encima visiblemente absurdo,
-- porque la pantalla mostraría "se registró hoy, entró hace cuatro días".
UPDATE "usuarios" SET "creadoEn" = "ultimoIngreso";

-- El orden principal del listado del panel.
CREATE INDEX "usuarios_creadoEn_idx" ON "usuarios"("creadoEn");
