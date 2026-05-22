import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { prisma } from "../../src/models/db.js";

// ---------------------------------------------------------------------------
// 1. YouTube search proxy tests (via Express route)
// ---------------------------------------------------------------------------

describe("YouTube search proxy (/api/search)", () => {
  let app: ReturnType<typeof express>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    // Reset module registry so each test gets fresh imports
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  /**
   * Helper: build a fresh Express app with the search router.
   * Must be called *after* mocks are set up so the module picks them up.
   */
  async function buildApp() {
    const { default: searchRouter } = await import(
      "../../src/routing/search.js"
    );
    const a = express();
    a.use(express.json());
    a.use("/api/search", searchRouter);
    return a;
  }

  // --- Test 1: success -------------------------------------------------
  it("returns YouTube results with correct shape on success", async () => {
    // Mock env to have a key
    vi.doMock("../../src/env.js", () => ({
      env: {
        YOUTUBE_API_KEY: "fake-key",
      },
    }));

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: { videoId: "abc123" },
            snippet: {
              title: "Never Gonna Give You Up",
              channelTitle: "Rick Astley",
              thumbnails: { high: { url: "https://img.youtube.com/vi/abc123/hq.jpg" } },
            },
          },
          {
            id: { videoId: "def456" },
            snippet: {
              title: "Take On Me",
              channelTitle: "a-ha",
              thumbnails: { high: { url: "https://img.youtube.com/vi/def456/hq.jpg" } },
            },
          },
        ],
      }),
    } as any);

    app = await buildApp();

    const res = await request(app).get("/api/search?q=80s+hits");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);

    // Verify shape of each result
    for (const item of res.body) {
      expect(item).toHaveProperty("videoId");
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("artist");
      expect(item).toHaveProperty("thumbnailUrl");
      expect(typeof item.videoId).toBe("string");
      expect(typeof item.title).toBe("string");
      expect(typeof item.artist).toBe("string");
      expect(typeof item.thumbnailUrl).toBe("string");
    }

    expect(res.body[0].videoId).toBe("abc123");
    expect(res.body[0].title).toBe("Never Gonna Give You Up");
    expect(res.body[0].artist).toBe("Rick Astley");
  });

  // --- Test 2: 403 error -----------------------------------------------
  it("returns error mentioning 'YouTube Data API v3 is not enabled' on 403", async () => {
    vi.doMock("../../src/env.js", () => ({
      env: {
        YOUTUBE_API_KEY: "bad-key",
      },
    }));

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    } as any);

    app = await buildApp();

    const res = await request(app).get("/api/search?q=test");

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/YouTube Data API v3 is not enabled/);
  });

  // --- Test 3: empty API key -------------------------------------------
  it("returns error mentioning 'not configured' when YOUTUBE_API_KEY is empty", async () => {
    vi.doMock("../../src/env.js", () => ({
      env: {
        YOUTUBE_API_KEY: "",
      },
    }));

    app = await buildApp();

    const res = await request(app).get("/api/search?q=test");

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/not configured/i);
  });

  // --- Test 4: no query param ------------------------------------------
  it("returns 400 when q parameter is missing", async () => {
    vi.doMock("../../src/env.js", () => ({
      env: {
        YOUTUBE_API_KEY: "fake-key",
      },
    }));

    app = await buildApp();

    const res = await request(app).get("/api/search");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/q/i);
  });

  // --- Test 5: XSS in query --------------------------------------------
  it("handles XSS in query safely (no injection in response)", async () => {
    vi.doMock("../../src/env.js", () => ({
      env: {
        YOUTUBE_API_KEY: "fake-key",
      },
    }));

    const xssPayload = "<script>alert(1)</script>";

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: { videoId: "safe1" },
            snippet: {
              title: "Safe Title",
              channelTitle: "Safe Channel",
              thumbnails: { high: { url: "https://img.youtube.com/vi/safe1/hq.jpg" } },
            },
          },
        ],
      }),
    } as any);

    app = await buildApp();

    const res = await request(app).get(
      `/api/search?q=${encodeURIComponent(xssPayload)}`
    );

    // Should still succeed — the query is passed to YouTube API, not injected into response
    expect(res.status).toBe(200);

    // The raw response body text must not contain unescaped script tags
    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain("<script>");
    expect(bodyText).not.toContain("</script>");
  });
});

