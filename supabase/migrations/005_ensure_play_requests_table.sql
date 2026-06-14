-- Migration 005: Ensure play_requests table exists with row level security policies

CREATE TABLE IF NOT EXISTS public.play_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sport_name VARCHAR(100),
  requested_date DATE NOT NULL,
  requested_time TIME NOT NULL,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  radius_km INT NOT NULL DEFAULT 10,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.play_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own play requests" ON public.play_requests;
DROP POLICY IF EXISTS "Users can view their own play requests" ON public.play_requests;

CREATE POLICY "Users can insert their own play requests"
  ON public.play_requests FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can view their own play requests"
  ON public.play_requests FOR SELECT
  USING (auth.uid() = profile_id);
