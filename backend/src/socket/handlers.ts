import { Server, Socket } from "socket.io";
import { AVATAR_COLORS, MAX_CHAT_MESSAGE_LENGTH, MAX_EMOJI_LENGTH, MAX_GUEST_NAME_SUFFIX } from "../constants/party.js";
import { PARTICIPANT_SELECT } from "../constants/prisma.js";
import { VALID_REACTIONS } from "../constants/reactions.js";
import type { AddSongPayload, JoinRoomPayload } from "../dto/party.js";
import { prisma } from "../models/db.js";
import { buildLeaderboard } from "../services/leaderboard.js";
import { addSongToQueue, reorderQueuedSongs } from "../services/songQueue.js";
import { isBlankString, sanitize } from "../services/text.js";
import { getHostSocketContext, getSocketContext } from "./context.js";
import { emitSocketError, runSocketHandler } from "./errors.js";
import { emitPartyState } from "./partyState.js";
import {
  advanceToNextSong,
  endParty,
  playPreviousSong,
  playQueuedSong,
  restartPlayback,
  setPlaybackPaused,
  startPlayback,
} from "./playback.js";
import {
  kickedKey,
  kickedParticipants,
  rooms,
  socketParticipants,
} from "./state.js";

export function setupSocketHandlers(io: Server): void {
  io.on("connection", (socket: Socket) => {
    console.log("Client connected:", socket.id);

    socket.on("join-room", (payload: JoinRoomPayload) => {
      void runSocketHandler(socket, "join-room", "Failed to join room", async () => {
        await joinRoom(io, socket, payload);
      });
    });

    socket.on("add-song", (payload: AddSongPayload) => {
      void runSocketHandler(socket, "add-song", "Failed to add song", async () => {
        await addSong(io, socket, payload);
      });
    });

    socket.on("react-to-song", (payload: { songId: string; reaction: string }) => {
      void runSocketHandler(socket, "react-to-song", "Failed to save reaction", async () => {
        await reactToSong(io, socket, payload);
      });
    });

    socket.on("chat-message", (payload: { content: string }) => {
      void runSocketHandler(socket, "chat-message", "Failed to send message", async () => {
        await sendChatMessage(io, socket, payload);
      });
    });

    socket.on("reaction", (payload: { emoji: string }) => {
      void runSocketHandler(socket, "reaction", "Failed to send reaction", async () => {
        await sendLiveReaction(io, socket, payload);
      });
    });

    socket.on("prev-song", () => {
      void runSocketHandler(socket, "prev-song", "Failed to go to previous song", async () => {
        const { party, socketParticipant } = await getHostSocketContext(socket);
        const played = await playPreviousSong(io, socketParticipant.partyCode, party.id);
        if (!played) emitSocketError(socket, "No previous song to go back to");
      });
    });

    socket.on("restart-song", () => {
      void runSocketHandler(socket, "restart-song", "Failed to restart song", async () => {
        const { socketParticipant } = await getHostSocketContext(socket);
        restartPlayback(io, socketParticipant.partyCode);
      });
    });

    socket.on("seek", ({ seconds }: { seconds: number }) => {
      void runSocketHandler(socket, "seek", "Failed to seek", async () => {
        const { socketParticipant } = await getHostSocketContext(socket);
        io.to(socketParticipant.partyCode).emit("playback-control", { action: "seek", seconds });
      });
    });

    socket.on("playback-sync", ({ currentTime }: { currentTime: number }) => {
      const sp = socketParticipants.get(socket.id);
      if (sp) {
        socket.to(sp.partyCode).emit("playback-sync", { currentTime });
      }
    });

    socket.on("pause", () => {
      void runSocketHandler(socket, "pause", "Failed to pause", async () => {
        const { socketParticipant } = await getHostSocketContext(socket);
        setPlaybackPaused(io, socketParticipant.partyCode, true);
      });
    });

    socket.on("resume", () => {
      void runSocketHandler(socket, "resume", "Failed to resume", async () => {
        const { socketParticipant } = await getHostSocketContext(socket);
        setPlaybackPaused(io, socketParticipant.partyCode, false);
      });
    });

    socket.on("skip-song", () => {
      void runSocketHandler(socket, "skip-song", "Failed to skip song", async () => {
        const { socketParticipant } = await getHostSocketContext(socket, "Only the host can skip songs");
        await advanceToNextSong(io, socketParticipant.partyCode);
      });
    });

    socket.on("reorder-queue", ({ songIds }: { songIds: string[] }) => {
      void runSocketHandler(socket, "reorder-queue", "Failed to reorder queue", async () => {
        await reorderQueue(io, socket, songIds);
      });
    });

    socket.on("play-song", ({ songId }: { songId: string }) => {
      void runSocketHandler(socket, "play-song", "Failed to play song", async () => {
        await playSong(io, socket, songId);
      });
    });

    socket.on("end-party", () => {
      void runSocketHandler(socket, "end-party", "Failed to end party", async () => {
        const { socketParticipant } = await getHostSocketContext(socket, "Only the host can end the party");
        await endParty(io, socketParticipant.partyCode);
      });
    });

    socket.on("kick-participant", ({ participantId }: { participantId: string }) => {
      void runSocketHandler(socket, "kick-participant", "Failed to kick participant", async () => {
        await kickParticipant(io, socket, participantId);
      });
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      void runSocketHandler(socket, "disconnect", "Failed to disconnect", async () => {
        await disconnectParticipant(socket);
      });
    });
  });
}

