import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import venuesRoutes from "./routes/venues";
import playRequestsRoutes from "./routes/playRequests";
import playersRoutes from "./routes/players";
import profileRoutes from "./routes/profile";
import challengesRoutes from "./routes/challenges";
import chatRoutes from "./routes/chat";

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
app.use("/api/players", playersRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/challenges", challengesRoutes);
app.use("/api/chat", chatRoutes);

app.listen(PORT, () => {
  console.log(`MultiSport API running on http://localhost:${PORT}`);
});
