-- Migration 003: Add profile gender/rating, username, phone, and play request tables

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username VARCHAR(60) UNIQUE,
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS handedness VARCHAR(10) CHECK (handedness IN ('left', 'right')),
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gender VARCHAR(32),
  ADD COLUMN IF NOT EXISTS rating INT CHECK (rating >= 1 AND rating <= 5);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

CREATE TABLE IF NOT EXISTS public.play_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sport_name     VARCHAR(100),
  requested_date DATE NOT NULL,
  requested_time TIME NOT NULL,
  latitude       DECIMAL(10, 7),
  longitude      DECIMAL(10, 7),
  radius_km      INT NOT NULL DEFAULT 10,
  status         VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'closed')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.play_notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  play_request_id UUID NOT NULL REFERENCES public.play_requests(id) ON DELETE CASCADE,
  profile_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notified_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed'))
);

ALTER TABLE public.play_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own play requests"
  ON public.play_requests FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can view their own play requests"
  ON public.play_requests FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert pending notifications"
  ON public.play_notifications FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can view their own notifications"
  ON public.play_notifications FOR SELECT
  USING (auth.uid() = profile_id);
