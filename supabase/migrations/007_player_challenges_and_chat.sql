-- Migration 007: Player challenges and chat system

-- ============================================================
-- PLAYER CHALLENGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.player_challenges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sport       VARCHAR(100) NOT NULL,
  message     TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_challenges_sender ON public.player_challenges(sender_id);
CREATE INDEX IF NOT EXISTS idx_challenges_receiver ON public.player_challenges(receiver_id);

-- Enable RLS
ALTER TABLE public.player_challenges ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view challenges involving them"
  ON public.player_challenges FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create challenges as sender"
  ON public.player_challenges FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update challenge status"
  ON public.player_challenges FOR UPDATE
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

-- ============================================================
-- CHAT MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id  UUID NOT NULL REFERENCES public.player_challenges(id) ON DELETE CASCADE,
  sender_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_chat_challenge ON public.chat_messages(challenge_id);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies
-- We only allow chat on an accepted challenge. The backend will enforce this rule,
-- but the RLS ensures that you must be part of the challenge to view/send messages.
CREATE POLICY "Users can view messages for their challenges"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.player_challenges pc
      WHERE pc.id = chat_messages.challenge_id
      AND (pc.sender_id = auth.uid() OR pc.receiver_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert messages to their challenges"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.player_challenges pc
      WHERE pc.id = challenge_id
      AND (pc.sender_id = auth.uid() OR pc.receiver_id = auth.uid())
      AND pc.status = 'accepted'
    )
  );
