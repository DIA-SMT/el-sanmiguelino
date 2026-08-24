-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "ediciones" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "etiqueta" TEXT,
    "actual" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ediciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "seccion" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "bajada" TEXT NOT NULL,
    "cuerpo" JSONB NOT NULL,
    "minutosLectura" INTEGER NOT NULL,
    "textoPlano" TEXT NOT NULL,
    "imagenSrc" TEXT,
    "imagenAlt" TEXT,
    "imagenEpigrafe" TEXT,
    "orden" INTEGER NOT NULL,
    "edicionId" TEXT NOT NULL,

    CONSTRAINT "notas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comentarios" (
    "id" TEXT NOT NULL,
    "notaSlug" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "usuarioNombre" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'publicado',
    "ocultadoPor" TEXT,
    "ocultadoEn" TIMESTAMP(3),
    "motivoBaja" TEXT,

    CONSTRAINT "comentarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votos" (
    "comentarioId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,

    CONSTRAINT "votos_pkey" PRIMARY KEY ("comentarioId","usuarioId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ediciones_slug_key" ON "ediciones"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ediciones_anio_numero_key" ON "ediciones"("anio", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "notas_slug_key" ON "notas"("slug");

-- CreateIndex
CREATE INDEX "notas_edicionId_seccion_idx" ON "notas"("edicionId", "seccion");

-- CreateIndex
CREATE UNIQUE INDEX "notas_edicionId_orden_key" ON "notas"("edicionId", "orden");

-- CreateIndex
CREATE INDEX "comentarios_notaSlug_estado_fecha_idx" ON "comentarios"("notaSlug", "estado", "fecha");

-- CreateIndex
CREATE INDEX "comentarios_estado_fecha_idx" ON "comentarios"("estado", "fecha");

-- CreateIndex
CREATE INDEX "votos_comentarioId_idx" ON "votos"("comentarioId");

-- AddForeignKey
ALTER TABLE "notas" ADD CONSTRAINT "notas_edicionId_fkey" FOREIGN KEY ("edicionId") REFERENCES "ediciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_notaSlug_fkey" FOREIGN KEY ("notaSlug") REFERENCES "notas"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votos" ADD CONSTRAINT "votos_comentarioId_fkey" FOREIGN KEY ("comentarioId") REFERENCES "comentarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
