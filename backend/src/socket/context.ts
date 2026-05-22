import type { Party } from "@prisma/client";
import type { Socket } from "socket.io";
import { prisma } from "../models/db.js";
import { socketError } from "./errors.js";
import { socketParticipants, type SocketParticipant } from "./state.js";

export interface SocketContext {
  party: Party;
  socketParticipant: SocketParticipant;
}

export async function getSocketContext(socket: Socket): Promise<SocketContext> {
  const socketParticipant = socketParticipants.get(socket.id);
  if (!socketParticipant) {
    throw socketError("Not in a room", "NOT_IN_ROOM");
  }

  const party = await prisma.party.findUnique({
    where: { code: socketParticipant.partyCode },
  });
  if (!party) {
    throw socketError("Party not found", "PARTY_NOT_FOUND");
  }

  return { party, socketParticipant };
}

export async function getHostSocketContext(
  socket: Socket,
  message = "Only the host can control playback"
): Promise<SocketContext> {
  const context = await getSocketContext(socket);
  if (context.socketParticipant.clientToken !== context.party.hostToken) {
    throw socketError(message, "HOST_REQUIRED");
  }

  return context;
}

