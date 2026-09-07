-- Qué hizo cada administrador en el panel.
--
-- Nace de una desaparición sin explicación: el 2026-09-07 un comentario dejó de
-- estar y no hubo dónde mirar. Con el borrado definitivo recién estrenado, eso
-- deja de ser tolerable.
--
-- Sin claves externas a propósito: el registro tiene que sobrevivir a lo que
-- describe. Una FK contra "comentarios" haría que la cascada se llevara el
-- registro del borrado en el mismo instante en que se vuelve útil.
CREATE TABLE "registro_panel" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autorId" TEXT NOT NULL,
    "autorNombre" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "objeto" TEXT NOT NULL,
    "objetoId" TEXT,
    "resumen" TEXT NOT NULL,
    "detalle" JSONB,

    CONSTRAINT "registro_panel_pkey" PRIMARY KEY ("id")
);

-- La pantalla lista lo último primero y filtra por clase de objeto.
CREATE INDEX "registro_panel_fecha_idx" ON "registro_panel"("fecha");
CREATE INDEX "registro_panel_objeto_fecha_idx" ON "registro_panel"("objeto", "fecha");
