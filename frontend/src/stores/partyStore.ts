import { create } from 'zustand';
import { SONG_STATUS_ORDER } from '../constants/party';
import type {
  SongData,
  ParticipantData,
  ChatMessageData,
  LeaderboardSongData,
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
  return [...songs].sort((a, b) => {
    const aOrder = SONG_STATUS_ORDER[a.status] ?? 1;
    const bOrder = SONG_STATUS_ORDER[b.status] ?? 1;

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
    maxUsers: number;
    maxDurationMinutes: number;
    addMode: 'everyone' | 'host';
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
  songResults: (SongData & { totalScore: number; reactionBreakdown: Record<string, number> })[];
  leaderboard: LeaderboardSongData[];
  stats: {
    totalSongs: number;
    totalParticipants: number;
    totalReactions: number;
  } | null;

  // Actions
  setPartyState: (state: PartyStatePayload) => void;
  addSong: (song: SongData) => void;
  setSongs: (songs: SongData[]) => void;
  updateVote: (songId: string, netVotes: number) => void;
  setCurrentSong: (song: SongData | null) => void;
  addChatMessage: (msg: ChatMessageData) => void;
  addParticipant: (p: ParticipantData) => void;
  removeParticipant: (id: string) => void;
  setPartyEnded: (winner: SongData | null, songResults: any[], stats: any) => void;
  setLeaderboard: (songs: LeaderboardSongData[]) => void;
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
  songResults: [],
  leaderboard: [],
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

  setSongs: (songs) =>
    set({ songs: sortSongs(songs) }),

  updateVote: (songId, netVotes) =>
    set((state) => ({
      songs: sortSongs(
        state.songs.map((s) => (s.id === songId ? { ...s, netVotes } : s))
      ),
    })),

  setCurrentSong: (song) =>
    set((state) => ({
      currentSong: song,
      songs: sortSongs(
        state.songs.map((s) => {
          if (song && s.id === song.id) return { ...s, status: 'playing' };
          if (s.status === 'playing') return { ...s, status: 'played' };
          return s;
        })
      ),
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

  setPartyEnded: (winner, songResults, stats) =>
    set((state) => ({
      winner,
      songResults,
      stats,
      party: state.party ? { ...state.party, status: 'ended' } : null,
    })),

  setLeaderboard: (leaderboard) =>
    set({ leaderboard }),

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
