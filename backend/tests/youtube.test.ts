import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the env module before importing the service
vi.mock("../src/env.js", () => ({
  env: {
    YOUTUBE_API_KEY: "test-api-key",
  },
}));

import { searchSong, searchMultipleSongs } from "../src/services/youtube.js";
import { env } from "../src/env.js";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
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

describe("searchMultipleSongs", () => {
  it("filters out failed and empty results", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 2) {
        // Second call returns empty results (searchSong returns null)
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ items: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                id: { videoId: `vid-${callCount}` },
                snippet: {
                  title: `Song ${callCount}`,
                  thumbnails: { high: { url: `https://thumb-${callCount}.jpg` } },
                },
              },
            ],
          }),
      });
    });

    const results = await searchMultipleSongs([
      { title: "Song A", artist: "Artist A" },
      { title: "Song B", artist: "Artist B" },
      { title: "Song C", artist: "Artist C" },
    ]);

    // Second returns null (empty items), others succeed → 2 results
    expect(results).toHaveLength(2);
    results.forEach((r) => {
      expect(r).toHaveProperty("videoId");
      expect(r).toHaveProperty("title");
      expect(r).toHaveProperty("artist");
      expect(r).toHaveProperty("thumbnailUrl");
    });
  });

  it("handles all failures gracefully", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("All broken"));

    const results = await searchMultipleSongs([
      { title: "Song A", artist: "Artist A" },
      { title: "Song B", artist: "Artist B" },
    ]);

    // All requests fail, but searchMultipleSongs uses Promise.allSettled,
    // and searchSong catches errors and returns null. So all are fulfilled with null.
    expect(results).toHaveLength(0);
  });
});
