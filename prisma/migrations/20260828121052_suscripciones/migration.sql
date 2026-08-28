-- CreateTable
CREATE TABLE "suscripciones" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "edad" INTEGER,
    "email" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "usuarioId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suscripciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suscripciones_email_key" ON "suscripciones"("email");

-- CreateIndex
CREATE INDEX "suscripciones_fecha_idx" ON "suscripciones"("fecha");
