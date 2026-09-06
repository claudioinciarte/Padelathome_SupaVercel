-- Padel@Home - Prueba de JWT propio + RLS para Supabase Realtime
-- Ejecutar SOLO después de configurar el JWT secret de Supabase igual que
-- JWT_SECRET del backend. Este script no contiene secretos.
--
-- El JWT emitido por la aplicación debe incluir:
--   sub       = ID numérico del usuario como texto
--   user_id   = ID numérico del usuario
--   role      = authenticated
--   app_role  = user | admin
--
-- El backend usa la conexión PostgreSQL del propietario y seguirá funcionando;
-- las consultas directas con anon/authenticated quedarán sujetas a estas reglas.

CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.jwt() ->> 'user_id', '')::bigint;
$$;

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.jwt() ->> 'app_role', '');
$$;

-- Activar RLS en las tablas expuestas por postgres_changes.
ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiting_list_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_messages ENABLE ROW LEVEL SECURITY;

-- El script es repetible.
DROP POLICY IF EXISTS "authenticated users can read active courts" ON public.courts;
DROP POLICY IF EXISTS "admins can read all courts" ON public.courts;
CREATE POLICY "authenticated users can read active courts"
  ON public.courts FOR SELECT TO authenticated
  USING (is_active = true OR public.current_app_role() = 'admin');

DROP POLICY IF EXISTS "users can read visible bookings" ON public.bookings;
CREATE POLICY "users can read visible bookings"
  ON public.bookings FOR SELECT TO authenticated
  USING (
    user_id = public.current_app_user_id()
    OR is_open_match = true
    OR public.current_app_role() = 'admin'
  );

DROP POLICY IF EXISTS "users can read visible match participants" ON public.match_participants;
CREATE POLICY "users can read visible match participants"
  ON public.match_participants FOR SELECT TO authenticated
  USING (
    user_id = public.current_app_user_id()
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = match_participants.booking_id
        AND (b.user_id = public.current_app_user_id()
             OR b.is_open_match = true
             OR public.current_app_role() = 'admin')
    )
  );

DROP POLICY IF EXISTS "authenticated users can read blocked periods" ON public.blocked_periods;
CREATE POLICY "authenticated users can read blocked periods"
  ON public.blocked_periods FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "users can read own waiting list entries" ON public.waiting_list_entries;
CREATE POLICY "users can read own waiting list entries"
  ON public.waiting_list_entries FOR SELECT TO authenticated
  USING (user_id = public.current_app_user_id() OR public.current_app_role() = 'admin');

DROP POLICY IF EXISTS "match participants can read match messages" ON public.match_messages;
CREATE POLICY "match participants can read match messages"
  ON public.match_messages FOR SELECT TO authenticated
  USING (
    user_id = public.current_app_user_id()
    OR public.current_app_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.match_participants mp
      WHERE mp.booking_id = match_messages.booking_id
        AND mp.user_id = public.current_app_user_id()
    )
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = match_messages.booking_id
        AND b.user_id = public.current_app_user_id()
    )
  );

-- Asegurar que las tablas usadas por el frontend están en la publicación.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'courts', 'bookings', 'match_participants', 'blocked_periods',
    'waiting_list_entries', 'match_messages'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = table_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
END;
$$;

-- Necesario para que UPDATE/DELETE puedan evaluarse correctamente cuando
-- Realtime debe conocer la fila anterior completa.
ALTER TABLE public.courts REPLICA IDENTITY FULL;
ALTER TABLE public.bookings REPLICA IDENTITY FULL;
ALTER TABLE public.match_participants REPLICA IDENTITY FULL;
ALTER TABLE public.blocked_periods REPLICA IDENTITY FULL;
ALTER TABLE public.waiting_list_entries REPLICA IDENTITY FULL;
ALTER TABLE public.match_messages REPLICA IDENTITY FULL;
