# El Sanmiguelino en el servidor propio

Desde noviembre de 2026 el diario corre en la VPS de la Dirección
(`195.35.42.168`, Ubuntu 24.04), junto con los demás proyectos, siguiendo la
guía «Migrar proyectos a la VPS». Antes estaba en Vercel, con la base y los
archivos en Supabase.

## Cómo está armado

| Qué | Dónde |
| --- | --- |
| Usuario del sistema | `sanmiguelino` (sin login por contraseña) |
| Carpeta | `/srv/sanmiguelino` (`751`), con `versiones/`, `compartido/` (`750`) y `registros/` |
| Versión en uso | `/srv/sanmiguelino/actual` → `versiones/<fecha>-<commit>` |
| Variables | `/srv/sanmiguelino/compartido/.env` (`600`), enlazado en cada versión |
| Archivos (fotos, PDF, audio) | `/srv/sanmiguelino/compartido/archivos` (`ARCHIVOS_DIR`), fuera de las versiones |
| Base | PostgreSQL 16 local, base y rol `sanmiguelino` |
| Proceso | pm2 (`pm2-sanmiguelino` en systemd), `next start -p 3011 -H 127.0.0.1` |
| Sitio | nginx `/etc/nginx/sites-available/sanmiguelino` |
| Cola del newsletter | `/etc/cron.d/newsletter-sanmiguelino`, cada minuto |
| Respaldo | `/etc/cron.d/respaldo-sanmiguelino`, 7:00, a `/srv/respaldos/sanmiguelino` |

El diario escucha **sólo en 127.0.0.1:3011**: todo entra por nginx.

## nginx: lo que este sitio necesita además de la guía

```nginx
    # El PDF del impreso pesa hasta 50 MB y se sube por acá.
    client_max_body_size 60M;

    # Digitalizar un PDF tarda hasta 5 minutos; la subida de un PDF grande
    # por una conexión municipal, también.
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;

    # Los archivos del depósito, servidos directo del disco. No cambian
    # nunca con el mismo nombre (llevan sufijo al azar o la huella del
    # texto), así que la caché puede ser de un año.
    location /archivos/ {
        alias /srv/sanmiguelino/compartido/archivos/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options nosniff;
        location ~ /\.  { return 404; }
    }
```

`/archivos/.subiendo/` (los temporales de las subidas) no se sirve: lo frena
el `location ~ /\.`.

## Desplegar una versión nueva

```bash
cd /srv/sanmiguelino
SHA=$(git ls-remote https://github.com/DIA-SMT/el-sanmiguelino.git refs/heads/main | cut -c1-7)
VER=versiones/$(date +%Y%m%d-%H%M%S)-$SHA
sudo -u sanmiguelino git clone --depth 1 https://github.com/DIA-SMT/el-sanmiguelino.git "$VER"
cd "$VER" && sudo -u sanmiguelino ln -s ../../compartido/.env .env
sudo -u sanmiguelino npm ci && sudo -u sanmiguelino npm run build
cd /srv/sanmiguelino && ln -sfn "$PWD/$VER" actual
sudo -u sanmiguelino pm2 reload sanmiguelino
```

**Si la versión trae una migración** (`prisma/migrations/` nueva), va ANTES del
`pm2 reload`, desde la carpeta de la versión nueva:

```bash
cd /srv/sanmiguelino/actual && sudo -u sanmiguelino npx prisma migrate deploy
```

Volver atrás: `ln -sfn "$PWD/versiones/LA_QUE_ANDABA" actual` y `pm2 reload`.
Se guardan las últimas tres versiones.

## Variables (`compartido/.env`)

Las mismas que tenía Vercel, salvo:

- `DATABASE_URL` y `DIRECT_URL`: la base local, sin `?pgbouncer=true`.
- `ARCHIVOS_DIR=/srv/sanmiguelino/compartido/archivos`.
- `SUPABASE_*`: no van. Sólo se usaron para bajar los archivos viejos.
- `SESSION_SECRET`: **la misma que en Vercel**. Si cambia, se cierran las
  sesiones de todos.

## La cola del newsletter

Antes la llamaba Supabase (`pg_cron`). En la VPS la llama cron, cada minuto,
con la llave de `NEWSLETTER_CRON_SECRET`:

```
# /etc/cron.d/newsletter-sanmiguelino
* * * * * sanmiguelino /srv/sanmiguelino/compartido/cola-newsletter.sh
```

**No se prende en la copia de prueba**: con la base copiada y el envío real
autorizado, le mandaría a los vecinos el mismo newsletter dos veces.

## El día del cambio de dominio

1. Avisar a la redacción: un rato sin cargar notas (lo que se cargue en el
   sitio viejo después de la copia final se pierde).
2. Copia final de la base (`pg_dump` de Supabase → restaurar) y de los
   archivos (`bajar-archivos.mjs`, que sólo baja lo nuevo), y
   `reescribir-direcciones.sql`.
3. Cambiar el DNS de `sanmiguelino.smt.gob.ar` a `195.35.42.168`.
4. Cuando resuelva: `certbot --nginx -d sanmiguelino.smt.gob.ar`, y en
   nginx agregar el dominio al `server_name`.
5. Prender la cola del newsletter en la VPS y **apagar la de Supabase**:
   `select cron.unschedule('newsletter-cola');`.
6. Probar el ingreso con Ciudad Digital (vuelve a
   `https://sanmiguelino.smt.gob.ar/auth/cidituc/callback`: no hay que pedirle
   nada a la DITEC), subir una foto y mandar una prueba del newsletter.
7. Recién entonces: apagar Vercel y rotar las claves de Supabase.
