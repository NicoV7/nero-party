import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const env = {
  PORT: process.env.PORT || 3000,
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY || "",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  OLLAMA_URL: process.env.OLLAMA_URL || "",
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || "llama3",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
};
