-- ============================================================
-- Padel@Home - Seed limpio para instalaciones nuevas
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- DESPUÉS de ejecutar supabase/01_schema.sql
--
-- Crea:
--   * 1 usuario administrador (login: admin / password: admin)
--   * Ajustes por defecto de la instancia
--
-- IMPORTANTE: cambia la contraseña del admin tras el primer login
-- (perfil > Cambiar contraseña).
-- ============================================================

-- --- Usuario administrador ---
-- Email: admin@padelathome.local | Password: admin (hash bcrypt)
-- (email válido: el login del frontend exige formato email)
INSERT INTO public.users (id, email, password_hash, name, role, account_status, is_active, is_approved)
VALUES (1, 'admin@padelathome.local', '$2b$10$eYv4WYTz1DjSPuZvN43JEeUeq81A7hdyH5cW9cYCcxto3tbrdxtuS', 'Administrador', 'admin', 'active', true, true)
ON CONFLICT (id) DO NOTHING;

-- --- Ajustes por defecto ---
INSERT INTO public.instance_settings (setting_key, setting_value, description) VALUES
  ('community_name', 'Padel@Home', 'El nombre de la comunidad que se muestra en la app'),
  ('allow_public_registration', 'false', 'Permitir que cualquier usuario se registre públicamente'),
  ('operating_open_time', '08:00', 'Hora de apertura de las pistas (formato HH:MM)'),
  ('operating_close_time', '22:00', 'Hora de cierre de las pistas (formato HH:MM)'),
  ('booking_advance_days', '8', 'Número de días de antelación para reservar'),
  ('enable_booking_gap_optimization', 'true', 'Activa/desactiva la optimización de huecos'),
  ('limit_open_matches_enabled', 'true', 'Activa o desactiva el límite de partidas abiertas por usuario'),
  ('max_open_matches_per_user', '1', 'Número máximo de partidas abiertas simultáneas permitidas'),
  ('open_match_auto_cancel_hours', '2', 'Horas de antelación para cancelar partidas abiertas incompletas')
ON CONFLICT (setting_key) DO NOTHING;

-- --- Secuencia de usuarios alineada ---
SELECT setval('public.users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.users), true);

-- ============================================================
-- NOTA: crea las pistas y edificios desde el panel de administración
-- (Admin > Pistas y Admin > Edificios) tras el primer login.
-- ============================================================
