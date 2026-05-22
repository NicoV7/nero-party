import type { Server } from "socket.io";
import { PARTY_TIMER_MS_PER_MINUTE } from "../constants/party.js";
import { prisma } from "../models/db.js";
import { toSongData, type SongData } from "../models/song.js";
import { buildFinalResults } from "../services/leaderboard.js";
import { partyTimers, rooms, type PlaybackState } from "./state.js";

export async function advanceToNextSong(io: Server, partyCode: string): Promise<void> {
  const party = await prisma.party.findUnique({ where: { code: partyCode } });
  if (!party) return;

  const roomState = rooms.get(partyCode);
  if (roomState?.currentSong) {
    io.to(partyCode).emit("song-ended", { song: roomState.currentSong });

    await prisma.song.update({
      where: { id: roomState.currentSong.id },
      data: { status: "played", playedAt: new Date() },
    });
  }

  const nextSongs = await prisma.song.findMany({
    where: { partyId: party.id, status: "queued" },
    include: {
      addedBy: { select: { id: true, name: true, avatarColor: true } },
    },
    orderBy: { position: "asc" },
  });

  const next = nextSongs[0];
  if (!next) {
    stopPlayback(io, partyCode);
    return;
  }

  await prisma.song.update({
    where: { id: next.id },
    data: { status: "playing" },
  });

  setNowPlaying(io, partyCode, toSongData({ ...next, status: "playing" }));
}

export async function endParty(io: Server, partyCode: string): Promise<void> {
  const party = await prisma.party.findUnique({ where: { code: partyCode } });
  if (!party) return;

  await prisma.party.update({
    where: { id: party.id },
    data: { status: "ended" },
  });

  const timer = partyTimers.get(partyCode);
  if (timer) {
    clearTimeout(timer);
    partyTimers.delete(partyCode);
  }

  const [songResults, totalSongs, totalParticipants, totalReactions] = await Promise.all([
    buildFinalResults(party.id),
    prisma.song.count({ where: { partyId: party.id } }),
    prisma.participant.count({ where: { partyId: party.id } }),
    prisma.vote.count({ where: { song: { partyId: party.id } } }),
  ]);

  io.to(partyCode).emit("party-ended", {
    winner: songResults[0] ?? null,
    songResults,
    stats: { totalSongs, totalParticipants, totalReactions },
  });

  rooms.delete(partyCode);
}

export async function startPlayback(
  io: Server,
  partyCode: string,
  song: SongData
): Promise<void> {
  const party = await prisma.party.findUnique({ where: { code: partyCode } });
  if (!party) return;

  await prisma.song.update({
    where: { id: song.id },
    data: { status: "playing" },
  });

  setNowPlaying(io, partyCode, { ...song, status: "playing" });

  if (party.status !== "waiting") return;

  await prisma.party.update({
    where: { id: party.id },
    data: { status: "active" },
  });

  const timer = setTimeout(() => {
    void endParty(io, partyCode);
  }, party.maxDurationMinutes * PARTY_TIMER_MS_PER_MINUTE);
  partyTimers.set(partyCode, timer);
}

export async function playPreviousSong(io: Server, partyCode: string, partyId: string): Promise<boolean> {
  const roomState = rooms.get(partyCode);
  const prevSong = await prisma.song.findFirst({
    where: { partyId, status: "played" },
    orderBy: { playedAt: "desc" },
    include: {
      addedBy: { select: { id: true, name: true, avatarColor: true } },
    },
  });

  if (!prevSong) return false;

  if (roomState?.currentSong) {
    await prisma.song.update({
      where: { id: roomState.currentSong.id },
      data: { status: "queued", playedAt: null },
    });
  }

  await prisma.song.update({
    where: { id: prevSong.id },
    data: { status: "playing", playedAt: null },
  });

  setNowPlaying(io, partyCode, toSongData({ ...prevSong, status: "playing" }));
  return true;
}

export async function playQueuedSong(
  io: Server,
  partyCode: string,
  partyId: string,
  songId: string
): Promise<SongData[] | null> {
  const song = await prisma.song.findFirst({
    where: { id: songId, partyId, status: "queued" },
    include: {
      addedBy: { select: { id: true, name: true, avatarColor: true } },
    },
  });

  if (!song) return null;

  const roomState = rooms.get(partyCode);
  if (roomState?.currentSong) {
    io.to(partyCode).emit("song-ended", { song: roomState.currentSong });
    await prisma.song.update({
      where: { id: roomState.currentSong.id },
      data: { status: "played", playedAt: new Date() },
    });
  }

  await startPlayback(io, partyCode, toSongData(song));

  const allSongs = await prisma.song.findMany({
    where: { partyId },
    include: {
      addedBy: { select: { id: true, name: true, avatarColor: true } },
    },
  });

  return allSongs.map((storedSong) => toSongData(storedSong));
}

export function restartPlayback(io: Server, partyCode: string): void {
  const roomState = rooms.get(partyCode);
  if (roomState) {
    roomState.startedAt = Date.now();
    rooms.set(partyCode, roomState);
  }

  io.to(partyCode).emit("playback-control", { action: "restart" });
}

export function setPlaybackPaused(io: Server, partyCode: string, isPaused: boolean): void {
  const roomState = rooms.get(partyCode);
  if (roomState) {
    roomState.isPlaying = !isPaused;
    rooms.set(partyCode, roomState);
  }

  io.to(partyCode).emit("playback-control", { action: isPaused ? "pause" : "resume" });
}

function setNowPlaying(io: Server, partyCode: string, song: SongData): void {
  const playbackState: PlaybackState = {
    currentSong: song,
    startedAt: Date.now(),
    isPlaying: true,
  };

  rooms.set(partyCode, playbackState);
  io.to(partyCode).emit("now-playing", {
    song: playbackState.currentSong,
    startedAt: playbackState.startedAt,
  });
}

function stopPlayback(io: Server, partyCode: string): void {
  const roomState = rooms.get(partyCode);
  if (roomState) {
    roomState.currentSong = null;
    roomState.isPlaying = false;
    roomState.startedAt = null;
  }

  io.to(partyCode).emit("playback-control", { action: "stop" });
  io.to(partyCode).emit("now-playing", { song: null });
}

