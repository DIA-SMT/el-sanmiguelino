-- La bandera `actual` pasa a ser una fecha de publicación.
--
-- El SQL que genera `migrate diff` hace DROP y ADD en la misma sentencia, así
-- que la edición que estaba viva se perdería: quedaría `publicaEn` en NULL y
-- el diario sin nada que servir. Los tres pasos van separados y en este orden
-- a propósito.

-- 1. La columna nueva, todavía vacía.
ALTER TABLE "ediciones" ADD COLUMN "publicaEn" TIMESTAMP(3);

-- 2. Traspasar el dato: la que estaba marcada como actual ya salió, así que se
--    le pone una fecha en el pasado. Un día atrás y no `now()` para que si en
--    el mismo minuto se carga otra edición con fecha de hoy, no queden
--    empatadas y el orden decida por azar.
UPDATE "ediciones" SET "publicaEn" = NOW() - INTERVAL '1 day' WHERE "actual" = true;

-- 3. Recién ahora se va la bandera.
ALTER TABLE "ediciones" DROP COLUMN "actual";

-- La consulta de cada request: la más reciente con fecha ya pasada.
CREATE INDEX "ediciones_publicaEn_idx" ON "ediciones"("publicaEn");
