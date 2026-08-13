-- ============================================================
-- Padel@Home - Esquema de base de datos para Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- El script es idempotente: elimina y recrea todo el esquema.
-- ATENCIÓN: borra los datos existentes de estas tablas.
-- ============================================================

-- Limpiar objetos existentes (en orden inverso de dependencias)
DROP TABLE IF EXISTS public.match_messages CASCADE;
DROP TABLE IF EXISTS public.match_participants CASCADE;
DROP TABLE IF EXISTS public.waiting_list_entries CASCADE;
DROP TABLE IF EXISTS public.password_reset_tokens CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.blocked_periods CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.courts CASCADE;
DROP TABLE IF EXISTS public.buildings CASCADE;
DROP TABLE IF EXISTS public.instance_settings CASCADE;
DROP TYPE IF EXISTS public.account_status_enum CASCADE;
DROP TYPE IF EXISTS public.booking_status_enum CASCADE;
DROP TYPE IF EXISTS public.user_role_enum CASCADE;
DROP FUNCTION IF EXISTS public.trigger_set_timestamp() CASCADE;

-- --- TIPOS ENUMERADOS ---
CREATE TYPE public.account_status_enum AS ENUM (
    'pending_approval',
    'active',
    'inactive'
);

CREATE TYPE public.booking_status_enum AS ENUM (
    'confirmed',
    'cancelled_by_user',
    'cancelled_by_admin'
);

CREATE TYPE public.user_role_enum AS ENUM (
    'user',
    'admin'
);

