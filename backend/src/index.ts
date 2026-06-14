import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import venuesRoutes from "./routes/venues";
import playRequestsRoutes from "./routes/playRequests";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:4200",
    credentials: true,
  })
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "multisport-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/venues", venuesRoutes);
app.use("/api/play-requests", playRequestsRoutes);

app.listen(PORT, () => {
  console.log(`MultiSport API running on http://localhost:${PORT}`);
});
