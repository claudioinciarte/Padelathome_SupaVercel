# Padel@Home

Sistema de reservas de pistas de pádel para comunidades residenciales. PWA instalable con reservas privadas, partidas abiertas con chat, lista de espera con confirmación por email y panel de administración.

- **Backend**: Node.js + Express (serverless en Vercel)
- **Base de datos**: Supabase (PostgreSQL gestionado)
- **Frontend**: HTML/CSS/JS vanilla + Tailwind CSS (build estático)
- **Email**: nodemailer vía SMTP (Gmail App Password)
- **Cron jobs**: endpoints HTTP `/api/cron/*` llamados por GitHub Actions
- **Tiempo real**: Socket.IO en despliegues persistentes; REST + polling en Vercel serverless

---

## Características (documentación por feature)

### 1. Autenticación y cuentas

| Endpoint | Descripción |
|---|---|
| `POST /api/auth/register` | Registro público (solo si `allow_public_registration=true`). Cuenta queda `pending_approval`. |
| `POST /api/auth/login` | Login con email/contraseña. Devuelve JWT (24 h) + datos del usuario. Bloquea cuentas inactivas/pendientes. |
| `POST /api/auth/forgot-password` | Genera token de reset (30 min) y envía email con enlace. |
| `POST /api/auth/reset-password` | Cambia la contraseña con el token del email. |
| `GET /api/auth/registration-status` | Indica si el registro público está habilitado (lee `allow_public_registration`). |

- Dos roles: `user` (residente) y `admin`.
- Estados de cuenta: `pending_approval`, `active`, `inactive`.
- Contraseñas hasheadas con **bcrypt** (cost 10).
- Los administradores crean cuentas mediante **invitación** (email con enlace de 24 h para establecer contraseña).

### 2. Perfil de usuario

| Endpoint | Descripción |
|---|---|
| `GET /api/users/me` | Perfil del usuario logueado (con dirección del edificio). |
| `PUT /api/users/me` | Actualiza nombre, planta, puerta y teléfono. |
| `PUT /api/users/change-password` | Cambia contraseña verificando la anterior. |

### 3. Calendario y disponibilidad

| Endpoint | Descripción |
|---|---|
| `GET /api/schedule/week?courtId=&date=` | Calendario semanal (lunes a domingo) con slots de 30 min. Cada slot: `available`, `booked`, `my_private_booking`, `my_open_match` (owner/participant), `open_match_available`, `open_match_full`, `blocked` o `past`; incluye `waitlistCount`. |
| `GET /api/schedule/day?courtId=&date=` | Vista de un día con duraciones disponibles (60/90 min). |
| `GET /api/schedule/availability?courtId=&date=` | Disponibilidad de un día (legacy). |

- Horarios de apertura/cierre configurables (`operating_open_time` / `operating_close_time`).
- **Zona horaria**: todos los cálculos usan `date-fns-tz` con `APP_TIMEZONE` (default `Europe/Madrid`). Necesario porque Vercel ejecuta en UTC.

### 4. Reservas

| Endpoint | Descripción |
|---|---|
| `POST /api/bookings` | Crea reserva (privada o partida abierta) con validación de solapamiento, bloqueos y límite de reservas activas. Envía email de confirmación con adjunto `.ics`. |
| `GET /api/bookings/me` | Próximas reservas/partidas activas del usuario (como dueño o participante). |
| `DELETE /api/bookings/:bookingId` | Cancela la reserva. Si hay lista de espera, notifica por email al primer usuario (token de 30 min). |

### 5. Partidas abiertas (con chat)

| Endpoint | Descripción |
|---|---|
| `GET /api/matches/open` | Partidas abiertas futuras con participantes y organizador. |
| `POST /api/matches/:bookingId/join` | Unirse (valida cupo, duplicados y dueño). |
| `DELETE /api/matches/:bookingId/leave` | Abandonar con reglas de negocio: |
| `GET /api/matches/:bookingId/participants` | Lista de participantes. |
| `GET /api/matches/:bookingId/details` | Detalle + historial de mensajes del chat. |
| `POST /api/matches/:bookingId/messages` | Enviar mensaje de chat (REST, funciona en Vercel). |

Reglas de negocio de abandono (`leaveOpenMatch`):
- Si faltan **≤ X horas** (configurable por partida, default 6): la partida se **cancela** y se notifica por email a los apuntados.
- Si el organizador abandona con más margen: el siguiente participante por antigüedad pasa a ser organizador.
- Si el organizador era el único: la partida se cancela.

