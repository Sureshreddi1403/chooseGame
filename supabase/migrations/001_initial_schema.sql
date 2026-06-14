-- MultiSport App — Initial Supabase Schema
-- Run in Supabase SQL Editor: https://supabase.com/dashboard

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name  VARCHAR(60)  NOT NULL,
  last_name   VARCHAR(60)  NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  avatar_url  TEXT,
  city        VARCHAR(100),
  state       VARCHAR(2),
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- SPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  slug        VARCHAR(100) NOT NULL UNIQUE,
  icon_url    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.sports (name, slug) VALUES
  ('Basketball',  'basketball'),
  ('Pickleball',  'pickleball'),
  ('Soccer',      'soccer'),
  ('Tennis',      'tennis'),
  ('Volleyball',  'volleyball'),
  ('Baseball',    'baseball'),
  ('Swimming',    'swimming'),
  ('Golf',        'golf')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- VENUES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.venues (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  address_line1 VARCHAR(255) NOT NULL,
  city          VARCHAR(100) NOT NULL,
  state         VARCHAR(2)   NOT NULL,
  zip_code      VARCHAR(10)  NOT NULL,
  latitude      DECIMAL(10, 7),
  longitude     DECIMAL(10, 7),
  phone         VARCHAR(20),
  image_url     TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_venues_city_state ON public.venues(city, state);

-- ============================================================
-- VENUE SPORTS (many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.venue_sports (
  venue_id  UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  sport_id  UUID NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  PRIMARY KEY (venue_id, sport_id)
);

-- ============================================================
-- TRAINERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trainers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sport_id      UUID NOT NULL REFERENCES public.sports(id),
  bio           TEXT,
  hourly_rate   DECIMAL(8, 2),
  is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PICKUP GAMES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.games (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id      UUID NOT NULL REFERENCES public.sports(id),
  venue_id      UUID REFERENCES public.venues(id),
  host_id       UUID NOT NULL REFERENCES public.profiles(id),
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  scheduled_at  TIMESTAMPTZ NOT NULL,
  max_players   INT NOT NULL DEFAULT 10,
  skill_level   VARCHAR(50) DEFAULT 'all',
  is_open       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- GAME PARTICIPANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.game_participants (
  game_id     UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_id, profile_id)
);

-- ============================================================
-- VENUE BOOKINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bookings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      UUID NOT NULL REFERENCES public.venues(id),
  profile_id    UUID NOT NULL REFERENCES public.profiles(id),
  sport_id      UUID NOT NULL REFERENCES public.sports(id),
  booked_at     TIMESTAMPTZ NOT NULL,
  duration_mins INT NOT NULL DEFAULT 60,
  total_price   DECIMAL(8, 2),
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Profiles: users read/update own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Public read for sports and venues
CREATE POLICY "Anyone can view sports"
  ON public.sports FOR SELECT USING (TRUE);

CREATE POLICY "Anyone can view active venues"
  ON public.venues FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Anyone can view venue sports"
  ON public.venue_sports FOR SELECT USING (TRUE);

CREATE POLICY "Anyone can view active trainers"
  ON public.trainers FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Anyone can view open games"
  ON public.games FOR SELECT USING (is_open = TRUE);

CREATE POLICY "Users can view own bookings"
  ON public.bookings FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can create bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (auth.uid() = profile_id);
