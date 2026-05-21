import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted so the mock fn is available inside the hoisted vi.mock factories
const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

// Mock the env module
vi.mock("../src/env.js", () => ({
  env: {
    GEMINI_API_KEY: "test-gemini-key",
    OLLAMA_URL: "",
    OLLAMA_MODEL: "llama3",
  },
}));

// Mock the GoogleGenerativeAI class — define the class inside the factory
// so it is available when the hoisted mock executes
vi.mock("@google/generative-ai", () => {
  class MockGoogleGenerativeAI {
    constructor(_apiKey: string) {}
    getGenerativeModel() {
      return { generateContent: mockGenerateContent };
    }
  }
  return { GoogleGenerativeAI: MockGoogleGenerativeAI };
});

import { suggestSongs, type AiSuggestion } from "../src/services/ai.js";

beforeEach(() => {
  vi.clearAllMocks();
});

const validResponse: AiSuggestion = {
  reading: "upbeat party energy",
  songs: [
    { title: "Blinding Lights", artist: "The Weeknd" },
    { title: "Levitating", artist: "Dua Lipa" },
    { title: "Save Your Tears", artist: "The Weeknd" },
  ],
};

describe("suggestSongs", () => {
  it("returns valid AiSuggestion shape", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify(validResponse),
      },
    });

    const result = await suggestSongs("something upbeat for a party");

    expect(result).toHaveProperty("reading");
    expect(result).toHaveProperty("songs");
    expect(typeof result.reading).toBe("string");
    expect(Array.isArray(result.songs)).toBe(true);
    expect(result.songs).toHaveLength(3);
    result.songs.forEach((song) => {
      expect(song).toHaveProperty("title");
      expect(song).toHaveProperty("artist");
      expect(typeof song.title).toBe("string");
      expect(typeof song.artist).toBe("string");
    });
  });

  it("handles malformed JSON from AI with JSON extraction fallback", async () => {
    // Gemini sometimes wraps JSON in markdown code blocks
    const wrappedResponse = `Here are my suggestions:
\`\`\`json
${JSON.stringify(validResponse)}
\`\`\`
Hope you enjoy!`;

    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => wrappedResponse,
      },
    });

    const result = await suggestSongs("chill vibes");

    expect(result.reading).toBe("upbeat party energy");
    expect(result.songs).toHaveLength(3);
    expect(result.songs[0].title).toBe("Blinding Lights");
  });

  it("handles Gemini API failure gracefully", async () => {
    mockGenerateContent.mockRejectedValue(new Error("Gemini quota exceeded"));

    await expect(suggestSongs("anything")).rejects.toThrow(
      /All AI providers failed/
    );
  });

  it("validates response has exactly 3 songs", async () => {
    // Return only 2 songs -- validation should fail, causing a parse error
    const invalidResponse = {
      reading: "chill vibes",
      songs: [
        { title: "Song A", artist: "Artist A" },
        { title: "Song B", artist: "Artist B" },
      ],
    };

    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify(invalidResponse),
      },
    });

    // The validateSuggestion function requires exactly 3 songs,
    // so parseJsonResponse will throw, which gets wrapped in "All AI providers failed"
    await expect(suggestSongs("chill")).rejects.toThrow(
      /All AI providers failed/
    );
  });
});