**Chat**: en la Raspberry Pi funciona con Socket.IO en tiempo real (eventos `receiveMessage`, `match:updated`, `booking:cancelled`, `waitlist:*`). En Vercel serverless no hay WebSocket, por lo que el envío usa `POST /api/matches/:id/messages` y la recepción hace polling de 5 s en `match-details.js`.

### 6. Lista de espera

| Endpoint | Descripción |
|---|---|
| `GET /api/waiting-list/me` | Entradas activas del usuario (con duración). |
| `POST /api/waiting-list` | Apuntarse a un slot ocupado (máx. una por slot). |
| `DELETE /api/waiting-list` | Retirarse. |
| `POST /api/waiting-list/confirm` | Confirmar (público, por token del email). Crea la reserva si el slot sigue libre. |

Flujo: si se cancela la reserva de un slot → el primer usuario de la cola recibe un email con un enlace de confirmación válido **30 minutos**. Si no confirma, el cron job (`/api/cron/waiting-list`) marca su turno como `expired` y notifica al siguiente.

### 7. Panel de administración

Rutas bajo `/api/admin/*` (protegidas, solo rol `admin`):

- **Usuarios**: `GET /users` (filtros por estado/búsqueda), `POST /users/invite`, `PUT /users/:id/approve`, `PUT /users/:id/status`, `DELETE /users/:id`, `POST /users/:id/reset-password`, `PUT /users/:id/role`.
- **Edificios**: CRUD completo (`GET/POST/PUT/DELETE /buildings`).
- **Pistas**: CRUD completo bajo `/courts` (también existe `GET/POST/PUT /api/courts` para usuarios normales).
- **Bloqueos**: `GET/POST /blocked-periods`, `DELETE /blocked-periods/:id`.
- **Ajustes**: `GET/PUT /settings` (horarios, días de antelación, límites de partidas abiertas, registro público...).
- **Estadísticas**: `GET /stats` (reservas 30 días, top usuarios, horas pico, reservas activas, partidas abiertas, pistas disponibles).

### 8. Cron jobs (GitHub Actions)

Vercel Hobby solo permite 1 cron al día, así que las tareas se ejecutan vía **GitHub Actions** cada 30 min llamando a endpoints protegidos por el header `X-Cron-Secret`:

| Endpoint | Tarea |
|---|---|
| `POST /api/cron/open-matches-cleanup` | Cancela partidas abiertas incompletas a punto de empezar (configurable con `open_match_auto_cancel_hours`) y notifica por email. |
| `POST /api/cron/waiting-list` | Procesa turnos de lista de espera expirados y notifica al siguiente de la cola. |

Workflow: `.github/workflows/cron.yml`. Requiere los secrets `VERCEL_API_URL` y `CRON_SECRET`.

### 9. Notificaciones por email

- Confirmación de reserva con adjunto `.ics` (biblioteca `ics`).
- Invitación de usuario (establecer contraseña, 24 h).
- Aprobación de cuenta.
- Restablecimiento de contraseña (30 min).
- Hueco liberado en lista de espera (confirmación 30 min).
- Cancelación de partida abierta (por cron o abandono a última hora).

Todos los enlaces usan `APP_URL`.

### 10. PWA

- `manifest.json` + service worker (`public/service-worker.js`): estrategia **network-first** con fallback a caché para el mismo origen (solo GET no-API); las peticiones cross-origin (CDN, fuentes) y a `/api/*` pasan directas.
- Instalable en móvil/escritorio con iconos 192/512.

---

## Arquitectura

```
                    ┌──────────────────────────────┐
  Navegador (PWA) ─▶│ Vercel (serverless)          │
  public/* (estático)│  api/index.js -> src/app.js  │
                    │  rutas /api/* (Express)       │
                    └──────────────┬───────────────┘
                                   │ DATABASE_URL (IPv4)
                                   ▼
                    ┌──────────────────────────────┐
                    │ Supabase (PostgreSQL)        │
                    │ Transaction pooler :6543     │
                    │ 10 tablas + enums + triggers │
                    └──────────────────────────────┘

  GitHub Actions (cada 30 min) ──▶ POST /api/cron/* (X-Cron-Secret)

  Raspberry Pi (legacy): server.js = app + Socket.IO + node-cron + listen
```

### Modos de ejecución

- **Vercel (producción)**: `api/index.js` exporta la app Express de `src/app.js`. Sin WebSocket: el chat usa REST + polling.
- **Pi/Docker (legacy)**: `server.js` crea el servidor HTTP + Socket.IO + cron y sirve la misma app. El frontend detecta `vercel.app` y no intenta cargar socket.io.

