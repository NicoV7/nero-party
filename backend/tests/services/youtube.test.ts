import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchSong } from "../../src/services/youtube.js";
import { env } from "../../src/env.js";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
  env.YOUTUBE_API_KEY = "test-api-key";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("searchSong", () => {
  it("throws when API key is empty", async () => {
    const originalKey = env.YOUTUBE_API_KEY;
    (env as Record<string, unknown>).YOUTUBE_API_KEY = "";

    await expect(searchSong("Bohemian Rhapsody", "Queen")).rejects.toThrow(
      /not configured/i
    );

    (env as Record<string, unknown>).YOUTUBE_API_KEY = originalKey;
  });

  it("throws on network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    await expect(searchSong("Bohemian Rhapsody", "Queen")).rejects.toThrow();
  });

  it("returns result on successful response", async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        items: [
          {
            id: { videoId: "fJ9rUzIMcZQ" },
            snippet: {
              title: "Queen - Bohemian Rhapsody (Official Video)",
              thumbnails: {
                high: { url: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg" },
              },
            },
          },
        ],
      }),
    };

    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

    const result = await searchSong("Bohemian Rhapsody", "Queen");

    expect(result).not.toBeNull();
    expect(result!.videoId).toBe("fJ9rUzIMcZQ");
    expect(result!.title).toBe("Queen - Bohemian Rhapsody (Official Video)");
    expect(result!.artist).toBe("Queen");
    expect(result!.thumbnailUrl).toBe(
      "https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg"
    );
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });
});
