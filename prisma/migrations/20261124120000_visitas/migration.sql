-- Las visitas del diario: cuántas veces se abrió cada página, por día.
--
-- Sólo AGREGA una tabla nueva. No guarda quién visita: ni usuario, ni IP,
-- ni navegador. El código en producción no la usa, así que se puede aplicar
-- antes del deploy sin romper nada (y tiene que ir ANTES: Vercel no migra).
-- CreateTable
CREATE TABLE "visitas" (
    "dia" DATE NOT NULL,
    "ruta" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "visitas_pkey" PRIMARY KEY ("dia","ruta")
);

-- CreateIndex
CREATE INDEX "visitas_ruta_idx" ON "visitas"("ruta");

