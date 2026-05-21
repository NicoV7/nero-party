import { create } from 'zustand';
import type {
  SongData,
  ParticipantData,
  ChatMessageData,
  PartyStatePayload,
} from '../lib/types';

function getOrCreateClientToken(): string {
  const existing = localStorage.getItem('nero-client-token');
  if (existing) return existing;
  const token = crypto.randomUUID();
  localStorage.setItem('nero-client-token', token);
  return token;
}

function sortSongs(songs: SongData[]): SongData[] {
  const statusOrder: Record<string, number> = {
    playing: 0,
    queued: 1,
    played: 2,
  };

  return [...songs].sort((a, b) => {
    const aOrder = statusOrder[a.status] ?? 1;
    const bOrder = statusOrder[b.status] ?? 1;

    if (aOrder !== bOrder) return aOrder - bOrder;

    // Within queued songs, sort by position ASC (FIFO)
    if (a.status === 'queued' && b.status === 'queued') {
      return a.position - b.position;
    }

    return 0;
  });
}

interface PartyStore {
  // Connection state
  isConnected: boolean;
  isHost: boolean;
  participantId: string | null;
  clientToken: string;

  // Party data
  party: {
    id: string;
    name: string;
    code: string;
    hostName: string;
    maxSongsPerPerson: number;
    maxDurationMinutes: number;
    status: string;
    createdAt: string;
  } | null;
  participants: ParticipantData[];
  songs: SongData[];
  chatMessages: ChatMessageData[];
  currentSong: SongData | null;
  playbackOffset: number | null;

  // Reaction toast
  pendingReaction: { songId: string; title: string; artist: string } | null;

  // Winner state
  winner: SongData | null;
  stats: {
    totalSongs: number;
    totalParticipants: number;
    totalReactions: number;
    aiPicks: number;
  } | null;

  // Actions
  setPartyState: (state: PartyStatePayload) => void;
  addSong: (song: SongData) => void;
  updateVote: (songId: string, netVotes: number) => void;
  setCurrentSong: (song: SongData | null) => void;
  addChatMessage: (msg: ChatMessageData) => void;
  addParticipant: (p: ParticipantData) => void;
  removeParticipant: (id: string) => void;
  setPartyEnded: (winner: SongData | null, stats: any) => void;
  setPendingReaction: (song: { songId: string; title: string; artist: string }) => void;
  clearPendingReaction: () => void;
  setConnected: (connected: boolean) => void;
  setParticipantId: (id: string) => void;
  setClientToken: (token: string) => void;
  reset: () => void;
}

const initialState = {
  isConnected: false,
  isHost: false,
  participantId: null,
  party: null,
  participants: [],
  songs: [],
  chatMessages: [],
  currentSong: null,
  playbackOffset: null,
  pendingReaction: null,
  winner: null,
  stats: null,
};

export const usePartyStore = create<PartyStore>((set) => ({
  ...initialState,
  clientToken: getOrCreateClientToken(),

  setPartyState: (payload) =>
    set({
      party: payload.party,
      participantId: payload.participantId ?? null,
      participants: payload.participants,
      songs: sortSongs(payload.songs),
      chatMessages: payload.chatMessages,
      currentSong: payload.currentSong,
      playbackOffset: payload.playbackOffset,
      isHost: payload.isHost,
    }),

  addSong: (song) =>
    set((state) => ({
      songs: sortSongs([...state.songs, song]),
    })),

  updateVote: (songId, netVotes) =>
    set((state) => ({
      songs: sortSongs(
        state.songs.map((s) => (s.id === songId ? { ...s, netVotes } : s))
      ),
    })),

  setCurrentSong: (song) =>
    set((state) => ({
      currentSong: song,
      songs: song
        ? sortSongs(
            state.songs.map((s) =>
              s.id === song.id ? { ...s, status: 'playing' } : s
            )
          )
        : state.songs,
    })),

  addChatMessage: (msg) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, msg],
    })),

  addParticipant: (p) =>
    set((state) => ({
      participants: [...state.participants, p],
    })),

  removeParticipant: (id) =>
    set((state) => ({
      participants: state.participants.filter((p) => p.id !== id),
    })),

  setPartyEnded: (winner, stats) =>
    set((state) => ({
      winner,
      stats,
      party: state.party ? { ...state.party, status: 'ended' } : null,
    })),

  setPendingReaction: (song) =>
    set({ pendingReaction: song }),

  clearPendingReaction: () =>
    set({ pendingReaction: null }),

  setConnected: (connected) =>
    set({ isConnected: connected }),

  setParticipantId: (id) =>
    set({ participantId: id }),

  setClientToken: (token) => {
    localStorage.setItem('nero-client-token', token);
    set({ clientToken: token });
  },

  reset: () =>
    set({ ...initialState, clientToken: getOrCreateClientToken() }),
}));