---

## Estructura del repositorio

```
api/index.js                 → Entrypoint serverless de Vercel
src/app.js                   → App Express exportable (middlewares + rutas + estáticos)
src/config/database.js       → pg Pool (Supabase pooler, SSL, max=1, reintentos)
src/services/realtime.js     → Wrapper Socket.IO (no-op en serverless)
src/services/emailService.js → Nodemailer SMTP
src/middleware/authMiddleware.js → protect (JWT) + isAdmin
src/controllers/*.js         → Lógica de negocio por módulo
src/api/*Routes.js           → Definición de rutas (+ *.test.js)
src/api/cronRoutes.js        → Endpoints protegidos para los cron jobs
server.js                    → Modo servidor persistente (Pi/Docker)
cronJobs.js                  → node-cron local (solo modo Pi)
vercel.json                  → Builds: api (node) + public (static)
public/                      → Frontend estático (PWA)
supabase/                    → SQL: 01_schema, 02_data (producción), 03_seed_clean (admin)
tailwind/ + tailwind.config.js + postcss.config.js → Build CSS estático
.github/workflows/cron.yml   → Cron jobs cada 30 min
.env.example                 → Plantilla de variables
```

---

## Instalación limpia (Supabase + Vercel, un solo admin)

> El resultado final: una instancia con un único usuario administrador
> (**login: `admin`, password: `admin`**) y sin datos de producción.

### Requisitos previos

