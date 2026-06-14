import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase";

const router = Router();

/* ── POST /api/challenges
   Create a new challenge
*/
router.post("/", async (req: Request, res: Response) => {
  const { sender_id, receiver_id, sport, message } = req.body;

  if (!sender_id || !receiver_id || !sport) {
    return res.status(400).json({ success: false, message: "Missing required fields." });
  }

  const { data, error } = await supabase
    .from("player_challenges")
    .insert([
      {
        sender_id,
        receiver_id,
        sport,
        message,
        status: "pending",
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("[POST /api/challenges]", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }

  return res.json({ success: true, data });
});

/* ── GET /api/challenges/received
   Get challenges received by the given user
*/
router.get("/received", async (req: Request, res: Response) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ success: false, message: "userId is required." });
  }

  // Join with sender profile info
  const { data, error } = await supabase
    .from("player_challenges")
    .select(`
      id, sport, message, status, created_at,
      sender_id,
      profiles!player_challenges_sender_id_fkey(id, username, first_name, last_name, rating, player_location_label)
    `)
    .eq("receiver_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[GET /api/challenges/received]", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }

  return res.json({ success: true, data });
});

/* ── GET /api/challenges/sent
   Get challenges sent by the given user
*/
router.get("/sent", async (req: Request, res: Response) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ success: false, message: "userId is required." });
  }

  // Join with receiver profile info
  const { data, error } = await supabase
    .from("player_challenges")
    .select(`
      id, sport, message, status, created_at,
      receiver_id,
      profiles!player_challenges_receiver_id_fkey(id, username, first_name, last_name, rating, player_location_label)
    `)
    .eq("sender_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[GET /api/challenges/sent]", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }

  return res.json({ success: true, data });
});

/* ── PUT /api/challenges/:id/status
   Update the status of a challenge
*/
router.put("/:id/status", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, userId } = req.body;

  if (!status || !['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status." });
  }

  if (!userId) {
    return res.status(400).json({ success: false, message: "userId is required." });
  }

  // Verify the user is the receiver
  const { data: challenge, error: getError } = await supabase
    .from("player_challenges")
    .select("receiver_id, status")
    .eq("id", id)
    .single();

  if (getError || !challenge) {
    return res.status(404).json({ success: false, message: "Challenge not found." });
  }

  if (challenge.receiver_id !== userId) {
    return res.status(403).json({ success: false, message: "Only the receiver can update the status." });
  }

  if (challenge.status !== 'pending') {
    return res.status(400).json({ success: false, message: "Challenge is already resolved." });
  }

  const { data, error } = await supabase
    .from("player_challenges")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[PUT /api/challenges/status]", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }

  return res.json({ success: true, data });
});

export default router;
