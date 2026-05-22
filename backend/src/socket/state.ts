import type { SongData } from "../models/song.js";

export interface PlaybackState {
  currentSong: SongData | null;
  startedAt: number | null;
  isPlaying: boolean;
}

export interface SocketParticipant {
  participantId: string;
  partyCode: string;
  clientToken: string;
}

export const rooms = new Map<string, PlaybackState>();
export const socketParticipants = new Map<string, SocketParticipant>();
export const kickedParticipants = new Set<string>();
export const partyTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function kickedKey(partyCode: string, clientToken: string): string {
  return `${partyCode}:${clientToken}`;
}

