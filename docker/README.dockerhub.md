# 🎾 Padel@Home — Imagen Docker

Sistema de reservas de pistas de pádel para comunidades residenciales. PWA instalable con reservas privadas, partidas abiertas con chat en tiempo real (Socket.IO), lista de espera con confirmación por email y panel de administración.

Esta imagen ejecuta la aplicación en **modo persistente** (`server.js`): servidor HTTP + Socket.IO + cron jobs internos (node-cron), con su **propio PostgreSQL** incluido vía docker-compose. Es una instancia **autónoma e independiente** de la nube (Vercel/Supabase).

- **Arquitecturas**: `linux/amd64` y `linux/arm64` (Raspberry Pi incluidas)
- **Base**: Node.js 20 (Debian bookworm-slim)
- **Imagen**: `pocholin/padelathome:latest` · `pocholin/padelathome:v1.0.0`

---

## 🚀 Instalación rápida (recomendada: docker compose)

### 1. Crea el directorio y los archivos

```bash
mkdir padelathome && cd padelathome
curl -O https://raw.githubusercontent.com/claudioinciarte/Padelathome_SupaVercel/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/claudioinciarte/Padelathome_SupaVercel/main/.env.docker.example
cp .env.docker.example .env
```

### 2. Rellena el `.env`

Genera dos secretos y edita el archivo:

```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 32   # CRON_SECRET
```

Variables obligatorias (el compose **no arranca** sin ellas):

| Variable | Descripción |
|---|---|
| `JWT_SECRET` | Secreto para firmar tokens de sesión. Genera: `openssl rand -hex 32` |
| `CRON_SECRET` | Secreto de los endpoints de cron. Genera: `openssl rand -hex 32` |
| `POSTGRES_PASSWORD` | Contraseña del Postgres local del contenedor |

### 3. Arranca

```bash
docker compose up -d
```

En el primer arranque se crea el esquema y el usuario administrador. Espera a que pase el healthcheck (30–60 s):

```bash
curl http://localhost:3000/api/health
# {"status":"ok",...}
```

**Acceso inicial** → http://localhost:3000
- **Email**: `admin@padelathome.local`
- **Password**: `admin`
- ⚠️ **Cambia la contraseña en el primer login** (Perfil → Cambiar contraseña).

---

## 🐳 Instalación solo con `docker run` (sin compose)

Si quieres usar la imagen sin docker-compose, necesitas un PostgreSQL accesible (o montar uno aparte):

```bash
docker run -d --name padelathome \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e DB_SSL=false \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e CRON_SECRET="$(openssl rand -hex 32)" \
  -e APP_URL="http://localhost:3000" \
  -e SMTP_HOST="smtp.gmail.com" \
  -e SMTP_PORT=587 \
  -e SMTP_SECURE=false \
  -e SMTP_USER="tu-email@gmail.com" \
  -e SMTP_PASSWORD="tu-app-password" \
  -e SMTP_FROM_NAME="Padel@Home" \
  -e TZ="Europe/Madrid" \
  --restart unless-stopped \
  pocholin/padelathome:latest
```

> Con `docker run` solo la app: el esquema SQL lo debes cargar tú en la BD (`supabase/01_schema.sql` + `03_seed_clean.sql` del repositorio). El compose ya lo hace automáticamente.

---

## 📋 Variables de entorno (todas)

| Variable | Obligatoria | Default | Descripción |
|---|---|---|---|
| `PORT` | no | `3000` | Puerto interno del servidor |
| `DATABASE_URL` | sí* | — | Cadena de conexión PostgreSQL (`postgresql://user:pass@host:5432/db`) |
| `DB_SSL` | no | `true` | `false` para Postgres local sin SSL |
| `DB_POOL_MAX` | no | `5` | Tamaño del pool de conexiones |
| `JWT_SECRET` | **sí** | — | Secreto JWT (`openssl rand -hex 32`) |
| `CRON_SECRET` | **sí** | — | Secreto endpoints cron (`openssl rand -hex 32`) |
| `SMTP_HOST` | no | `smtp.gmail.com` | Servidor SMTP |
| `SMTP_PORT` | no | `587` | Puerto SMTP |
| `SMTP_SECURE` | no | `false` | `true` si el puerto es 465 (SSL directo) |
| `SMTP_USER` | no | — | Usuario SMTP (email) |
| `SMTP_PASSWORD` | no | — | App Password SMTP |
| `SMTP_FROM_NAME` | no | `Padel@Home` | Remitente de los correos |
| `APP_URL` | no | `http://localhost:3000` | URL pública (enlaces de los emails) |
| `VAPID_PUBLIC_KEY` | no | — | Clave pública Web Push (`npx web-push generate-vapid-keys`) |
| `VAPID_PRIVATE_KEY` | no | — | Clave privada Web Push |
| `VAPID_SUBJECT` | no | `mailto:...` | Contacto Web Push |
| `TZ` | no | `Europe/Madrid` | Zona horaria del calendario |

