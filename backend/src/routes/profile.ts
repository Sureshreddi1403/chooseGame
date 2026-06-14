import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase";

const router = Router();

/* ─────────────────────────────────────────────────
   GET /api/profile/:userId
   Returns the profile for a given user ID.
   Public fields only if the profile is discoverable.
───────────────────────────────────────────────── */
router.get("/:userId", async (req: Request, res: Response) => {
  const { userId } = req.params;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, username, first_name, last_name, bio, skill_level, sport_preferences, rating, player_lat, player_lng, player_location_label, city, state, phone_number, is_discoverable, gender, handedness, created_at"
    )
    .eq("id", userId)
    .single();

  if (error || !data) {
    return res.status(404).json({ success: false, message: "Profile not found." });
  }

  return res.json({ success: true, data });
});

/* ─────────────────────────────────────────────────
   PUT /api/profile
   Updates the authenticated user's own profile.
   Body: { userId, bio, skill_level, sport_preferences,
           player_lat, player_lng, player_location_label,
           is_discoverable }
   (Option A: userId passed in body, validated via service-role)
───────────────────────────────────────────────── */
router.put("/", async (req: Request, res: Response) => {
  const {
    userId,
    bio,
    skill_level,
    sport_preferences,
    player_lat,
    player_lng,
    player_location_label,
    city,
    state,
    phone_number,
    is_discoverable,
  } = req.body as {
    userId?: string;
    bio?: string;
    skill_level?: string;
    sport_preferences?: string[];
    player_lat?: number | null;
    player_lng?: number | null;
    player_location_label?: string;
    city?: string;
    state?: string;
    phone_number?: string;
    is_discoverable?: boolean;
  };

  if (!userId) {
    return res.status(400).json({ success: false, message: "userId is required." });
  }

  const updatePayload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (bio !== undefined)                   updatePayload["bio"] = bio;
  if (skill_level !== undefined)           updatePayload["skill_level"] = skill_level;
  if (sport_preferences !== undefined)     updatePayload["sport_preferences"] = sport_preferences;
  if (player_lat !== undefined)            updatePayload["player_lat"] = player_lat;
  if (player_lng !== undefined)            updatePayload["player_lng"] = player_lng;
  if (player_location_label !== undefined) updatePayload["player_location_label"] = player_location_label;
  if (city !== undefined)                  updatePayload["city"] = city;
  if (state !== undefined)                 updatePayload["state"] = state;
  if (phone_number !== undefined)          updatePayload["phone_number"] = phone_number;
  if (is_discoverable !== undefined)       updatePayload["is_discoverable"] = is_discoverable;

  const { data, error } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", userId)
    .select()
    .single();

  if (error) {
    console.error("[PUT /api/profile]", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }

  return res.json({ success: true, data });
});

export default router;
