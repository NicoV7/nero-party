import { Server, Socket } from "socket.io";
import {
  AVATAR_COLORS,
  PARTY_TIMER_MS_PER_MINUTE,
  SONG_STATUS_ORDER,
} from "../constants/party.js";
import { VALID_REACTIONS } from "../constants/reactions.js";
import type { AddSongPayload, JoinRoomPayload } from "../dto/party.js";
import { prisma } from "../models/db.js";
import { toSongData, type SongData } from "../models/song.js";
import { buildFinalResults, buildLeaderboard } from "../services/leaderboard.js";
import { sanitize } from "../services/text.js";

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

interface PlaybackState {
  currentSong: SongData | null;
  startedAt: number | null;
  isPlaying: boolean;
}

const rooms = new Map<string, PlaybackState>();
const socketParticipants = new Map<
  string,
  { participantId: string; partyCode: string; clientToken: string }
>();
const kickedParticipants = new Set<string>();
const partyTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function kickedKey(partyCode: string, clientToken: string): string {
  return `${partyCode}:${clientToken}`;
}

// ---------------------------------------------------------------------------
// Shared: advance to next song
// ---------------------------------------------------------------------------

async function advanceToNextSong(io: Server, partyCode: string): Promise<void> {
  const party = await prisma.party.findUnique({ where: { code: partyCode } });
  if (!party) return;

  const roomState = rooms.get(partyCode);

  // Emit song-ended for the song that just finished (triggers reaction toast on clients)
  if (roomState?.currentSong) {
    io.to(partyCode).emit("song-ended", { song: roomState.currentSong });

    await prisma.song.update({
      where: { id: roomState.currentSong.id },
      data: { status: "played", playedAt: new Date() },
    });
  }

  // Find next queued song — FIFO by position ASC
  const nextSongs = await prisma.song.findMany({
    where: { partyId: party.id, status: "queued" },
    include: {
      addedBy: { select: { id: true, name: true, avatarColor: true } },
    },
    orderBy: { position: "asc" },
  });

  if (nextSongs.length === 0) {
    // Queue empty — stop playback but keep the party open for more songs
    const rs = rooms.get(partyCode);
    if (rs) {
      rs.currentSong = null;
      rs.isPlaying = false;
      rs.startedAt = null;
    }
    io.to(partyCode).emit("playback-control", { action: "stop" });
    io.to(partyCode).emit("now-playing", { song: null });
    return;
  }

  const next = nextSongs[0];

  await prisma.song.update({
    where: { id: next.id },
    data: { status: "playing" },
  });

  const nextSongData = toSongData({ ...next, status: "playing" });

  const playbackState: PlaybackState = {
    currentSong: nextSongData,
    startedAt: Date.now(),
    isPlaying: true,
  };

  rooms.set(partyCode, playbackState);

  io.to(partyCode).emit("now-playing", {
    song: playbackState.currentSong,
    startedAt: playbackState.startedAt,
  });
}

// ---------------------------------------------------------------------------
// Shared: end party
// ---------------------------------------------------------------------------

async function endParty(io: Server, partyCode: string): Promise<void> {
  const party = await prisma.party.findUnique({ where: { code: partyCode } });
  if (!party) return;

  await prisma.party.update({
    where: { id: party.id },
    data: { status: "ended" },
  });

  // Clear party timer if active
  const timer = partyTimers.get(partyCode);
  if (timer) {
    clearTimeout(timer);
    partyTimers.delete(partyCode);
  }

  const songResults = await buildFinalResults(party.id);
  const winner = songResults[0] ?? null;

  // Compute stats
  const totalSongs = await prisma.song.count({ where: { partyId: party.id } });
  const totalParticipants = await prisma.participant.count({ where: { partyId: party.id } });
  const totalReactions = await prisma.vote.count({
    where: { song: { partyId: party.id } },
  });

  io.to(partyCode).emit("party-ended", {
    winner,
    songResults,
    stats: { totalSongs, totalParticipants, totalReactions },
  });

  // Clean up in-memory state
  rooms.delete(partyCode);
}

