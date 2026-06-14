-- Migration 006: Player profile fields for player discovery dashboard
-- Run this in your Supabase SQL Editor

-- 1. Add new columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio                   TEXT,
  ADD COLUMN IF NOT EXISTS skill_level           VARCHAR(20)
    CHECK (skill_level IN ('beginner', 'intermediate', 'advanced', 'pro')),
  ADD COLUMN IF NOT EXISTS sport_preferences     TEXT[],
  ADD COLUMN IF NOT EXISTS player_lat            DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS player_lng            DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS player_location_label TEXT,
  ADD COLUMN IF NOT EXISTS is_discoverable       BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Index to speed up discovery queries
CREATE INDEX IF NOT EXISTS idx_profiles_discoverable ON public.profiles(is_discoverable)
  WHERE is_discoverable = TRUE;

-- 3. Allow any user to view discoverable profiles (for the Players Dashboard)
DROP POLICY IF EXISTS "Anyone can view discoverable profiles" ON public.profiles;
CREATE POLICY "Anyone can view discoverable profiles"
  ON public.profiles FOR SELECT
  USING (is_discoverable = TRUE OR auth.uid() = id);

-- 4. Allow users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
