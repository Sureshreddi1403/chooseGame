import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  const {
    profile_id,
    sport_name,
    requested_date,
    requested_time,
    latitude,
    longitude,
    radius_km,
  } = req.body;

  if (!profile_id) {
    return res.status(400).json({ success: false, message: "profile_id is required." });
  }

  if (!requested_date || !requested_time) {
    return res.status(400).json({ success: false, message: "Requested date and time are required." });
  }

  const request = {
    profile_id,
    sport_name: sport_name || null,
    requested_date,
    requested_time,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    radius_km: Number(radius_km ?? 10),
  };

  const { data, error } = await supabase.from("play_requests").insert(request).select().single();

  if (error) {
    console.error("Failed to create play request:", error);
    return res.status(500).json({ success: false, message: error.message });
  }

  return res.status(201).json({ success: true, data });
});

export default router;
