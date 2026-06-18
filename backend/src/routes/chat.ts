import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase";

const router = Router();

/* ═══════════════════════════════════════════════════════════
   STATIC ROUTES (must come BEFORE /:challengeId params)
   ═══════════════════════════════════════════════════════════ */

/* ── PUT /api/chat/presence
   Heartbeat — update user's last-seen timestamp
*/
router.put("/presence", async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, message: "userId is required." });
  }

  const { error } = await supabase
    .from("user_presence")
    .upsert(
      { user_id: userId, last_seen_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("[PUT /api/chat/presence]", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }

  return res.json({ success: true });
});

/* ── GET /api/chat/presence/:userId
   Get a user's last-seen timestamp
*/
router.get("/presence/:userId", async (req: Request, res: Response) => {
  const { userId } = req.params;

  const { data, error } = await supabase
    .from("user_presence")
    .select("last_seen_at")
    .eq("user_id", userId)
    .single();

  if (error) {
    // If no row exists, user has never been seen
    return res.json({ success: true, data: { last_seen_at: null } });
  }

  return res.json({ success: true, data });
});

/* ═══════════════════════════════════════════════════════════
   PARAMETERISED ROUTES (/:challengeId)
   ═══════════════════════════════════════════════════════════ */

/* ── GET /api/chat/:challengeId
   Get messages for an accepted challenge
*/
router.get("/:challengeId", async (req: Request, res: Response) => {
  const { challengeId } = req.params;
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ success: false, message: "userId is required." });
  }

  // Check if challenge is accepted and user is part of it
  const { data: challenge, error: challengeError } = await supabase
    .from("player_challenges")
    .select("sender_id, receiver_id, status")
    .eq("id", challengeId)
    .single();

  if (challengeError || !challenge) {
    return res.status(404).json({ success: false, message: "Challenge not found." });
  }

  if (challenge.sender_id !== userId && challenge.receiver_id !== userId) {
    return res.status(403).json({ success: false, message: "Not authorized to view these messages." });
  }

  if (challenge.status !== 'accepted') {
    return res.status(403).json({ success: false, message: "Chat is only available for accepted challenges." });
  }

  // Fetch messages
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, sender_id, content, created_at")
    .eq("challenge_id", challengeId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[GET /api/chat]", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }

  return res.json({ success: true, data });
});

/* ── POST /api/chat/:challengeId
   Send a new message to a challenge thread
*/
router.post("/:challengeId", async (req: Request, res: Response) => {
  const { challengeId } = req.params;
  const { sender_id, content } = req.body;

  if (!sender_id || !content?.trim()) {
    return res.status(400).json({ success: false, message: "sender_id and content are required." });
  }

  const { data: challenge, error: challengeError } = await supabase
    .from("player_challenges")
    .select("sender_id, receiver_id, status")
    .eq("id", challengeId)
    .single();

  if (challengeError || !challenge) {
    return res.status(404).json({ success: false, message: "Challenge not found." });
  }

  if (challenge.sender_id !== sender_id && challenge.receiver_id !== sender_id) {
    return res.status(403).json({ success: false, message: "Not authorized to send messages here." });
  }

  if (challenge.status !== 'accepted') {
    return res.status(403).json({ success: false, message: "Chat is only available for accepted challenges." });
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .insert([
      {
        challenge_id: challengeId,
        sender_id,
        content: content.trim(),
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("[POST /api/chat]", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }

  return res.json({ success: true, data });
});

/* ── PUT /api/chat/:challengeId/read
   Mark messages as read — upsert the watermark timestamp
*/
router.put("/:challengeId/read", async (req: Request, res: Response) => {
  const { challengeId } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, message: "userId is required." });
  }

  const { data: challenge, error: cErr } = await supabase
    .from("player_challenges")
    .select("sender_id, receiver_id")
    .eq("id", challengeId)
    .single();

  if (cErr || !challenge) {
    return res.status(404).json({ success: false, message: "Challenge not found." });
  }

  if (challenge.sender_id !== userId && challenge.receiver_id !== userId) {
    return res.status(403).json({ success: false, message: "Not authorized." });
  }

  const { error } = await supabase
    .from("chat_read_receipts")
    .upsert(
      { challenge_id: challengeId, user_id: userId, last_read_at: new Date().toISOString() },
      { onConflict: "challenge_id,user_id" }
    );

  if (error) {
    console.error("[PUT /api/chat/read]", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }

  return res.json({ success: true });
});

/* ── GET /api/chat/:challengeId/read-status
   Get read watermarks for both users in a challenge
*/
router.get("/:challengeId/read-status", async (req: Request, res: Response) => {
  const { challengeId } = req.params;
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ success: false, message: "userId is required." });
  }

  const { data: challenge, error: cErr } = await supabase
    .from("player_challenges")
    .select("sender_id, receiver_id")
    .eq("id", challengeId)
    .single();

  if (cErr || !challenge) {
    return res.status(404).json({ success: false, message: "Challenge not found." });
  }

  if (challenge.sender_id !== userId && challenge.receiver_id !== userId) {
    return res.status(403).json({ success: false, message: "Not authorized." });
  }

  const { data, error } = await supabase
    .from("chat_read_receipts")
    .select("user_id, last_read_at")
    .eq("challenge_id", challengeId);

  if (error) {
    console.error("[GET /api/chat/read-status]", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }

  return res.json({ success: true, data: data || [] });
});

export default router;