async function joinRoom(io: Server, socket: Socket, { partyCode, clientToken }: JoinRoomPayload): Promise<void> {
  const party = await prisma.party.findUnique({ where: { code: partyCode } });
  if (!party) {
    emitSocketError(socket, "Party not found");
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

  if (!participant) {
    const isHost = party.hostToken === clientToken;
    if (!isHost) {
      const connectedCount = await prisma.participant.count({
        where: { partyId: party.id, isConnected: true },
      });
      if (connectedCount >= party.maxUsers) {
        emitSocketError(socket, "This room is full");
        return;
      }
    }

    participant = await prisma.participant.create({
      data: {
        partyId: party.id,
        name: isHost ? party.hostName : `Guest ${Math.floor(Math.random() * MAX_GUEST_NAME_SUFFIX)}`,
        avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        clientToken,
        isConnected: true,
      },
    });
  }

  socket.join(partyCode);
  socketParticipants.set(socket.id, {
    participantId: participant.id,
    partyCode,
    clientToken,
  });

  await prisma.participant.update({
    where: { id: participant.id },
    data: { isConnected: true },
  });

  await emitPartyState(socket, partyCode, participant.id, clientToken);
  socket.to(partyCode).emit("participant-joined", {
    id: participant.id,
    name: participant.name,
    avatarColor: participant.avatarColor,
    isConnected: true,
  });
}

async function addSong(io: Server, socket: Socket, payload: AddSongPayload): Promise<void> {
  const { party, socketParticipant } = await getSocketContext(socket);
  const result = await addSongToQueue(party, socketParticipant, payload);
  if ("error" in result) {
    emitSocketError(socket, result.error);
    return;
  }

  io.to(socketParticipant.partyCode).emit("song-added", result.songData);
  io.to(socketParticipant.partyCode).emit("leaderboard-updated", await buildLeaderboard(party.id));
  io.to(socketParticipant.partyCode).emit("chat-message", {
    id: result.systemMessage.id,
    participantName: null,
    content: result.systemMessage.content,
    type: result.systemMessage.type,
    createdAt: result.systemMessage.createdAt.toISOString(),
  });

  const roomState = rooms.get(socketParticipant.partyCode);
  if (!roomState || roomState.currentSong === null) {
    await startPlayback(io, socketParticipant.partyCode, result.songData);
  }
}

async function reactToSong(
  io: Server,
  socket: Socket,
  { songId, reaction }: { songId: string; reaction: string }
): Promise<void> {
  const { party, socketParticipant } = await getSocketContext(socket);
  if (!VALID_REACTIONS.includes(reaction)) {
    emitSocketError(socket, "Invalid reaction");
    return;
  }

  const song = await prisma.song.findFirst({
    where: { id: songId, partyId: party.id },
  });
  if (!song) {
    emitSocketError(socket, "Song not found in this party");
    return;
  }

  await prisma.vote.upsert({
    where: {
      songId_participantId: {
        songId,
        participantId: socketParticipant.participantId,
      },
    },
    update: { reaction },
    create: {
      songId,
      participantId: socketParticipant.participantId,
      reaction,
    },
  });

  socket.emit("reaction-saved", { songId, reaction });
  io.to(socketParticipant.partyCode).emit("leaderboard-updated", await buildLeaderboard(party.id));
}

async function sendChatMessage(
  io: Server,
  socket: Socket,
  { content }: { content: string }
): Promise<void> {
  const { party, socketParticipant } = await getSocketContext(socket);
  if (isBlankString(content) || typeof content !== "string" || content.length > MAX_CHAT_MESSAGE_LENGTH) {
    emitSocketError(socket, "Message must be 1-500 characters");
    return;
  }

  const message = await prisma.chatMessage.create({
    data: {
      partyId: party.id,
      participantId: socketParticipant.participantId,
      content: sanitize(content.trim()),
      type: "chat",
    },
    include: {
      participant: { select: PARTICIPANT_SELECT },
    },
  });

  io.to(socketParticipant.partyCode).emit("chat-message", {
    id: message.id,
    content: message.content,
    type: message.type,
    createdAt: message.createdAt,
    participant: message.participant,
  });
}

async function sendLiveReaction(
  io: Server,
  socket: Socket,
  { emoji }: { emoji: string }
): Promise<void> {
  const { socketParticipant } = await getSocketContext(socket);
  if (!emoji || typeof emoji !== "string" || emoji.length > MAX_EMOJI_LENGTH) {
    emitSocketError(socket, "Invalid emoji");
    return;
  }

  const participant = await prisma.participant.findUnique({
    where: { id: socketParticipant.participantId },
    select: { name: true },
  });

  if (participant) {
    io.to(socketParticipant.partyCode).emit("reaction", {
      participantName: participant.name,
      emoji,
    });
  }
}

async function reorderQueue(io: Server, socket: Socket, songIds: string[]): Promise<void> {
  const { party, socketParticipant } = await getHostSocketContext(
    socket,
    "Only the host can reorder the queue"
  );
  if (!Array.isArray(songIds) || songIds.length === 0) {
    emitSocketError(socket, "Invalid song order");
    return;
  }

  const songData = await reorderQueuedSongs(party.id, songIds);
  io.to(socketParticipant.partyCode).emit("queue-updated", songData);
  io.to(socketParticipant.partyCode).emit("leaderboard-updated", await buildLeaderboard(party.id));
}

async function playSong(io: Server, socket: Socket, songId: string): Promise<void> {
  const { party, socketParticipant } = await getHostSocketContext(socket, "Only the host can select songs");
  const songData = await playQueuedSong(io, socketParticipant.partyCode, party.id, songId);
  if (!songData) {
    emitSocketError(socket, "Song not found in queue");
    return;
  }

  io.to(socketParticipant.partyCode).emit("queue-updated", songData);
  io.to(socketParticipant.partyCode).emit("leaderboard-updated", await buildLeaderboard(party.id));
}

async function kickParticipant(io: Server, socket: Socket, participantId: string): Promise<void> {
  const { party, socketParticipant } = await getHostSocketContext(
    socket,
    "Only the host can kick participants"
  );
  const participant = await prisma.participant.findFirst({
    where: { id: participantId, partyId: party.id },
  });
  if (!participant) {
    emitSocketError(socket, "Participant not found");
    return;
  }
  if (participant.clientToken === party.hostToken) {
    emitSocketError(socket, "The host cannot be kicked");
    return;
  }

  kickedParticipants.add(kickedKey(socketParticipant.partyCode, participant.clientToken));
  await prisma.participant.update({
    where: { id: participant.id },
    data: { isConnected: false },
  });

  disconnectParticipantSockets(io, participant.id);
  io.to(socketParticipant.partyCode).emit("participant-left", { participantId: participant.id });

  const sysMsg = await prisma.chatMessage.create({
    data: {
      partyId: party.id,
      content: `${participant.name} was removed from the room`,
      type: "system",
    },
  });

  io.to(socketParticipant.partyCode).emit("chat-message", {
    id: sysMsg.id,
    participantName: null,
    content: sysMsg.content,
    type: sysMsg.type,
    createdAt: sysMsg.createdAt.toISOString(),
  });
}

function disconnectParticipantSockets(io: Server, participantId: string): void {
  for (const [socketId, mapped] of socketParticipants.entries()) {
    if (mapped.participantId !== participantId) continue;
    const targetSocket = io.sockets.sockets.get(socketId);
    targetSocket?.emit("kicked", { message: "You were removed from this room." });
    targetSocket?.disconnect(true);
    socketParticipants.delete(socketId);
  }
}

async function disconnectParticipant(socket: Socket): Promise<void> {
  const socketParticipant = socketParticipants.get(socket.id);
  if (!socketParticipant) return;

  await prisma.participant.update({
    where: { id: socketParticipant.participantId },
    data: { isConnected: false },
  });

  socket.to(socketParticipant.partyCode).emit("participant-left", {
    participantId: socketParticipant.participantId,
  });
  socketParticipants.delete(socket.id);
}

export default setupSocketHandlers;