// ---------------------------------------------------------------------------
// Start playback (first song triggers party to active)
// ---------------------------------------------------------------------------

async function startPlayback(
  io: Server,
  partyCode: string,
  song: SongData
): Promise<void> {
  const party = await prisma.party.findUnique({ where: { code: partyCode } });
  if (!party) return;

  // Mark song as playing
  await prisma.song.update({
    where: { id: song.id },
    data: { status: "playing" },
  });

  const playbackState: PlaybackState = {
    currentSong: { ...song, status: "playing" },
    startedAt: Date.now(),
    isPlaying: true,
  };
  rooms.set(partyCode, playbackState);

  io.to(partyCode).emit("now-playing", {
    song: playbackState.currentSong,
    startedAt: playbackState.startedAt,
  });

  // If party was waiting, transition to active and set timer
  if (party.status === "waiting") {
    await prisma.party.update({
      where: { id: party.id },
      data: { status: "active" },
    });

    const timeoutMs = party.maxDurationMinutes * PARTY_TIMER_MS_PER_MINUTE;
    const timer = setTimeout(() => {
      endParty(io, partyCode);
    }, timeoutMs);
    partyTimers.set(partyCode, timer);
  }
}

// ---------------------------------------------------------------------------
// Main handler setup
// ---------------------------------------------------------------------------

