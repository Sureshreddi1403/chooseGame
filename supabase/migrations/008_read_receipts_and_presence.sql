-- Migration 008: Read receipts & user presence
-- Run this in the Supabase SQL Editor or via psql

-- ============================================================
-- READ RECEIPTS (watermark approach)
-- Each row = "user X has read all messages up to this timestamp in challenge Y"
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_read_receipts (
  challenge_id  UUID NOT NULL REFERENCES public.player_challenges(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (challenge_id, user_id)
);

-- RLS
ALTER TABLE public.chat_read_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view read receipts for their challenges"
  ON public.chat_read_receipts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.player_challenges pc
      WHERE pc.id = chat_read_receipts.challenge_id
      AND (pc.sender_id = auth.uid() OR pc.receiver_id = auth.uid())
    )
  );

CREATE POLICY "Users can upsert their own read receipt"
  ON public.chat_read_receipts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own read receipt"
  ON public.chat_read_receipts FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================
-- USER PRESENCE (last-seen heartbeat)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id       UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read presence (we filter in application code)
CREATE POLICY "Authenticated users can view presence"
  ON public.user_presence FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can upsert their own presence"
  ON public.user_presence FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presence"
  ON public.user_presence FOR UPDATE
  USING (auth.uid() = user_id);
