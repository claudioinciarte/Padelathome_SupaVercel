# INFRAESTRUCTURA — Padel@Home

## emailService.js (src/services/emailService.js)
- Exporta `sendEmail = async ({ to, subject, html, attachments = [] })` 
- Usa nodemailer con transporter configurado por SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_NAME
- No valida nada, solo envía. Errors logged con console.error, NO lanza.
- attachments: array de { filename, content, contentType }

## database.js (src/config/database.js)
- Exporta `pool` (pg.Pool) con retry automático en query y connect
- Lee DATABASE_URL, DB_SSL, DB_POOL_MAX, DB_POOL_IDLE_TIMEOUT, DB_POOL_CONNECTION_TIMEOUT, DB_RETRIES
- pool.query y pool.connect están envueltos con withRetry (reintento ante pooler saturado)
- Para usar: `const pool = require('../config/database'); const { rows } = await pool.query(sql, params)`

## authMiddleware.js (src/middleware/authMiddleware.js)
- `protect`: extrae Bearer token, verifica con JWT_SECRET, pone req.user = { id, role, name, email }
- `isAdmin`: comprueba req.user.role === 'admin'
- Patrón de uso: `router.get('/x', protect, isAdmin, controllerFn)`

## adminRoutes.js (src/api/adminRoutes.js)
- Express Router, monta en /api/admin (ver app.js)
- Importa controladores de adminController.js
- Middleware: protect + isAdmin en TODAS las rutas
- Estructura: router.METHOD('/path', protect, isAdmin, controllerFn)
- Donde añadir endpoints nuevos: aquí mismo, mismo patrón.

## app.js (src/app.js) — estructura dual
- Express app, sirve express.static('public')
- Mounts routers:
  - /api/auth → authRoutes
  - /api/admin → adminRoutes
  - /api/bookings → bookingRoutes
  - /api/matches → matchRoutes
  - /api/courts → courtRoutes
  - /api/schedule → scheduleRoutes
  - /api/users → userRoutes
  - /api/waiting-list → waitingListRoutes
  - /api/push → pushRoutes
  - /api/cron → cronRoutes
- api/index.js (Vercel): exporta app como handler serverless
- server.js (Docker): añade socket.io (realtime) + node-cron jobs

## Schema SQL (supabase/01_schema.sql)
- 333 líneas, idempotente (DROP IF EXISTS + CREATE)
- Tablas: buildings, courts, users, bookings, match_participants, match_messages, waiting_list_entries, password_reset_tokens, instance_settings, blocked_periods, push_subscriptions
- Función trigger_set_timestamp() para updated_at
- No existe tabla email_templates — HAY QUE AÑADIRLA
- Patrón para nueva tabla: CREATE TABLE + CREATE SEQUENCE + ALTER SEQUENCE OWNED BY + ALTER COLUMN id SET DEFAULT + ADD CONSTRAINT pkey + CREATE TRIGGER updated_at

## CONTEXT_VARS propuesto (por clave de plantilla)
```
booking.confirm:       [name, courtName, date]
waitlist.slot:         [userName, confirmationUrl, slotDate]
match.cancel:          [name, formattedDate, reason, autoCancelHoursBefore, targetPlayers, maxParticipants]
account.approved:      [name]
account.welcome:       [name, setPasswordUrl]
password.reset:        [name, setPasswordUrl]
auth.password-reset:   [name, resetUrl]
```
Notas sobre match.cancel: las 3 variantes usan subconjuntos distintos. La unificación requiere decidir qué variables incluir. Propuesta: union de todas = [name, formattedDate, autoCancelHoursBefore, targetPlayers, maxParticipants, reason] donde reason es texto dinámico que explica el motivo. Alternativa más simple: un solo HTML con condicionales no es posible sin motor de plantillas. Mejor approach: usar variables {reason} y {reasonDetail} que el controller rellena con el texto apropiado.

## Cron jobs — dos implementaciones duplicadas
1. src/jobs/checkWaitingList.js — script standalone (ejecutable directo), duplica cronController.processExpiredWaitlistEntries
2. src/jobs/checkOpenMatches.js — script standalone, duplica cronController.cleanIncompleteOpenMatches
3. cronController.js — versiones HTTP (endpoints con requireCronSecret)
4. cronRoutes.js — monta los handlers HTTP
Ambos scripts standalone (jobs/) parecen ser legacy o alternativa. El refactor debe cubrir los 3 sitios.

## Archivos a tocar en el refactor (11 llamadas, 8 archivos)
1. src/controllers/bookingController.js — 2 llamadas (L141, L259)
2. src/controllers/adminController.js — 3 llamadas (L53, L94, L127)
3. src/controllers/matchController.js — 1 llamada (L161)
4. src/controllers/cronController.js — 2 llamadas (L92, L181)
5. src/controllers/authController.js — 1 llamada (L95)
6. src/jobs/checkWaitingList.js — 1 llamada (L53)
7. src/jobs/checkOpenMatches.js — 1 llamada (L48)

## Archivos a crear
- src/services/emailTemplateService.js — motor renderTemplate + CONTEXT_VARS
- supabase/04_email_templates.sql — tabla + seed (o añadir a 01_schema.sql)

## Archivos a modificar
- supabase/01_schema.sql — añadir tabla email_templates
- src/api/adminRoutes.js — 2 endpoints nuevos
- src/controllers/adminController.js — 2 handlers nuevos (getEmailTemplates, updateEmailTemplate)
- public/admin.html — pestaña Comunicaciones
- public/admin.js — lógica del editor de plantillas