export function setupSocketHandlers(io: Server): void {
  io.on("connection", (socket: Socket) => {
    console.log("Client connected:", socket.id);

    // -----------------------------------------------------------------------
    // join-room
    // -----------------------------------------------------------------------
    socket.on("join-room", async ({ partyCode, clientToken }: JoinRoomPayload) => {
      try {
        const party = await prisma.party.findUnique({ where: { code: partyCode } });
        if (!party) {
          socket.emit("error", { message: "Party not found" });
          return;
        }

        if (kickedParticipants.has(kickedKey(partyCode, clientToken))) {
          socket.emit("kicked", { message: "You were removed from this room." });
          socket.disconnect(true);
          return;
        }

        let participant = await prisma.participant.findFirst({
          where: { partyId: party.id, clientToken },
        });

        // Auto-create participant if not found (handles host flow and direct link joins)
        if (!participant) {
          const isHost = party.hostToken === clientToken;

          if (!isHost) {
            const connectedCount = await prisma.participant.count({
              where: { partyId: party.id, isConnected: true },
            });

            if (connectedCount >= party.maxUsers) {
              socket.emit("error", { message: "This room is full" });
              return;
            }
          }

          participant = await prisma.participant.create({
            data: {
              partyId: party.id,
              name: isHost ? party.hostName : `Guest ${Math.floor(Math.random() * 1000)}`,
              avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
              clientToken,
              isConnected: true,
            },
          });
        }

        // Join the Socket.IO room
        socket.join(partyCode);

        // Store socket <-> participant mapping
        socketParticipants.set(socket.id, {
          participantId: participant.id,
          partyCode,
          clientToken,
        });

        // Update connected status
        await prisma.participant.update({
          where: { id: participant.id },
          data: { isConnected: true },
        });

        // Build party-state
        const participants = await prisma.participant.findMany({
          where: { partyId: party.id },
          select: { id: true, name: true, avatarColor: true, isConnected: true },
        });

        const songs = await prisma.song.findMany({
          where: { partyId: party.id },
          include: {
            addedBy: { select: { id: true, name: true, avatarColor: true } },
          },
        });

        const songData = songs.map((song) => toSongData(song));

        // Sort: playing first, then queued (by position ASC / FIFO), then played
        songData.sort((a, b) => {
          const orderDiff = (SONG_STATUS_ORDER[a.status] ?? 1) - (SONG_STATUS_ORDER[b.status] ?? 1);
          if (orderDiff !== 0) return orderDiff;
          return a.position - b.position;
        });

        const chatMessages = await prisma.chatMessage.findMany({
          where: { partyId: party.id },
          include: {
            participant: { select: { id: true, name: true, avatarColor: true } },
          },
          orderBy: { createdAt: "asc" },
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
            hostName: party.hostName,
          },
          participantId: participant.id,
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

        socket.emit("leaderboard-updated", await buildLeaderboard(party.id));

        // Broadcast to others
        socket.to(partyCode).emit("participant-joined", {
          id: participant.id,
          name: participant.name,
          avatarColor: participant.avatarColor,
          isConnected: true,
        });
      } catch (error) {
        console.error("Error in join-room:", error);
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    // -----------------------------------------------------------------------
    // add-song
    // -----------------------------------------------------------------------
    socket.on(
      "add-song",
      async ({
        youtubeVideoId,
        title,
        artist,
        thumbnailUrl,
      }: AddSongPayload) => {
        try {
          const sp = socketParticipants.get(socket.id);
          if (!sp) {
            socket.emit("error", { message: "Not in a room" });
            return;
          }

          // Validate fields
          if (
            !youtubeVideoId || typeof youtubeVideoId !== "string" ||
            !title || typeof title !== "string" ||
            !artist || typeof artist !== "string" ||
            !thumbnailUrl || typeof thumbnailUrl !== "string"
          ) {
            socket.emit("error", { message: "Invalid song data" });
            return;
          }

          const sanitizedTitle = sanitize(title);
          const sanitizedArtist = sanitize(artist);

          const party = await prisma.party.findUnique({ where: { code: sp.partyCode } });
          if (!party) return;

          // Check maxSongsPerPerson
          const songCount = await prisma.song.count({
            where: { partyId: party.id, addedById: sp.participantId },
          });
          if (songCount >= party.maxSongsPerPerson) {
            socket.emit("error", { message: `You can only add ${party.maxSongsPerPerson} songs` });
            return;
          }

          // Get next position
          const maxPos = await prisma.song.aggregate({
            where: { partyId: party.id },
            _max: { position: true },
          });
          const nextPosition = (maxPos._max.position ?? -1) + 1;

          // Create song
          const song = await prisma.song.create({
            data: {
              partyId: party.id,
              youtubeVideoId,
              title: sanitizedTitle,
              artist: sanitizedArtist,
              thumbnailUrl,
              addedById: sp.participantId,
              position: nextPosition,
            },
            include: {
              addedBy: { select: { id: true, name: true, avatarColor: true } },
            },
          });

          const songData = toSongData(song);

          io.to(sp.partyCode).emit("song-added", songData);
          io.to(sp.partyCode).emit("leaderboard-updated", await buildLeaderboard(party.id));

          // System chat message
          const sysMsg = await prisma.chatMessage.create({
            data: {
              partyId: party.id,
              content: `${song.addedBy.name} added ${song.title}`,
              type: "system",
            },
          });
          io.to(sp.partyCode).emit("chat-message", {
            id: sysMsg.id,
            participantName: null,
            content: sysMsg.content,
            type: sysMsg.type,
            createdAt: sysMsg.createdAt.toISOString(),
          });

          // Auto-start playback if nothing is playing
          const roomState = rooms.get(sp.partyCode);
          if (!roomState || roomState.currentSong === null) {
            await startPlayback(io, sp.partyCode, songData);
          }
        } catch (error) {
          console.error("Error in add-song:", error);
          socket.emit("error", { message: "Failed to add song" });
        }
      }
    );

    // -----------------------------------------------------------------------
    // react-to-song (replaces vote — reactions are private until party end)
    // -----------------------------------------------------------------------
    socket.on("react-to-song", async ({ songId, reaction }: { songId: string; reaction: string }) => {
      try {
        const sp = socketParticipants.get(socket.id);
        if (!sp) {
          socket.emit("error", { message: "Not in a room" });
          return;
        }

        // Validate reaction is one of the allowed emojis
        if (!VALID_REACTIONS.includes(reaction)) {
          socket.emit("error", { message: "Invalid reaction" });
          return;
        }

        // Validate song belongs to this party
        const party = await prisma.party.findUnique({ where: { code: sp.partyCode } });
        if (!party) return;

        const song = await prisma.song.findFirst({
          where: { id: songId, partyId: party.id },
        });
        if (!song) {
          socket.emit("error", { message: "Song not found in this party" });
          return;
        }

        // Upsert: create or update the reaction for this participant+song
        await prisma.vote.upsert({
          where: {
            songId_participantId: {
              songId,
              participantId: sp.participantId,
            },
          },
          update: { reaction },
          create: {
            songId,
            participantId: sp.participantId,
            reaction,
          },
        });

        // Reactions are private until party end — just acknowledge to the sender
        socket.emit("reaction-saved", { songId, reaction });
        io.to(sp.partyCode).emit("leaderboard-updated", await buildLeaderboard(party.id));
      } catch (error) {
        console.error("Error in react-to-song:", error);
        socket.emit("error", { message: "Failed to save reaction" });
      }
    });

    // -----------------------------------------------------------------------
    // chat-message
    // -----------------------------------------------------------------------
    socket.on("chat-message", async ({ content }: { content: string }) => {
      try {
        const sp = socketParticipants.get(socket.id);
        if (!sp) {
          socket.emit("error", { message: "Not in a room" });
          return;
        }

        // Validate
        if (!content || typeof content !== "string" || content.trim().length === 0 || content.length > 500) {
          socket.emit("error", { message: "Message must be 1-500 characters" });
          return;
        }

        const sanitizedContent = sanitize(content.trim());

        const party = await prisma.party.findUnique({ where: { code: sp.partyCode } });
        if (!party) return;

        const message = await prisma.chatMessage.create({
          data: {
            partyId: party.id,
            participantId: sp.participantId,
            content: sanitizedContent,
            type: "chat",
          },
          include: {
            participant: { select: { id: true, name: true, avatarColor: true } },
          },
        });

        io.to(sp.partyCode).emit("chat-message", {
          id: message.id,
          content: message.content,
          type: message.type,
          createdAt: message.createdAt,
          participant: message.participant,
        });
      } catch (error) {
        console.error("Error in chat-message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // -----------------------------------------------------------------------
    // reaction (live emoji burst — kept separate from react-to-song)
    // -----------------------------------------------------------------------
    socket.on("reaction", ({ emoji }: { emoji: string }) => {
      const sp = socketParticipants.get(socket.id);
      if (!sp) {
        socket.emit("error", { message: "Not in a room" });
        return;
      }

      if (!emoji || typeof emoji !== "string" || emoji.length > 10) {
        socket.emit("error", { message: "Invalid emoji" });
        return;
      }

      prisma.participant
        .findUnique({
          where: { id: sp.participantId },
          select: { name: true },
        })
        .then((participant) => {
          if (participant) {
            io.to(sp.partyCode).emit("reaction", {
              participantName: participant.name,
              emoji,
            });
          }
        })
        .catch((error) => {
          console.error("Error in reaction:", error);
        });
    });

    // -----------------------------------------------------------------------
    // Playback controls (host only)
    // -----------------------------------------------------------------------

    socket.on("prev-song", async () => {
      try {
        const sp = socketParticipants.get(socket.id);
        if (!sp) {
          socket.emit("error", { message: "Not in a room" });
          return;
        }

        const party = await prisma.party.findUnique({ where: { code: sp.partyCode } });
        if (!party) return;

        if (sp.clientToken !== party.hostToken) {
          socket.emit("error", { message: "Only the host can control playback" });
          return;
        }

        const roomState = rooms.get(sp.partyCode);

        // Find the most recently played song (status "played", highest playedAt)
        const prevSong = await prisma.song.findFirst({
          where: { partyId: party.id, status: "played" },
          orderBy: { playedAt: "desc" },
          include: {
            addedBy: { select: { id: true, name: true, avatarColor: true } },
          },
        });

        if (!prevSong) {
          socket.emit("error", { message: "No previous song to go back to" });
          return;
        }

        // Mark current song as "queued" again
        if (roomState?.currentSong) {
          await prisma.song.update({
            where: { id: roomState.currentSong.id },
            data: { status: "queued", playedAt: null },
          });
        }

        // Start playback of the previous song
        await prisma.song.update({
          where: { id: prevSong.id },
          data: { status: "playing", playedAt: null },
        });

        const prevSongData = toSongData({ ...prevSong, status: "playing" });

        const playbackState: PlaybackState = {
          currentSong: prevSongData,
          startedAt: Date.now(),
          isPlaying: true,
        };
        rooms.set(sp.partyCode, playbackState);

        io.to(sp.partyCode).emit("now-playing", {
          song: playbackState.currentSong,
          startedAt: playbackState.startedAt,
        });
      } catch (error) {
        console.error("Error in prev-song:", error);
        socket.emit("error", { message: "Failed to go to previous song" });
      }
    });

    socket.on("restart-song", async () => {
      try {
        const sp = socketParticipants.get(socket.id);
        if (!sp) {
          socket.emit("error", { message: "Not in a room" });
          return;
        }

        const party = await prisma.party.findUnique({ where: { code: sp.partyCode } });
        if (!party) return;

        if (sp.clientToken !== party.hostToken) {
          socket.emit("error", { message: "Only the host can control playback" });
          return;
        }

        // Reset startedAt so offset calculation resets
        const roomState = rooms.get(sp.partyCode);
        if (roomState) {
          roomState.startedAt = Date.now();
          rooms.set(sp.partyCode, roomState);
        }

        io.to(sp.partyCode).emit("playback-control", { action: "restart" });
      } catch (error) {
        console.error("Error in restart-song:", error);
        socket.emit("error", { message: "Failed to restart song" });
      }
    });

    socket.on("seek", async ({ seconds }: { seconds: number }) => {
      try {
        const sp = socketParticipants.get(socket.id);
        if (!sp) {
          socket.emit("error", { message: "Not in a room" });
          return;
        }

        const party = await prisma.party.findUnique({ where: { code: sp.partyCode } });
        if (!party) return;

        if (sp.clientToken !== party.hostToken) {
          socket.emit("error", { message: "Only the host can control playback" });
          return;
        }

        io.to(sp.partyCode).emit("playback-control", { action: "seek", seconds });
      } catch (error) {
        console.error("Error in seek:", error);
        socket.emit("error", { message: "Failed to seek" });
      }
    });

    socket.on("pause", async () => {
      try {
        const sp = socketParticipants.get(socket.id);
        if (!sp) {
          socket.emit("error", { message: "Not in a room" });
          return;
        }

        const party = await prisma.party.findUnique({ where: { code: sp.partyCode } });
        if (!party) return;

        if (sp.clientToken !== party.hostToken) {
          socket.emit("error", { message: "Only the host can control playback" });
          return;
        }

        const roomState = rooms.get(sp.partyCode);
        if (roomState) {
          roomState.isPlaying = false;
          rooms.set(sp.partyCode, roomState);
        }

        io.to(sp.partyCode).emit("playback-control", { action: "pause" });
      } catch (error) {
        console.error("Error in pause:", error);
        socket.emit("error", { message: "Failed to pause" });
      }
    });

    socket.on("resume", async () => {
      try {
        const sp = socketParticipants.get(socket.id);
        if (!sp) {
          socket.emit("error", { message: "Not in a room" });
          return;
        }

        const party = await prisma.party.findUnique({ where: { code: sp.partyCode } });
        if (!party) return;

        if (sp.clientToken !== party.hostToken) {
          socket.emit("error", { message: "Only the host can control playback" });
          return;
        }

        const roomState = rooms.get(sp.partyCode);
        if (roomState) {
          roomState.isPlaying = true;
          rooms.set(sp.partyCode, roomState);
        }

        io.to(sp.partyCode).emit("playback-control", { action: "resume" });
      } catch (error) {
        console.error("Error in resume:", error);
        socket.emit("error", { message: "Failed to resume" });
      }
    });

    // -----------------------------------------------------------------------
    // skip-song (host only)
    // -----------------------------------------------------------------------
    socket.on("skip-song", async () => {
      try {
        const sp = socketParticipants.get(socket.id);
        if (!sp) {
          socket.emit("error", { message: "Not in a room" });
          return;
        }

        const party = await prisma.party.findUnique({ where: { code: sp.partyCode } });
        if (!party) return;

        if (sp.clientToken !== party.hostToken) {
          socket.emit("error", { message: "Only the host can skip songs" });
          return;
        }

        await advanceToNextSong(io, sp.partyCode);
      } catch (error) {
        console.error("Error in skip-song:", error);
        socket.emit("error", { message: "Failed to skip song" });
      }
    });

    // -----------------------------------------------------------------------
    // reorder-queue (host only)
    // -----------------------------------------------------------------------
    socket.on("reorder-queue", async ({ songIds }: { songIds: string[] }) => {
      try {
        const sp = socketParticipants.get(socket.id);
        if (!sp) {
          socket.emit("error", { message: "Not in a room" });
          return;
        }

        const party = await prisma.party.findUnique({ where: { code: sp.partyCode } });
        if (!party) return;

        if (sp.clientToken !== party.hostToken) {
          socket.emit("error", { message: "Only the host can reorder the queue" });
          return;
        }

        if (!Array.isArray(songIds) || songIds.length === 0) {
          socket.emit("error", { message: "Invalid song order" });
          return;
        }

        // Update positions for each song in the new order
        for (let i = 0; i < songIds.length; i++) {
          await prisma.song.updateMany({
            where: { id: songIds[i], partyId: party.id, status: "queued" },
            data: { position: i },
          });
        }

        // Fetch updated songs and broadcast
        const songs = await prisma.song.findMany({
          where: { partyId: party.id },
          include: {
            addedBy: { select: { id: true, name: true, avatarColor: true } },
          },
        });

        const songData = songs.map((song) => toSongData(song));
        io.to(sp.partyCode).emit("queue-updated", songData);
        io.to(sp.partyCode).emit("leaderboard-updated", await buildLeaderboard(party.id));
      } catch (error) {
        console.error("Error in reorder-queue:", error);
        socket.emit("error", { message: "Failed to reorder queue" });
      }
    });

    // -----------------------------------------------------------------------
    // play-song (host only — skip to specific song)
    // -----------------------------------------------------------------------
    socket.on("play-song", async ({ songId }: { songId: string }) => {
      try {
        const sp = socketParticipants.get(socket.id);
        if (!sp) {
          socket.emit("error", { message: "Not in a room" });
          return;
        }

        const party = await prisma.party.findUnique({ where: { code: sp.partyCode } });
        if (!party) return;

        if (sp.clientToken !== party.hostToken) {
          socket.emit("error", { message: "Only the host can select songs" });
          return;
        }

        const song = await prisma.song.findFirst({
          where: { id: songId, partyId: party.id, status: "queued" },
          include: {
            addedBy: { select: { id: true, name: true, avatarColor: true } },
          },
        });

        if (!song) {
          socket.emit("error", { message: "Song not found in queue" });
          return;
        }

        // Mark current song as played
        const roomState = rooms.get(sp.partyCode);
        if (roomState?.currentSong) {
          io.to(sp.partyCode).emit("song-ended", { song: roomState.currentSong });
          await prisma.song.update({
            where: { id: roomState.currentSong.id },
            data: { status: "played", playedAt: new Date() },
          });
        }

        // Start the selected song
        await startPlayback(io, sp.partyCode, toSongData(song));

        // Sync full song list so frontend queue stays consistent
        const allSongs = await prisma.song.findMany({
          where: { partyId: party.id },
          include: {
            addedBy: { select: { id: true, name: true, avatarColor: true } },
          },
        });
        io.to(sp.partyCode).emit("queue-updated", allSongs.map((s) => toSongData(s)));
        io.to(sp.partyCode).emit("leaderboard-updated", await buildLeaderboard(party.id));
      } catch (error) {
        console.error("Error in play-song:", error);
        socket.emit("error", { message: "Failed to play song" });
      }
    });

    // -----------------------------------------------------------------------
    // end-party (host only)
    // -----------------------------------------------------------------------
    socket.on("end-party", async () => {
      try {
        const sp = socketParticipants.get(socket.id);
        if (!sp) {
          socket.emit("error", { message: "Not in a room" });
          return;
        }

        const party = await prisma.party.findUnique({ where: { code: sp.partyCode } });
        if (!party) return;

        if (sp.clientToken !== party.hostToken) {
          socket.emit("error", { message: "Only the host can end the party" });
          return;
        }

        await endParty(io, sp.partyCode);
      } catch (error) {
        console.error("Error in end-party:", error);
        socket.emit("error", { message: "Failed to end party" });
      }
    });

    // -----------------------------------------------------------------------
    // kick-participant (host only)
    // -----------------------------------------------------------------------
    socket.on("kick-participant", async ({ participantId }: { participantId: string }) => {
      try {
        const sp = socketParticipants.get(socket.id);
        if (!sp) {
          socket.emit("error", { message: "Not in a room" });
          return;
        }

        const party = await prisma.party.findUnique({ where: { code: sp.partyCode } });
        if (!party) return;

        if (sp.clientToken !== party.hostToken) {
          socket.emit("error", { message: "Only the host can kick participants" });
          return;
        }

        const participant = await prisma.participant.findFirst({
          where: { id: participantId, partyId: party.id },
        });
        if (!participant) {
          socket.emit("error", { message: "Participant not found" });
          return;
        }

        if (participant.clientToken === party.hostToken) {
          socket.emit("error", { message: "The host cannot be kicked" });
          return;
        }

        kickedParticipants.add(kickedKey(sp.partyCode, participant.clientToken));

        await prisma.participant.update({
          where: { id: participant.id },
          data: { isConnected: false },
        });

        for (const [socketId, mapped] of socketParticipants.entries()) {
          if (mapped.participantId !== participant.id) continue;
          const targetSocket = io.sockets.sockets.get(socketId);
          targetSocket?.emit("kicked", { message: "You were removed from this room." });
          targetSocket?.disconnect(true);
          socketParticipants.delete(socketId);
        }

        io.to(sp.partyCode).emit("participant-left", {
          participantId: participant.id,
        });

        const sysMsg = await prisma.chatMessage.create({
          data: {
            partyId: party.id,
            content: `${participant.name} was removed from the room`,
            type: "system",
          },
        });

        io.to(sp.partyCode).emit("chat-message", {
          id: sysMsg.id,
          participantName: null,
          content: sysMsg.content,
          type: sysMsg.type,
          createdAt: sysMsg.createdAt.toISOString(),
        });
      } catch (error) {
        console.error("Error in kick-participant:", error);
        socket.emit("error", { message: "Failed to kick participant" });
      }
    });

    // -----------------------------------------------------------------------
    // disconnect
    // -----------------------------------------------------------------------
    socket.on("disconnect", async () => {
      console.log("Client disconnected:", socket.id);

      const sp = socketParticipants.get(socket.id);
      if (!sp) return;

      try {
        await prisma.participant.update({
          where: { id: sp.participantId },
          data: { isConnected: false },
        });

        socket.to(sp.partyCode).emit("participant-left", {
          participantId: sp.participantId,
        });
      } catch (error) {
        console.error("Error in disconnect:", error);
      }

      socketParticipants.delete(socket.id);
    });
  });
}

export default setupSocketHandlers;
