-- CreateTable
CREATE TABLE "consultas_migue" (
    "id" TEXT NOT NULL,
    "pregunta" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "notaSlug" TEXT,
    "contextoSlug" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultas_migue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consultas_migue_resultado_fecha_idx" ON "consultas_migue"("resultado", "fecha");
