import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase";

const router = Router();

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// GET /api/venues  -> returns active venues, optionally filtered by location
router.get("/", async (req: Request, res: Response) => {
  const { lat, lng, radiusKm } = req.query;
  const radius = Number(radiusKm ?? 10);

  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ success: false, message: error.message });

  let venues = data || [];

  if (lat && lng) {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isNaN(latitude) && !Number.isNaN(longitude)) {
      venues = venues
        .map((venue: any) => ({
          ...venue,
          distance: venue.latitude && venue.longitude
            ? distanceKm(latitude, longitude, Number(venue.latitude), Number(venue.longitude))
            : null,
        }))
        .filter((venue: any) => venue.distance === null || venue.distance <= radius)
        .sort((a: any, b: any) => (a.distance ?? 999999) - (b.distance ?? 999999));
    }
  }

  return res.json({ success: true, data: venues });
});

export default router;
