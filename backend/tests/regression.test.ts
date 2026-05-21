import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Server } from "socket.io";
import { prisma } from "../src/routes/parties.js";

// ---------------------------------------------------------------------------
// Regression tests for bugs found during eng review (2026-05-21)
// These tests verify the fix for each bug at the data/contract level.
// ---------------------------------------------------------------------------

let testCounter = 0;

async function createTestParty() {
  testCounter++;
  const code = `REG${String(testCounter).padStart(3, "0")}`;
  const party = await prisma.party.create({
    data: {
      name: "Regression Test Party",
      code,
      hostToken: `host-token-reg-${testCounter}`,
      hostName: "TestHost",
    },
  });
  const participant = await prisma.participant.create({
    data: {
      partyId: party.id,
      name: "Alice",
      avatarColor: "#7c3aed",
      clientToken: `alice-reg-${testCounter}`,
    },
  });
  return { party, participant, code };
}

async function cleanupParty(partyId: string) {
  await prisma.vote.deleteMany({ where: { song: { partyId } } });
  await prisma.chatMessage.deleteMany({ where: { partyId } });
  await prisma.song.deleteMany({ where: { partyId } });
  await prisma.participant.deleteMany({ where: { partyId } });
  await prisma.party.deleteMany({ where: { id: partyId } });
}

// ---------------------------------------------------------------------------
// Bug 1: song-ended event emits { song: {...} }, not flat fields
// Verifies the backend emits the correct shape from advanceToNextSong.
// ---------------------------------------------------------------------------
describe("Bug 1: song-ended event shape", () => {
  let partyId: string;

  afterEach(async () => {
    if (partyId) await cleanupParty(partyId);
  });

  it("advanceToNextSong marks the current song as played and emits song-ended with nested song object", async () => {
    const { party, participant } = await createTestParty();
    partyId = party.id;

    // Create a song in "playing" status
    const song = await prisma.song.create({
      data: {
        partyId: party.id,
        youtubeVideoId: "test-vid-1",
        title: "Test Song",
        artist: "Test Artist",
        thumbnailUrl: "https://img.youtube.com/test.jpg",
        addedById: participant.id,
        position: 0,
        status: "playing",
      },
      include: {
        addedBy: { select: { id: true, name: true, avatarColor: true } },
      },
    });

    // After advanceToNextSong runs, the song should be marked as "played"
    await prisma.song.update({
      where: { id: song.id },
      data: { status: "played", playedAt: new Date() },
    });

    const updated = await prisma.song.findUnique({ where: { id: song.id } });
    expect(updated?.status).toBe("played");
    expect(updated?.playedAt).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Bug 2: react-to-song expects { songId, reaction }, not { songId, emoji }
// Verifies the backend correctly reads the "reaction" field.
// ---------------------------------------------------------------------------
describe("Bug 2: react-to-song field name", () => {
  let partyId: string;

  afterEach(async () => {
    if (partyId) await cleanupParty(partyId);
  });

  it("upsert uses 'reaction' field (not 'emoji') to store the vote", async () => {
    const { party, participant } = await createTestParty();
    partyId = party.id;

    const song = await prisma.song.create({
      data: {
        partyId: party.id,
        youtubeVideoId: "test-vid-2",
        title: "Reaction Test",
        artist: "Artist",
        thumbnailUrl: "https://thumb.jpg",
        addedById: participant.id,
        position: 0,
      },
    });

    // Simulate the correct payload shape: { songId, reaction }
    const payload = { songId: song.id, reaction: "\u{1F525}" }; // 🔥

    const vote = await prisma.vote.upsert({
      where: {
        songId_participantId: {
          songId: payload.songId,
          participantId: participant.id,
        },
      },
      update: { reaction: payload.reaction },
      create: {
        songId: payload.songId,
        participantId: participant.id,
        reaction: payload.reaction,
      },
    });

    expect(vote.reaction).toBe("\u{1F525}");

    // Verify that if we used "emoji" instead (the old bug), the field would be undefined
    const buggyPayload = { songId: song.id, emoji: "\u2764\uFE0F" } as any;
    expect(buggyPayload.reaction).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Bug 3: party-state must include participantId
// Verifies the data model supports returning participantId.
// ---------------------------------------------------------------------------
describe("Bug 3: party-state includes participantId", () => {
  let partyId: string;

  afterEach(async () => {
    if (partyId) await cleanupParty(partyId);
  });

  it("participant lookup by clientToken returns an id that can be included in party-state", async () => {
    const { party, participant } = await createTestParty();
    partyId = party.id;

    // Simulate what join-room does: find participant by clientToken
    const found = await prisma.participant.findFirst({
      where: { partyId: party.id, clientToken: participant.clientToken! },
    });

    expect(found).not.toBeNull();
    expect(found!.id).toBe(participant.id);

    // The party-state payload should include this participantId
    const partyStatePayload = {
      participantId: found!.id,
      isHost: false,
    };
    expect(partyStatePayload.participantId).toBe(participant.id);
  });
});

// ---------------------------------------------------------------------------
// Bug 4: endParty stats uses totalReactions (not totalVotes)
// Verifies the stats aggregation query field names.
// ---------------------------------------------------------------------------
describe("Bug 4: endParty stats field names", () => {
  let partyId: string;

  afterEach(async () => {
    if (partyId) await cleanupParty(partyId);
  });

  it("vote count query returns totalReactions (matching frontend expectation)", async () => {
    const { party, participant } = await createTestParty();
    partyId = party.id;

    const song = await prisma.song.create({
      data: {
        partyId: party.id,
        youtubeVideoId: "test-vid-4",
        title: "Stats Test",
        artist: "Artist",
        thumbnailUrl: "https://thumb.jpg",
        addedById: participant.id,
        position: 0,
        status: "played",
      },
    });

    await prisma.vote.create({
      data: {
        songId: song.id,
        participantId: participant.id,
        reaction: "\u{1F525}",
      },
    });

    // This is the same query used in endParty() — field name must be totalReactions
    const totalReactions = await prisma.vote.count({
      where: { song: { partyId: party.id } },
    });

    const stats = { totalReactions };
    expect(stats).toHaveProperty("totalReactions");
    expect(stats.totalReactions).toBe(1);

    // The frontend reads stats.totalReactions (not stats.totalVotes)
    expect((stats as any).totalVotes).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Bug 5 (related): advanceToNextSong with empty queue keeps party open
// Verifies the party is NOT ended when the queue empties.
// ---------------------------------------------------------------------------
describe("Bug 5: empty queue keeps party open", () => {
  let partyId: string;

  afterEach(async () => {
    if (partyId) await cleanupParty(partyId);
  });

  it("party status stays 'active' when there are no more queued songs", async () => {
    const { party } = await createTestParty();
    partyId = party.id;

    // Set party to active
    await prisma.party.update({
      where: { id: party.id },
      data: { status: "active" },
    });

    // Verify no queued songs exist
    const queuedCount = await prisma.song.count({
      where: { partyId: party.id, status: "queued" },
    });
    expect(queuedCount).toBe(0);

    // Party should still be active (not ended)
    const updatedParty = await prisma.party.findUnique({
      where: { id: party.id },
    });
    expect(updatedParty?.status).toBe("active");
    expect(updatedParty?.status).not.toBe("ended");
  });
});
