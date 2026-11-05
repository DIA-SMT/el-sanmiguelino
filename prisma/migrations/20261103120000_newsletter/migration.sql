-- El newsletter, etapa 1: estados de suscripción con doble confirmación, el
-- historial del consentimiento, los boletines que se arman en el panel y la
-- bandeja de los correos que salen (o que, en modo de prueba, habrían salido).
--
-- Sólo AGREGA: ninguna columna existente cambia ni se borra. El código que hoy
-- está en producción no lee nada de esto, así que esta migración se puede
-- aplicar antes de desplegar el código nuevo sin romper el sitio.
--
-- Las suscripciones que ya estaban quedan "pendiente": se anotaron para el
-- papel, no para recibir correos, y antes del primer envío tienen que
-- confirmar. Agregar una columna con DEFAULT constante no reescribe la tabla.

-- AlterTable
ALTER TABLE "suscripciones" ADD COLUMN     "bajaEn" TIMESTAMP(3),
ADD COLUMN     "confirmacionPedidaEn" TIMESTAMP(3),
ADD COLUMN     "confirmadaEn" TIMESTAMP(3),
ADD COLUMN     "estado" TEXT NOT NULL DEFAULT 'pendiente';

-- CreateTable
CREATE TABLE "suscripcion_eventos" (
    "id" TEXT NOT NULL,
    "suscripcionId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL,
    "via" TEXT NOT NULL,

    CONSTRAINT "suscripcion_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boletines" (
    "id" TEXT NOT NULL,
    "asunto" TEXT NOT NULL,
    "preencabezado" TEXT NOT NULL DEFAULT '',
    "introduccion" TEXT NOT NULL DEFAULT '',
    "notas" JSONB NOT NULL,
    "cierre" TEXT NOT NULL DEFAULT '',
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "autorId" TEXT NOT NULL,
    "autorNombre" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boletines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correos_salientes" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL,
    "para" TEXT NOT NULL,
    "asunto" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "error" TEXT,
    "boletinId" TEXT,
    "autorId" TEXT,

    CONSTRAINT "correos_salientes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suscripcion_eventos_suscripcionId_fecha_idx" ON "suscripcion_eventos"("suscripcionId", "fecha");

-- CreateIndex
CREATE INDEX "boletines_actualizadoEn_idx" ON "boletines"("actualizadoEn");

-- CreateIndex
CREATE INDEX "correos_salientes_fecha_idx" ON "correos_salientes"("fecha");

-- CreateIndex
CREATE INDEX "correos_salientes_tipo_fecha_idx" ON "correos_salientes"("tipo", "fecha");

-- CreateIndex
CREATE INDEX "suscripciones_estado_idx" ON "suscripciones"("estado");

-- AddForeignKey
ALTER TABLE "suscripcion_eventos" ADD CONSTRAINT "suscripcion_eventos_suscripcionId_fkey" FOREIGN KEY ("suscripcionId") REFERENCES "suscripciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Lo que ya se sabe de cada suscripción existente: cuándo se anotó y por dónde.
-- Hasta el 2026-10-30 el formulario era el del diario en papel.
INSERT INTO "suscripcion_eventos" ("id", "suscripcionId", "fecha", "tipo", "via")
SELECT 'alta_' || "id", "id", "fecha", 'alta',
       CASE WHEN "fecha" < '2026-10-30' THEN 'papel' ELSE 'formulario' END
FROM "suscripciones";