-- --- FUNCIÓN TRIGGER updated_at ---
CREATE FUNCTION public.trigger_set_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- --- TABLA buildings ---
CREATE TABLE public.buildings (
    id bigint NOT NULL,
    address character varying(255) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE SEQUENCE public.buildings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.buildings_id_seq OWNED BY public.buildings.id;

-- --- TABLA courts ---
CREATE TABLE public.courts (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE SEQUENCE public.courts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.courts_id_seq OWNED BY public.courts.id;

-- --- TABLA users ---
CREATE TABLE public.users (
    id bigint NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    floor character varying(50),
    door character varying(50),
    phone_number character varying(50),
    role public.user_role_enum DEFAULT 'user'::public.user_role_enum NOT NULL,
    account_status public.account_status_enum DEFAULT 'pending_approval'::public.account_status_enum NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    building_id bigint,
    is_active boolean DEFAULT true,
    is_approved boolean DEFAULT false
);

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

-- --- TABLA bookings ---
CREATE TABLE public.bookings (
    id bigint NOT NULL,
    court_id bigint NOT NULL,
    user_id bigint NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    status public.booking_status_enum DEFAULT 'confirmed'::public.booking_status_enum NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_open_match boolean DEFAULT false NOT NULL,
    max_participants integer,
    auto_cancel_hours_before integer
);

CREATE SEQUENCE public.bookings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.bookings_id_seq OWNED BY public.bookings.id;

-- --- TABLA match_participants ---
CREATE TABLE public.match_participants (
    id bigint NOT NULL,
    booking_id bigint NOT NULL,
    user_id bigint NOT NULL,
    joined_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE SEQUENCE public.match_participants_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.match_participants_id_seq OWNED BY public.match_participants.id;

-- --- TABLA match_messages (chat de partidas) ---
CREATE TABLE public.match_messages (
    id bigint NOT NULL,
    booking_id bigint NOT NULL,
    user_id bigint NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE public.match_messages ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.match_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

-- --- TABLA waiting_list_entries ---
CREATE TABLE public.waiting_list_entries (
    id bigint NOT NULL,
    court_id bigint NOT NULL,
    user_id bigint NOT NULL,
    slot_start_time timestamp with time zone NOT NULL,
    slot_end_time timestamp with time zone NOT NULL,
    requested_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status character varying(50) DEFAULT 'waiting'::character varying NOT NULL,
    notification_sent_at timestamp with time zone,
    confirmation_token text,
    notification_expires_at timestamp with time zone
);

CREATE SEQUENCE public.waiting_list_entries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.waiting_list_entries_id_seq OWNED BY public.waiting_list_entries.id;

-- --- TABLA instance_settings ---
CREATE TABLE public.instance_settings (
    setting_key character varying(255) NOT NULL,
    setting_value text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- --- TABLA blocked_periods ---
CREATE TABLE public.blocked_periods (
    id bigint NOT NULL,
    court_id bigint NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    reason text,
    is_full_day boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE SEQUENCE public.blocked_periods_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.blocked_periods_id_seq OWNED BY public.blocked_periods.id;

-- --- TABLA password_reset_tokens ---
CREATE TABLE public.password_reset_tokens (
    token text NOT NULL,
    user_id bigint NOT NULL,
    expires_at timestamp with time zone NOT NULL
);

-- --- DEFAULTS de id ---
ALTER TABLE ONLY public.blocked_periods ALTER COLUMN id SET DEFAULT nextval('public.blocked_periods_id_seq'::regclass);
ALTER TABLE ONLY public.bookings ALTER COLUMN id SET DEFAULT nextval('public.bookings_id_seq'::regclass);
ALTER TABLE ONLY public.buildings ALTER COLUMN id SET DEFAULT nextval('public.buildings_id_seq'::regclass);
ALTER TABLE ONLY public.courts ALTER COLUMN id SET DEFAULT nextval('public.courts_id_seq'::regclass);
ALTER TABLE ONLY public.match_participants ALTER COLUMN id SET DEFAULT nextval('public.match_participants_id_seq'::regclass);
ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);
ALTER TABLE ONLY public.waiting_list_entries ALTER COLUMN id SET DEFAULT nextval('public.waiting_list_entries_id_seq'::regclass);

-- --- PRIMARY KEYS ---
ALTER TABLE ONLY public.blocked_periods ADD CONSTRAINT blocked_periods_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.bookings ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.buildings ADD CONSTRAINT buildings_address_key UNIQUE (address);
ALTER TABLE ONLY public.buildings ADD CONSTRAINT buildings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.courts ADD CONSTRAINT courts_name_key UNIQUE (name);
ALTER TABLE ONLY public.courts ADD CONSTRAINT courts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.instance_settings ADD CONSTRAINT instance_settings_pkey PRIMARY KEY (setting_key);
ALTER TABLE ONLY public.match_messages ADD CONSTRAINT match_messages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.match_participants ADD CONSTRAINT match_participants_booking_id_user_id_key UNIQUE (booking_id, user_id);
ALTER TABLE ONLY public.match_participants ADD CONSTRAINT match_participants_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.password_reset_tokens ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (token);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.waiting_list_entries ADD CONSTRAINT waiting_list_entries_court_id_user_id_slot_start_time_key UNIQUE (court_id, user_id, slot_start_time);
ALTER TABLE ONLY public.waiting_list_entries ADD CONSTRAINT waiting_list_entries_pkey PRIMARY KEY (id);

-- --- ÍNDICES ---
CREATE INDEX idx_blocked_periods_court_id ON public.blocked_periods USING btree (court_id);
CREATE INDEX idx_blocked_periods_start_time ON public.blocked_periods USING btree (start_time);
CREATE INDEX idx_bookings_court_id ON public.bookings USING btree (court_id);
CREATE INDEX idx_bookings_start_time ON public.bookings USING btree (start_time);
CREATE INDEX idx_bookings_user_id ON public.bookings USING btree (user_id);
CREATE INDEX idx_messages_booking_id ON public.match_messages USING btree (booking_id);
CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);

-- --- TRIGGERS updated_at ---
CREATE TRIGGER set_timestamp_blocked_periods BEFORE UPDATE ON public.blocked_periods FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_bookings BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_buildings BEFORE UPDATE ON public.buildings FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_courts BEFORE UPDATE ON public.courts FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_instance_settings BEFORE UPDATE ON public.instance_settings FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_users BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

-- --- FOREIGN KEYS ---
ALTER TABLE ONLY public.blocked_periods
    ADD CONSTRAINT blocked_periods_court_id_fkey FOREIGN KEY (court_id) REFERENCES public.courts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_court_id_fkey FOREIGN KEY (court_id) REFERENCES public.courts(id);

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

ALTER TABLE ONLY public.match_messages
    ADD CONSTRAINT fk_booking FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.match_messages
    ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.match_participants
    ADD CONSTRAINT match_participants_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.match_participants
    ADD CONSTRAINT match_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.waiting_list_entries
    ADD CONSTRAINT waiting_list_entries_court_id_fkey FOREIGN KEY (court_id) REFERENCES public.courts(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.waiting_list_entries
    ADD CONSTRAINT waiting_list_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ============================================================
-- Esquema creado correctamente.
-- A continuación ejecuta supabase/02_data.sql para importar los datos.
-- ============================================================