// ---------------------------------------------------------------------------
// 2. YouTube service unit tests
// ---------------------------------------------------------------------------

describe("YouTube service", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // --- Test 6: searchSong returns null on no results --------------------
  it("searchSong returns null when YouTube returns empty items", async () => {
    vi.doMock("../../src/env.js", () => ({
      env: {
        YOUTUBE_API_KEY: "fake-key",
      },
    }));

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    } as any);

    const { searchSong } = await import("../../src/services/youtube.js");
    const result = await searchSong("Nonexistent Song", "Nobody");

    expect(result).toBeNull();
  });

});

// ---------------------------------------------------------------------------
// 3. Reaction-based voting (react-to-song) — data model tests
// ---------------------------------------------------------------------------

describe("Reaction-based voting (react-to-song)", () => {
  let partyId: string;
  let participantId: string;
  let participant2Id: string;
  let songId: string;

  // Use a unique code prefix to avoid collisions with other test files sharing the DB
  let testPartyCode: string;
  let testCounter = 0;

  beforeEach(async () => {
    testCounter++;
    testPartyCode = `RCT${String(testCounter).padStart(3, "0")}`;

    // Set up test data with a unique party code each time
    const party = await prisma.party.create({
      data: {
        name: "Reaction Test Party",
        code: testPartyCode,
        hostToken: `host-token-react-${testCounter}`,
        hostName: "TestHost",
      },
    });
    partyId = party.id;

    const participant = await prisma.participant.create({
      data: {
        partyId: party.id,
        name: "Alice",
        avatarColor: "#7c3aed",
        clientToken: `alice-token-${testCounter}`,
      },
    });
    participantId = participant.id;

    const participant2 = await prisma.participant.create({
      data: {
        partyId: party.id,
        name: "Bob",
        avatarColor: "#2563eb",
        clientToken: `bob-token-${testCounter}`,
      },
    });
    participant2Id = participant2.id;

    const song = await prisma.song.create({
      data: {
        partyId: party.id,
        youtubeVideoId: `dQw4w9WgXcQ-${testCounter}`,
        title: "Never Gonna Give You Up",
        artist: "Rick Astley",
        thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/hq.jpg",
        addedById: participantId,
        position: 0,
      },
    });
    songId = song.id;
  });

  afterEach(async () => {
    // Clean up only data for this test's party to avoid interfering with parallel test files
    if (partyId) {
      await prisma.vote.deleteMany({ where: { song: { partyId } } });
      await prisma.chatMessage.deleteMany({ where: { partyId } });
      await prisma.song.deleteMany({ where: { partyId } });
      await prisma.participant.deleteMany({ where: { partyId } });
      await prisma.party.deleteMany({ where: { id: partyId } });
    }
  });

  it("creates a reaction with a valid emoji", async () => {
    const vote = await prisma.vote.create({
      data: {
        songId,
        participantId,
        reaction: "\u{1F525}", // 🔥
      },
    });

    expect(vote).toHaveProperty("id");
    expect(vote.songId).toBe(songId);
    expect(vote.participantId).toBe(participantId);
    expect(vote.reaction).toBe("\u{1F525}");
  });

  it("stores different reaction emojis correctly", async () => {
    const reactions = ["\u{1F525}", "\u2764\uFE0F", "\u{1F610}", "\u{1F44E}"];
    // 🔥, ❤️, 😐, 👎

    // Create a song for each reaction to avoid unique constraint
    for (let i = 0; i < reactions.length; i++) {
      const s = await prisma.song.create({
        data: {
          partyId,
          youtubeVideoId: `vid-${i}`,
          title: `Song ${i}`,
          artist: `Artist ${i}`,
          thumbnailUrl: `https://thumb-${i}.jpg`,
          addedById: participantId,
          position: i + 1,
        },
      });

      const vote = await prisma.vote.create({
        data: {
          songId: s.id,
          participantId,
          reaction: reactions[i],
        },
      });

      expect(vote.reaction).toBe(reactions[i]);
    }
  });

  it("enforces uniqueness per participant+song (one reaction per person per song)", async () => {
    // First reaction succeeds
    await prisma.vote.create({
      data: {
        songId,
        participantId,
        reaction: "\u{1F525}", // 🔥
      },
    });

    // Second reaction from same participant on same song should fail
    await expect(
      prisma.vote.create({
        data: {
          songId,
          participantId,
          reaction: "\u2764\uFE0F", // ❤️
        },
      })
    ).rejects.toThrow();
  });

  it("allows different participants to react to the same song", async () => {
    const vote1 = await prisma.vote.create({
      data: {
        songId,
        participantId,
        reaction: "\u{1F525}", // 🔥
      },
    });

    const vote2 = await prisma.vote.create({
      data: {
        songId,
        participantId: participant2Id,
        reaction: "\u2764\uFE0F", // ❤️
      },
    });

    expect(vote1.participantId).toBe(participantId);
    expect(vote2.participantId).toBe(participant2Id);
    expect(vote1.songId).toBe(vote2.songId);

    // Both reactions should be retrievable
    const allVotes = await prisma.vote.findMany({ where: { songId } });
    expect(allVotes).toHaveLength(2);
  });

  it("allows updating a reaction (upsert pattern)", async () => {
    // Create initial reaction
    const initial = await prisma.vote.create({
      data: {
        songId,
        participantId,
        reaction: "\u{1F525}", // 🔥
      },
    });
    expect(initial.reaction).toBe("\u{1F525}");

    // Update to a different reaction
    const updated = await prisma.vote.update({
      where: { id: initial.id },
      data: { reaction: "\u{1F44E}" }, // 👎
    });
    expect(updated.reaction).toBe("\u{1F44E}");
    expect(updated.id).toBe(initial.id);
  });

  it("allows toggling off a reaction by deleting", async () => {
    const vote = await prisma.vote.create({
      data: {
        songId,
        participantId,
        reaction: "\u{1F525}", // 🔥
      },
    });

    await prisma.vote.delete({ where: { id: vote.id } });

    const remaining = await prisma.vote.findMany({
      where: { songId, participantId },
    });
    expect(remaining).toHaveLength(0);
  });

  it("computes net score from reaction scores correctly", async () => {
    // Reaction scores: 🔥=3, ❤️=2, 😐=0, 👎=-1
    const REACTION_SCORES: Record<string, number> = {
      "\u{1F525}": 3,
      "\u2764\uFE0F": 2,
      "\u{1F610}": 0,
      "\u{1F44E}": -1,
    };

    // Alice reacts with 🔥 (score +3)
    await prisma.vote.create({
      data: { songId, participantId, reaction: "\u{1F525}" },
    });

    // Bob reacts with 👎 (score -1)
    await prisma.vote.create({
      data: { songId, participantId: participant2Id, reaction: "\u{1F44E}" },
    });

    const votes = await prisma.vote.findMany({ where: { songId } });
    const netScore = votes.reduce(
      (sum, v) => sum + (REACTION_SCORES[v.reaction] ?? 0),
      0
    );

    // 3 + (-1) = 2
    expect(netScore).toBe(2);
  });

  it("can look up a participant's existing reaction via the unique compound key", async () => {
    await prisma.vote.create({
      data: { songId, participantId, reaction: "\u2764\uFE0F" },
    });

    const existing = await prisma.vote.findUnique({
      where: {
        songId_participantId: {
          songId,
          participantId,
        },
      },
    });

    expect(existing).not.toBeNull();
    expect(existing!.reaction).toBe("\u2764\uFE0F");
  });

  it("returns null when looking up a non-existent reaction", async () => {
    const existing = await prisma.vote.findUnique({
      where: {
        songId_participantId: {
          songId,
          participantId,
        },
      },
    });

    expect(existing).toBeNull();
  });
});
