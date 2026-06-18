-- Migration 009: System messages for chat events (challenge accepted / rejected)
-- Run this in the Supabase SQL Editor before deploying this feature.

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS is_system  BOOLEAN  NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS event_type TEXT;

-- Allow sender_id to be NULL for system messages (previously NOT NULL may be implied)
-- Supabase default allows nulls unless a constraint was added; this is a safety guard.
ALTER TABLE public.chat_messages
  ALTER COLUMN sender_id DROP NOT NULL;
