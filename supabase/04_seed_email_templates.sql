-- ============================================================
-- Padel@Home - Seed: plantillas de correo (email_templates)
-- Extraídas del código fuente: 11 llamadas sendEmail → 7 claves únicas.
-- Ejecutar en: Supabase Dashboard > SQL Editor o vía psql
-- Idempotente: usa INSERT ... ON CONFLICT DO UPDATE
-- ============================================================

INSERT INTO public.email_templates (key, name, subject, html_template) VALUES

-- 1. Confirmación de reserva (bookingController.js — con .ics adjunto)
(
  'booking.confirm',
  'Confirmación de Reserva',
  'Confirmación de Reserva en Padel@Home para el {{date}}',
  '<h3>¡Hola, {{userName}}!</h3><p>Tu reserva ha sido confirmada. Adjuntamos un evento de calendario.</p>'
),

-- 2. Hueco liberado en lista de espera (bookingController + cronController + checkWaitingList)
(
  'waitlist.slot',
  'Hueco Liberado — Lista de Espera',
  '¡Un hueco se ha liberado en Padel@Home!',
  '<h3>¡Hola, {{userName}}!</h3><p>Se ha liberado el horario por el que estabas esperando ({{slotTime}}).</p><p>Tienes <strong>30 minutos</strong> para confirmar la reserva haciendo clic en el siguiente enlace. Después, tu turno expirará.</p><a href="{{confirmationUrl}}">Confirmar mi Reserva</a>'
),

-- 3. Cancelación de partida abierta (matchController + cronController + checkOpenMatches)
(
  'match.cancel',
  'Cancelación de Partida Abierta',
  'Cancelación de Partida Abierta - Padel@Home',
  '<h3>Hola {{userName}},</h3><p>Te informamos que la partida abierta programada para el <strong>{{formattedDate}}</strong> ha sido cancelada.</p><p>{{cancelReason}}</p><p>Disculpa las molestias.</p><p>Atentamente,<br>El equipo de Padel@Home</p>'
),

-- 4. Cuenta aprobada (adminController.js — approveUser)
(
  'account.approved',
  'Cuenta Aprobada',
  '¡Tu cuenta en Padel@Home ha sido aprobada!',
  '<h3>¡Hola, {{userName}}!</h3><p>Tu cuenta ha sido aprobada. ¡Ya puedes iniciar sesión!</p>'
),

-- 5. Bienvenida — invitación con enlace de establecer contraseña (adminController.js — inviteUser)
(
  'account.welcome',
  'Bienvenida — Establecer Contraseña',
  '¡Bienvenido a Padel@Home! Establece tu contraseña',
  '<h3>¡Hola, {{userName}}!</h3><p>Un administrador te ha creado una cuenta en Padel@Home.</p><p>Por favor, haz clic en el siguiente enlace para establecer tu contraseña. El enlace es válido por 24 horas.</p><a href="{{setPasswordUrl}}">Establecer mi contraseña</a>'
),

-- 6. Restablecimiento de contraseña desde admin (adminController.js — resetUserPassword)
(
  'password.reset',
  'Restablecimiento de Contraseña (Admin)',
  'Restablecimiento de Contraseña para Padel@Home',
  '<h3>¡Hola, {{userName}}!</h3><p>Se ha solicitado un restablecimiento de contraseña para tu cuenta de Padel@Home.</p><p>Por favor, haz clic en el siguiente enlace para establecer una nueva contraseña. El enlace es válido por 24 horas.</p><a href="{{setPasswordUrl}}">Establecer nueva contraseña</a><p>Si no solicitaste este cambio, por favor ignora este correo.</p>'
),

-- 7. Restablecimiento de contraseña por usuario (authController.js — forgotPassword)
(
  'auth.password-reset',
  'Restablecer Contraseña',
  'Restablece tu contraseña de Padel@Home',
  '<h3>Hola, {{userName}}</h3><p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el siguiente enlace para crear una nueva:</p><a href="{{resetUrl}}">Restablecer Contraseña</a><p>Este enlace expirará en 30 minutos.</p>'
)

ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  subject = EXCLUDED.subject,
  html_template = EXCLUDED.html_template,
  updated_at = NOW();
