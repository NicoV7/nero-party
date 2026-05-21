import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { env } from "./env.js";
import partyRouter from "./routes/parties.js";
import searchRouter from "./routes/search.js";
import setupSocketHandlers from "./socket/handlers.js";

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN,
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 2e6, // 2MB for image uploads (stretch goal)
});

app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Party routes
app.use("/api/parties", partyRouter);

// YouTube search proxy
app.use("/api/search", searchRouter);

// Socket.IO handlers
setupSocketHandlers(io);

// Serve built frontend static files in production/Docker
const frontendDist = path.resolve(__dirname, "../../frontend/dist");
app.use(express.static(frontendDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

server.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT}`);
});

// Startup API key validation (non-blocking)
(async () => {
  try {
    if (!env.YOUTUBE_API_KEY) {
      console.warn(
        "WARNING: YOUTUBE_API_KEY is not set. YouTube search will not work."
      );
    } else {
      // Quick test search to verify the key works
      const params = new URLSearchParams({
        part: "snippet",
        q: "test",
        type: "video",
        maxResults: "1",
        key: env.YOUTUBE_API_KEY,
      });
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?${params}`
      );
      if (res.status === 403) {
        console.warn(
          "WARNING: YouTube Data API v3 returned 403. The API may not be enabled for your key. Enable it at: https://console.cloud.google.com/apis/library/youtube.googleapis.com"
        );
      } else if (!res.ok) {
        console.warn(
          `WARNING: YouTube API test returned ${res.status} ${res.statusText}`
        );
      }
    }

    if (!env.GEMINI_API_KEY) {
      console.warn(
        "WARNING: GEMINI_API_KEY is not set. AI features will not work."
      );
    }
  } catch (_err) {
    // Never crash on startup validation
  }
})();
