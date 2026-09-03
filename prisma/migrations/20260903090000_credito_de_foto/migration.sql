-- Quién sacó la foto de apertura de una nota.
--
-- Va aparte del epígrafe porque no son lo mismo: uno describe qué se ve y el
-- otro dice de quién es la imagen. En el impreso el crédito va en cuerpo 6,
-- girado contra el borde de la página, y hasta ahora la digitalización lo leía
-- y no tenía dónde ponerlo, así que la autoría se perdía.
--
-- Nullable y sin default: las notas que ya existen no tienen crédito cargado y
-- eso es correcto, no es un dato que se pueda inventar.
ALTER TABLE "notas" ADD COLUMN     "imagenCredito" TEXT;
