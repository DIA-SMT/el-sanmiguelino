-- AlterTable
ALTER TABLE "ediciones" ADD COLUMN     "pdfUrl" TEXT,
ADD COLUMN     "pdfPaginas" INTEGER;

-- AlterTable
ALTER TABLE "notas" ADD COLUMN     "pdfPagina" INTEGER;
