import { SONG_STATUS_ORDER } from "../constants/party.js";
import { prisma } from "../models/db.js";
import { toSongData } from "../models/song.js";
import { buildLeaderboard } from "../services/leaderboard.js";
import { rooms } from "./state.js";

export async function emitPartyState(
  socket: {
    emit: (event: string, payload: unknown) => void;
  },
  partyCode: string,
  participantId: string,
  clientToken: string
): Promise<void> {
  const party = await prisma.party.findUnique({ where: { code: partyCode } });
  if (!party) return;

  const [participants, songs, chatMessages, leaderboard] = await Promise.all([
    prisma.participant.findMany({
      where: { partyId: party.id },
      select: { id: true, name: true, avatarColor: true, isConnected: true },
    }),
    prisma.song.findMany({
      where: { partyId: party.id },
      include: {
        addedBy: { select: { id: true, name: true, avatarColor: true } },
      },
    }),
    prisma.chatMessage.findMany({
      where: { partyId: party.id },
      include: {
        participant: { select: { id: true, name: true, avatarColor: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    buildLeaderboard(party.id),
  ]);

  const songData = songs.map((song) => toSongData(song));
  songData.sort((a, b) => {
    const orderDiff = (SONG_STATUS_ORDER[a.status] ?? 1) - (SONG_STATUS_ORDER[b.status] ?? 1);
    if (orderDiff !== 0) return orderDiff;
    return a.position - b.position;
  });

  const roomState = rooms.get(partyCode);

  socket.emit("party-state", {
    party: {
      name: party.name,
      code: party.code,
      status: party.status,
      maxSongsPerPerson: party.maxSongsPerPerson,
      maxUsers: party.maxUsers,
      maxDurationMinutes: party.maxDurationMinutes,
      addMode: party.addMode,
      hostName: party.hostName,
    },
    participantId,
    participants,
    songs: songData,
    chatMessages: chatMessages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      type: msg.type,
      createdAt: msg.createdAt,
      participant: msg.participant,
    })),
    currentSong: roomState?.currentSong ?? null,
    playbackOffset: roomState?.startedAt ? Date.now() - roomState.startedAt : 0,
    isHost: clientToken === party.hostToken,
  });

  socket.emit("leaderboard-updated", leaderboard);
}

