-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'lector',
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "ultimoIngreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cambiadoPor" TEXT,
    "cambiadoEn" TIMESTAMP(3),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usuarios_ultimoIngreso_idx" ON "usuarios"("ultimoIngreso");
