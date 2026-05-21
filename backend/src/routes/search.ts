import { Router } from "express";
import { searchQuery } from "../services/youtube.js";

const router = Router();

// GET /api/search?q=... — proxy YouTube Data API v3 search
router.get("/", async (req, res) => {
  const query = req.query.q as string;
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    res.status(400).json({ error: "Query parameter 'q' is required" });
    return;
  }

  try {
    const results = await searchQuery(query.trim());
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Search failed" });
  }
});

export default router;
