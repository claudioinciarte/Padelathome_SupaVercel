-- Padel@Home: consentimiento de registro para bases ya existentes.
-- Ejecutar una vez antes de desplegar la versión que exige consentimiento.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS privacy_policy_version character varying(32);

-- Los usuarios existentes no se marcan como consentidos retroactivamente.
-- El responsable debe decidir cómo renovar la información y registrar el consentimiento.
