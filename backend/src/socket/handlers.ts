import { Server, Socket } from "socket.io";
import { prisma } from "../routes/parties.js";
import { suggestSongs } from "../services/ai.js";
import { searchMultipleSongs } from "../services/youtube.js";

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

interface PlaybackState {
  currentSong: any | null;
  startedAt: number | null;
  isPlaying: boolean;
}

const rooms = new Map<string, PlaybackState>();
const socketParticipants = new Map<
  string,
  { participantId: string; partyCode: string; clientToken: string }
>();
const partyTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip HTML tags from a string. */
function sanitize(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}

/** Map reaction emoji to its score value. */
const REACTION_SCORES: Record<string, number> = {
  "\u{1F525}": 3,   // 🔥
  "\u2764\uFE0F": 2, // ❤️
  "\u{1F610}": 0,   // 😐
  "\u{1F44E}": -1,  // 👎
};

const VALID_REACTIONS = Object.keys(REACTION_SCORES);

/** Convert a Prisma song (with addedBy relation) to the SongData shape the frontend expects. */
function toSongData(song: any): any {
  return {
    id: song.id,
    youtubeVideoId: song.youtubeVideoId,
    title: song.title,
    artist: song.artist,
    thumbnailUrl: song.thumbnailUrl,
    addedById: song.addedBy?.id ?? song.addedById ?? null,
    addedByName: song.addedBy?.name ?? "Unknown",
    addedByAI: song.addedByAI ?? false,
    aiPrompt: song.aiPrompt ?? null,
    position: song.position,
    status: song.status,
  };
}