\* Con docker-compose la `DATABASE_URL` se construye sola apuntando al servicio `db` — solo rellena `POSTGRES_PASSWORD`.

---

## 💾 Persistencia de datos (IMPORTANTE)

Los datos viven en el **volumen Docker `pgdata`** (con compose) — **no dentro del contenedor**. Esto significa que sobreviven a:

- ✅ Reinicios del contenedor (`docker restart`)
- ✅ Recreaciones (`docker compose down && docker compose up -d`)
- ✅ Actualizaciones de imagen (`docker compose pull && docker compose up -d`)
- ✅ Cambios de host

El esquema SQL se ejecuta **solo la primera vez** que el volumen se crea. Si borras el volumen (`docker compose down -v`) **pierdes todos los datos** — es el único caso.

### Backup y restauración

```bash
# Backup
docker compose exec -T db pg_dump -U padel padelathome > backup_$(date +%F).sql

# Restaurar (en un volumen nuevo, tras el primer arranque)
docker compose exec -T db psql -U padel -d padelathome < backup.sql
```

### Cron de backup recomendado (host)

```bash
# Añade a crontab del host: copia diaria del dump
0 4 * * * cd /ruta/padelathome && docker compose exec -T db pg_dump -U padel padelathome > backups/padel_$(date +\%F).sql
```

---

## ⚙️ Cron jobs internos

El contenedor ejecuta automáticamente (node-cron, cada 30 min):

| Job | Qué hace |
|---|---|
| Limpieza de partidas incompletas | Cancela partidas abiertas sin jugadores suficientes y notifica por email |
| Lista de espera | Procesa turnos expirados y notifica al siguiente de la cola |

No requiere configuración adicional.

---

## 🔄 Actualizar a una versión nueva

```bash
docker compose pull && docker compose up -d
```

La imagen se reconstruye automáticamente **una vez al mes** (workflow de GitHub Actions) y manualmente cuando se publica una release. Los datos del volumen no se tocan.

---

## 🧪 Healthcheck

El contenedor expone `GET /api/health`:

```bash
curl http://localhost:3000/api/health
# {"status":"ok","timestamp":"..."}
```

---

## 🆘 Troubleshooting

| Síntoma | Causa / solución |
|---|---|
| `app` se reinicia en bucle | Espera al healthcheck de `db`; revisa `docker compose logs app` |
| `JWT_SECRET is required` | Falta rellenar `JWT_SECRET` en el `.env` |
| No llegan correos | Revisa `SMTP_USER`/`SMTP_PASSWORD` (App Password de Gmail, no la contraseña normal) |
| Login falla con `admin` pelado | Usa el email completo: `admin@padelathome.local` |
| Quiero resetear todo | `docker compose down -v` (⚠️ **borra TODOS los datos**) y `docker compose up -d` |

---

## 🔒 Notas de seguridad

- Cambia la contraseña del admin (`admin` / `admin`) en el primer login.
- Usa `JWT_SECRET` y `CRON_SECRET` largos y únicos (`openssl rand -hex 32`).
- No expongas el puerto 3000 a Internet sin HTTPS por delante (recomendado: Caddy/nginx + dominio).

---

## 📦 Fuente

- Repositorio: https://github.com/claudioinciarte/Padelathome_SupaVercel
- Documentación completa del proyecto (arquitectura, API, despliegue Vercel): `README.md` del repositorio.
