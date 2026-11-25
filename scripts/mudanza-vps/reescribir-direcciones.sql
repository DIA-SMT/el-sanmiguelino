-- Las direcciones de los archivos, de Supabase al depósito del servidor.
--
-- Se corre UNA vez, sobre la base ya copiada a la VPS (ver docs/servidor.md):
--
--   sudo -u postgres psql -v ON_ERROR_STOP=1 -d sanmiguelino \
--     -v origen='https://<ref>.supabase.co/storage/v1/object/public/diario/' \
--     -v sitio='https://sanmiguelino.smt.gob.ar' \
--     -f scripts/mudanza-vps/reescribir-direcciones.sql
--
-- Las páginas usan la dirección relativa (`/archivos/…`). Los correos ya
-- mandados guardan su HTML con la completa, porque un correo no tiene "sitio
-- actual". Todo en una transacción: o cambia todo, o nada. Al final cuenta
-- cuántas direcciones de Supabase quedaron, que tiene que dar cero.

BEGIN;

UPDATE notas SET "imagenSrc" = replace("imagenSrc", :'origen', '/archivos/')
  WHERE "imagenSrc" LIKE :'origen' || '%';

UPDATE notas SET cuerpo = replace(cuerpo::text, :'origen', '/archivos/')::jsonb
  WHERE cuerpo::text LIKE '%' || :'origen' || '%';

UPDATE ediciones SET "pdfUrl" = replace("pdfUrl", :'origen', '/archivos/')
  WHERE "pdfUrl" LIKE :'origen' || '%';

UPDATE boletines SET contenido = replace(contenido::text, :'origen', '/archivos/')::jsonb
  WHERE contenido::text LIKE '%' || :'origen' || '%';

UPDATE correos_salientes SET html = replace(html, :'origen', :'sitio' || '/archivos/')
  WHERE html LIKE '%' || :'origen' || '%';

SELECT
  (SELECT count(*) FROM notas WHERE "imagenSrc" LIKE '%supabase.co%' OR cuerpo::text LIKE '%supabase.co%')
  + (SELECT count(*) FROM ediciones WHERE "pdfUrl" LIKE '%supabase.co%')
  + (SELECT count(*) FROM boletines WHERE contenido::text LIKE '%supabase.co%')
  + (SELECT count(*) FROM correos_salientes WHERE html LIKE '%supabase.co%')
  AS "quedan_direcciones_de_supabase";

COMMIT;
