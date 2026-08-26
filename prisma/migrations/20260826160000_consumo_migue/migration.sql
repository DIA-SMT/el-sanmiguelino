-- CreateTable
CREATE TABLE "consumo_migue" (
    "clave" TEXT NOT NULL,
    "ventana" TIMESTAMP(3) NOT NULL,
    "consultas" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "consumo_migue_pkey" PRIMARY KEY ("clave","ventana")
);

-- CreateIndex
CREATE INDEX "consumo_migue_ventana_idx" ON "consumo_migue"("ventana");
