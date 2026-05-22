import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../src/models/db.js";
import {
  addSongToQueue,
  canParticipantAddSongs,
  reorderQueuedSongs,
} from "../../src/services/songQueue.js";

async function cleanDatabase() {
  await prisma.vote.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.song.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.party.deleteMany();
}

async function createPartyWithParticipants(addMode = "everyone", maxSongsPerPerson = 5) {
  const party = await prisma.party.create({
    data: {
      name: "Queue Service Party",
      code: `QS${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      hostToken: "host-token",
      hostName: "Host",
      addMode,
      maxSongsPerPerson,
    },
  });

  const host = await prisma.participant.create({
    data: {
      partyId: party.id,
      name: "Host",
      avatarColor: "#f97316",
      clientToken: "host-token",
    },
  });

  const guest = await prisma.participant.create({
    data: {
      partyId: party.id,
      name: "Guest",
      avatarColor: "#2563eb",
      clientToken: "guest-token",
    },
  });

  return { party, host, guest };
}

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("song queue service", () => {
  it("allows everyone to add songs in everyone mode", async () => {
    const { party, guest } = await createPartyWithParticipants("everyone");

    expect(
      canParticipantAddSongs(party, {
        participantId: guest.id,
        clientToken: guest.clientToken,
      })
    ).toBe(true);
  });

  it("blocks guests from adding songs in host mode", async () => {
    const { party, guest } = await createPartyWithParticipants("host");

    expect(
      canParticipantAddSongs(party, {
        participantId: guest.id,
        clientToken: guest.clientToken,
      })
    ).toBe(false);
  });

  it("creates a sanitized song and system message", async () => {
    const { party, guest } = await createPartyWithParticipants();

    const result = await addSongToQueue(
      party,
      { participantId: guest.id, clientToken: guest.clientToken },
      {
        youtubeVideoId: "abc123",
        title: "<b>DNA.</b>",
        artist: "<script>Kendrick Lamar</script>",
        thumbnailUrl: "https://img.youtube.com/vi/abc123/mqdefault.jpg",
      }
    );

    expect("error" in result).toBe(false);
    if ("error" in result) return;

    expect(result.songData.title).toBe("DNA.");
    expect(result.songData.artist).toBe("Kendrick Lamar");
    expect(result.songData.position).toBe(0);
    expect(result.systemMessage.content).toContain("added DNA.");
  });

  it("enforces max songs per participant", async () => {
    const { party, guest } = await createPartyWithParticipants("everyone", 1);

    await addSongToQueue(
      party,
      { participantId: guest.id, clientToken: guest.clientToken },
      {
        youtubeVideoId: "first",
        title: "First",
        artist: "Artist",
        thumbnailUrl: "https://example.com/first.jpg",
      }
    );

    const result = await addSongToQueue(
      party,
      { participantId: guest.id, clientToken: guest.clientToken },
      {
        youtubeVideoId: "second",
        title: "Second",
        artist: "Artist",
        thumbnailUrl: "https://example.com/second.jpg",
      }
    );

    expect(result).toEqual({ error: "You can only add 1 songs" });
  });

  it("reorders only queued songs for the party", async () => {
    const { party, guest } = await createPartyWithParticipants();
    const first = await prisma.song.create({
      data: {
        partyId: party.id,
        youtubeVideoId: "first",
        title: "First",
        artist: "Artist",
        thumbnailUrl: "https://example.com/first.jpg",
        addedById: guest.id,
        position: 0,
      },
    });
    const second = await prisma.song.create({
      data: {
        partyId: party.id,
        youtubeVideoId: "second",
        title: "Second",
        artist: "Artist",
        thumbnailUrl: "https://example.com/second.jpg",
        addedById: guest.id,
        position: 1,
      },
    });

    await reorderQueuedSongs(party.id, [second.id, first.id]);

    const updated = await prisma.song.findMany({
      where: { partyId: party.id },
      orderBy: { position: "asc" },
    });

    expect(updated.map((song) => song.id)).toEqual([second.id, first.id]);
  });
});
