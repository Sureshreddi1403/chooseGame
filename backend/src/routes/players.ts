import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase";

const router = Router();

/* ── Haversine distance ── */
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* GET /api/players
   Query params:
   - sport   (e.g. "basketball") — optional, filters sport_preferences contains sport
   - lat     — caller's latitude  (for distance calculation)
   - lng     — caller's longitude
   - radiusKm — default 50
*/
router.get("/", async (req: Request, res: Response) => {
  const { sport, lat, lng, radiusKm } = req.query as Record<string, string | undefined>;
  const radius = Number(radiusKm ?? 50);

  // Base query — only discoverable profiles with a location set
  let query = supabase
    .from("profiles")
    .select(
      "id, username, bio, skill_level, sport_preferences, rating, player_lat, player_lng, player_location_label"
    )
    .eq("is_discoverable", true)
    .not("player_lat", "is", null)
    .not("player_lng", "is", null);

  const { data, error } = await query;

  if (error) {
    console.error("[GET /api/players]", error.message);
    return res.status(500).json({ success: false, message: error.message });
  }

  let players = (data ?? []) as any[];

  // Filter by sport preference (server-side because Supabase array contains is awkward with JS)
  if (sport && sport !== "all") {
    players = players.filter(
      (p) => Array.isArray(p.sport_preferences) && p.sport_preferences.includes(sport)
    );
  }

  // Attach distance and filter by radius if caller location given
  if (lat && lng) {
    const userLat = Number(lat);
    const userLng = Number(lng);
    if (!Number.isNaN(userLat) && !Number.isNaN(userLng)) {
      players = players
        .map((p) => ({
          ...p,
          distanceKm: distanceKm(userLat, userLng, Number(p.player_lat), Number(p.player_lng)),
        }))
        .filter((p) => p.distanceKm <= radius)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    }
  }

  return res.json({ success: true, data: players });
});

export default router;
