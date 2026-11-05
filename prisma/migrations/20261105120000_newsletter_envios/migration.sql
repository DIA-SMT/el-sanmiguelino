-- El newsletter, etapa 2: programar, enviar a la lista y seguir el envío.
--
-- Sólo AGREGA: columnas nuevas (todas opcionales) en "boletines" y la tabla de
-- la cola, "boletin_envios". Ninguna columna existente cambia ni se borra, y el
-- código que hoy está en producción no lee nada de esto: se puede aplicar
-- antes de desplegar el código nuevo sin romper el sitio. Vercel no migra:
-- esta migración va a mano y ANTES del deploy (npm run db:deploy).
--
-- La clave de "boletin_envios" es el par (newsletter, suscripción): es lo que
-- impide que alguien reciba dos veces el mismo newsletter.
-- AlterTable
ALTER TABLE "boletines" ADD COLUMN     "canceladoEn" TIMESTAMP(3),
ADD COLUMN     "canceladoPorNombre" TEXT,
ADD COLUMN     "contenido" JSONB,
ADD COLUMN     "destinatarios" INTEGER,
ADD COLUMN     "envioIniciadoEn" TIMESTAMP(3),
ADD COLUMN     "envioTerminadoEn" TIMESTAMP(3),
ADD COLUMN     "motivoCancelacion" TEXT,
ADD COLUMN     "programadoPara" TIMESTAMP(3),
ADD COLUMN     "programadoPorId" TEXT,
ADD COLUMN     "programadoPorNombre" TEXT;

-- CreateTable
CREATE TABLE "boletin_envios" (
    "boletinId" TEXT NOT NULL,
    "suscripcionId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "proximoIntento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tomadoEn" TIMESTAMP(3),
    "enviadoEn" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "boletin_envios_pkey" PRIMARY KEY ("boletinId","suscripcionId")
);

-- CreateIndex
CREATE INDEX "boletin_envios_estado_proximoIntento_idx" ON "boletin_envios"("estado", "proximoIntento");

-- CreateIndex
CREATE INDEX "boletin_envios_boletinId_estado_idx" ON "boletin_envios"("boletinId", "estado");

-- CreateIndex
CREATE INDEX "boletin_envios_suscripcionId_idx" ON "boletin_envios"("suscripcionId");

-- CreateIndex
CREATE INDEX "boletines_estado_programadoPara_idx" ON "boletines"("estado", "programadoPara");

-- AddForeignKey
ALTER TABLE "boletin_envios" ADD CONSTRAINT "boletin_envios_boletinId_fkey" FOREIGN KEY ("boletinId") REFERENCES "boletines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boletin_envios" ADD CONSTRAINT "boletin_envios_suscripcionId_fkey" FOREIGN KEY ("suscripcionId") REFERENCES "suscripciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

