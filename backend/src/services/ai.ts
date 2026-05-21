import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../env.js";

export interface AiSuggestion {
  reading: string;
  songs: Array<{ title: string; artist: string }>;
}

const SYSTEM_PROMPT =
  'You are a music curator AI for a listening party app called Nero Party. Given a mood, scenario, or description, suggest exactly 3 songs that match the vibe. Respond ONLY with valid JSON in this exact format: {"reading": "a short 5-10 word description of the vibe you\'re reading", "songs": [{"title": "Song Title", "artist": "Artist Name"}, {"title": "Song Title", "artist": "Artist Name"}, {"title": "Song Title", "artist": "Artist Name"}]}. Choose well-known, popular songs that are available on YouTube. Be creative and match the mood precisely.';

function validateSuggestion(data: unknown): data is AiSuggestion {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.reading !== "string") return false;
  if (!Array.isArray(obj.songs) || obj.songs.length !== 3) return false;
  return obj.songs.every(
    (song: unknown) =>
      typeof song === "object" &&
      song !== null &&
      typeof (song as Record<string, unknown>).title === "string" &&
      typeof (song as Record<string, unknown>).artist === "string"
  );
}

function parseJsonResponse(text: string): AiSuggestion {
  // Try direct parse first
  try {
    const parsed = JSON.parse(text);
    if (validateSuggestion(parsed)) return parsed;
  } catch {
    // fall through to regex extraction
  }

  // Try to extract JSON from the response text
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (validateSuggestion(parsed)) return parsed;
    } catch {
      // fall through to error
    }
  }

  throw new Error(`Failed to parse AI response as valid JSON: ${text}`);
}

async function suggestWithGemini(prompt: string): Promise<AiSuggestion> {
  console.log("[Gemini] Sending prompt:", prompt);

  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: SYSTEM_PROMPT,
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  console.log("[Gemini] Raw response:", text);

  return parseJsonResponse(text);
}

async function suggestWithOllama(prompt: string): Promise<AiSuggestion> {
  console.log("[Ollama] Sending prompt:", prompt);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(`${env.OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.OLLAMA_MODEL,
        prompt: `${SYSTEM_PROMPT}\n\nUser request: ${prompt}`,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Ollama API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const text: string = data.response;

    console.log("[Ollama] Raw response:", text);

    return parseJsonResponse(text);
  } finally {
    clearTimeout(timeout);
  }
}

export async function suggestSongs(prompt: string): Promise<AiSuggestion> {
  if (env.OLLAMA_URL && env.OLLAMA_URL.length > 0) {
    try {
      return await suggestWithOllama(prompt);
    } catch (error) {
      console.error("[Ollama] Failed, falling back to Gemini:", error);
    }
  }

  try {
    return await suggestWithGemini(prompt);
  } catch (error) {
    console.error("[Gemini] Failed:", error);
    throw new Error(
      `All AI providers failed. Last error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