- Cuenta en [Supabase](https://supabase.com) y en [Vercel](https://vercel.com).
- (Opcional) Repositorio en GitHub para los cron jobs y despliegue automático.

### Paso 1 — Clonar el repositorio

```bash
git clone https://github.com/claudioinciarte/Padelathome_SupaVercel.git
cd Padelathome_SupaVercel
```

### Paso 2 — Crear la base de datos en Supabase

1. Crea un proyecto nuevo en Supabase (región cercana a tus usuarios).
2. Abre **SQL Editor** y ejecuta en orden:
   - `supabase/01_schema.sql` → crea las 10 tablas, enums, índices y triggers.
   - `supabase/03_seed_clean.sql` → crea el admin (`admin` / `admin`) y los ajustes por defecto.

   > Si quieres importar los datos de producción del proyecto original (14 usuarios, 243 reservas, etc.), ejecuta `supabase/02_data.sql` en lugar del seed limpio.
3. Apunta **Database → Connection pooling** y copia la cadena del **Transaction pooler (IPv4, puerto 6543)**:
   ```
   postgresql://postgres.<tu-proyecto>:<CONTRASEÑA>@aws-0-<region>.pooler.supabase.com:6543/postgres
   ```
   > ⚠️ Usa SIEMPRE el transaction pooler (6543): el session pooler (5432) solo admite 15 clientes simultáneos y el panel de administración dispara muchas peticiones en paralelo.

### Paso 3 — Desplegar en Vercel

1. **Importa el repositorio** en Vercel (o vincula el repo de GitHub). Vercel detectará `vercel.json` y desplegará automáticamente: API en `/api/*` y estáticos en `/`.
2. En **Settings → Environment Variables** añade (en Production, Preview y Development):

| Variable | Valor | Notas |
|---|---|---|
| `DATABASE_URL` | cadena del transaction pooler (paso 2) | Obligatoria |
| `JWT_SECRET` | cualquier secreto largo | En Vercel sin comillas. **Si lo pegas de `.env`, ojo: si contiene `#` hay que citarlo en dotenv** |
| `CRON_SECRET` | `openssl rand -hex 32` | Para los endpoints de cron |
| `SMTP_HOST` | `smtp.gmail.com` | |
| `SMTP_PORT` | `587` | |
| `SMTP_SECURE` | `false` | STARTTLS en 587 |
| `SMTP_USER` | tu email | |
| `SMTP_PASSWORD` | App Password de Gmail | 16 caracteres sin espacios |
| `SMTP_FROM_NAME` | `Padel@Home` | |
| `APP_URL` | URL de tu despliegue (ej. `https://mi-app.vercel.app`) | Enlaces de los emails |
| `APP_TIMEZONE` | `Europe/Madrid` (opcional) | Zona horaria del calendario |

3. Espera al primer deploy y comprueba: `GET https://tu-app.vercel.app/api/health` → `{"status":"ok",...}`.

### Paso 4 — Cron jobs con GitHub Actions (opcional pero recomendado)

1. En el repositorio de GitHub, añade los secrets:
   - `VERCEL_API_URL` → URL de tu app (sin barra final).
   - `CRON_SECRET` → el mismo valor que configuraste en Vercel.
2. El workflow `.github/workflows/cron.yml` se ejecutará cada 30 min automáticamente.
   - Pruébalo manualmente: *Actions → Cron Jobs → Run workflow*.

### Paso 5 — Primer login

1. Abre `https://tu-app.vercel.app/login.html`.
2. Entra con **admin / admin**.
3. **Cambia la contraseña** (perfil) y crea tus edificios y pistas desde el panel de administración.

### Paso 6 — (Opcional) Instalación local para desarrollo

```bash
cp .env.example .env   # rellena DATABASE_URL (pooler), JWT_SECRET, CRON_SECRET, SMTP_*, APP_URL
npm install            # instala deps + regenera public/tailwind.css
npm start              # servidor en http://localhost:3000 (con Socket.IO y cron local)
```

> En local el `JWT_SECRET` de `.env.example` viene entre comillas porque contiene `#` (dotenv lo truncaría).

---

## Pruebas

```bash
npm test                        # 7 suites, 47 tests (jest + supertest, todo mockeado)
TZ=Europe/Madrid npx jest --runInBand   # recomendado (el TZ importa en los tests de calendario)
```

Los tests unitarios no necesitan base de datos (se mockea `pg`). Los smoke tests contra un Supabase real se pueden repetir arrancando `node server.js` y probando los endpoints de la sección anterior.

---

## Construcción del CSS (Tailwind)

Las páginas usan clases de Tailwind **compiladas estáticamente** a `public/tailwind.css` (sin CDN). Para regenerarlas tras tocar clases en el HTML/JS:

```bash
npm run css:build     # tailwindcss -i tailwind/input.css -o public/tailwind.css --minify
```

Se ejecuta automáticamente en cada `npm install` (postinstall), por lo que cada deploy de Vercel regenera el CSS.

---

## Notas y decisiones de diseño

1. **Supabase como Postgres gestionado**: no se usa Supabase Auth ni RLS; la autenticación sigue siendo JWT + bcrypt propios (fase 2 posible: Supabase Auth + supabase-js + RLS).
2. **Transaction pooler (6543)**: imprescindible en serverless por el límite de 15 clientes del session pooler. `src/config/database.js` usa `max=1` por instancia y reintentos automáticos con backoff ante `EMAXCONNSESSION`.
3. **Zona horaria**: Vercel corre en UTC y reserva la variable `TZ`; todo el cálculo de calendario es explícito con `date-fns-tz` y `APP_TIMEZONE`.
4. **Chat sin WebSocket**: en serverless el envío es REST y la recepción es polling (5 s); en la Pi sigue funcionando Socket.IO.
5. **Cron en Vercel Hobby**: limitado a 1 vez al día → GitHub Actions cada 30 min.

---

## Proceso de creación del repositorio (historia)

| Fecha | Hito |
|---|---|
| 2025–2026 | Desarrollo original "Padel@Home" para Raspberry Pi (Docker + PostgreSQL local + node-cron + Socket.IO). Repo origen: `Inciartej86/Padelathome`. |
| 2026-08-13 | Fork de trabajo `claudioinciarte/Padelathome_SupaVercel` y fusión con los commits de la Pi (match-details, chat, notificaciones de cancelación). |
| 2026-08-13 | Migración a la nube: `src/app.js` exportable para Vercel, `api/index.js` arreglado, `vercel.json`, servicio `realtime.js` (Socket.IO opcional). |
| 2026-08-13 | Cron jobs como endpoints HTTP + workflow de GitHub Actions. |
| 2026-08-13 | Esquema (10 tablas) y datos de producción importados a Supabase desde el dump de la Pi. |
| 2026-08-13 | Tests unitarios reescritos (47/47 verdes) y smoke tests contra Supabase real (14/14). |
| 2026-08-13 | Despliegue en Vercel con variables de entorno en prod/preview/dev y secrets de GitHub. |
| 2026-08-13 | Fix zona horaria (`date-fns-tz`), fix service worker (cross-origin) y fix `EMAXCONNSESSION` (transaction pooler 6543 + reintentos). |
| 2026-08-13 | Tailwind self-hosted (build estático con PostCSS/CLI) y carga condicional de socket.io. |

Estado actual de producción (referencia): `https://padelathome-supa-vercel.vercel.app`.