/** Pick a vibe emoji based on keywords in the reading text. */
function pickVibeEmoji(reading: string): string {
  const lower = reading.toLowerCase();
  if (lower.includes("sad") || lower.includes("melanchol")) return "😢";
  if (lower.includes("chill") || lower.includes("relax")) return "😌";
  if (lower.includes("hype") || lower.includes("energy") || lower.includes("party")) return "🔥";
  if (lower.includes("love") || lower.includes("romantic")) return "💕";
  if (lower.includes("dark") || lower.includes("intense")) return "🖤";
  if (lower.includes("happy") || lower.includes("joy")) return "😊";
  if (lower.includes("nostalg")) return "✨";
  if (lower.includes("summer") || lower.includes("beach")) return "🌊";
  if (lower.includes("night") || lower.includes("late")) return "🌙";
  return "🎵";
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

  // Find the winner using reaction scores
  const allSongs = await prisma.song.findMany({
    where: { partyId: party.id, status: { in: ["played", "playing"] } },
    include: {
      votes: true,
      addedBy: { select: { id: true, name: true, avatarColor: true } },
    },
  });

  let winner = null;
  const songResults: any[] = [];
  if (allSongs.length > 0) {
    for (const song of allSongs) {
      const reactionBreakdown: Record<string, number> = {};
      let totalScore = 0;
      for (const vote of song.votes) {
        const emoji = vote.reaction;
        reactionBreakdown[emoji] = (reactionBreakdown[emoji] || 0) + 1;
        totalScore += REACTION_SCORES[emoji] ?? 0;
      }
      songResults.push({
        ...toSongData(song),
        totalScore,
        reactionBreakdown,
      });
    }
    songResults.sort((a, b) => b.totalScore - a.totalScore || a.position - b.position);
    winner = songResults[0];
  }

  // Compute stats
  const totalSongs = await prisma.song.count({ where: { partyId: party.id } });
  const totalParticipants = await prisma.participant.count({ where: { partyId: party.id } });
  const totalReactions = await prisma.vote.count({
    where: { song: { partyId: party.id } },
  });
  const aiPicks = await prisma.song.count({
    where: { partyId: party.id, addedByAI: true },
  });

  io.to(partyCode).emit("party-ended", {
    winner,
    songResults,
    stats: { totalSongs, totalParticipants, totalReactions, aiPicks },
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
  song: any
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

    const timeoutMs = party.maxDurationMinutes * 60 * 1000;
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
    socket.on("join-room", async ({ partyCode, clientToken }: { partyCode: string; clientToken: string }) => {
      try {
        const party = await prisma.party.findUnique({ where: { code: partyCode } });
        if (!party) {
          socket.emit("error", { message: "Party not found" });
          return;
        }

        let participant = await prisma.participant.findFirst({
          where: { partyId: party.id, clientToken },
        });

        // Auto-create participant if not found (handles host flow and direct link joins)
        if (!participant) {
          const AVATAR_COLORS = ["#7c3aed", "#2563eb", "#16a34a", "#ea580c", "#e11d48", "#0891b2", "#c026d3", "#65a30d"];
          const isHost = party.hostToken === clientToken;
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
        const statusOrder: Record<string, number> = { playing: 0, queued: 1, played: 2 };
        songData.sort((a, b) => {
          const orderDiff = (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1);
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
      }: {
        youtubeVideoId: string;
        title: string;
        artist: string;
        thumbnailUrl: string;
      }) => {
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
    // ai-suggest
    // -----------------------------------------------------------------------
    socket.on("ai-suggest", async ({ prompt }: { prompt: string }) => {
      try {
        const sp = socketParticipants.get(socket.id);
        if (!sp) {
          socket.emit("error", { message: "Not in a room" });
          return;
        }

        // Validate prompt
        if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0 || prompt.length > 500) {
          socket.emit("error", { message: "Prompt must be a non-empty string (max 500 chars)" });
          return;
        }

        const party = await prisma.party.findUnique({ where: { code: sp.partyCode } });
        if (!party) return;

        // Check remaining song slots (AI adds 3)
        const songCount = await prisma.song.count({
          where: { partyId: party.id, addedById: sp.participantId },
        });
        const remaining = party.maxSongsPerPerson - songCount;
        if (remaining < 3) {
          socket.emit("error", {
            message: `You need at least 3 remaining song slots for AI suggestions (you have ${remaining})`,
          });
          return;
        }

        // Call AI
        const suggestion = await suggestSongs(prompt.trim());

        // Search YouTube for each suggestion
        const youtubeResults = await searchMultipleSongs(suggestion.songs);

        // Get next position
        const maxPos = await prisma.song.aggregate({
          where: { partyId: party.id },
          _max: { position: true },
        });
        let nextPosition = (maxPos._max.position ?? -1) + 1;

        // Create songs in DB
        const createdSongs = [];
        for (const result of youtubeResults) {
          const song = await prisma.song.create({
            data: {
              partyId: party.id,
              youtubeVideoId: result.videoId,
              title: result.title,
              artist: result.artist,
              thumbnailUrl: result.thumbnailUrl,
              addedById: sp.participantId,
              addedByAI: true,
              aiPrompt: prompt.trim(),
              position: nextPosition++,
            },
            include: {
              addedBy: { select: { id: true, name: true, avatarColor: true } },
            },
          });

          createdSongs.push(toSongData(song));
        }

        // Build vibe card
        const emoji = pickVibeEmoji(suggestion.reading);
        const vibeCard = `${emoji} ${suggestion.reading}`;

        io.to(sp.partyCode).emit("ai-response", {
          vibeCard,
          songs: createdSongs,
        });

        // Create AI vibe-card chat message
        const aiMsg = await prisma.chatMessage.create({
          data: {
            partyId: party.id,
            content: suggestion.reading,
            type: "ai-vibe-card",
          },
        });
        io.to(sp.partyCode).emit("chat-message", {
          id: aiMsg.id,
          participantName: null,
          content: aiMsg.content,
          type: aiMsg.type,
          createdAt: aiMsg.createdAt.toISOString(),
        });

        // Auto-start playback if nothing is playing and we have songs
        const roomState = rooms.get(sp.partyCode);
        if ((!roomState || roomState.currentSong === null) && createdSongs.length > 0) {
          await startPlayback(io, sp.partyCode, createdSongs[0]);
        }
      } catch (error) {
        console.error("Error in ai-suggest:", error);
        socket.emit("error", {
          message: "AI couldn't suggest songs right now. Try searching manually!",
        });
      }
    });

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
