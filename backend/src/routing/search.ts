import { Router } from "express";
import { routeHandler, sendHttpError } from "../exceptions/http.js";
import { searchQuery } from "../services/youtube.js";

const router = Router();

// GET /api/search?q=... — proxy YouTube Data API v3 search
router.get("/", routeHandler(async (req, res) => {
  const query = req.query.q as string;
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    sendHttpError(res, 400, "Query parameter 'q' is required");
    return;
  }

  const results = await searchQuery(query.trim());
  res.json(results);
}, "Error searching YouTube:", "Search failed", { exposeErrorMessage: true }));

export default router;
