// ─── Client → Server Payloads ────────────────────────────────────────────────

export interface AddSongPayload {
  youtubeVideoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
}

export interface VotePayload {
  songId: string;
  value: 1 | -1;
}

export interface ChatMessagePayload {
  content: string;
}

export interface ReactionPayload {
  emoji: string;
}

// ─── Server → Client Payloads ────────────────────────────────────────────────

export interface SongData {
  id: string;
  youtubeVideoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  addedById: string | null;
  addedByName: string;
  position: number;
  status: string;
  netVotes: number;
  totalScore: number;
  userVote: number | null;
}

export interface LeaderboardSongData extends SongData {
  reactionCount: number;
  reactionBreakdown: Record<string, number>;
}

export interface ParticipantData {
  id: string;
  name: string;
  avatarColor: string;
  isConnected: boolean;
}

export interface ChatMessageData {
  id: string;
  participantName: string | null;
  content: string;
  type: 'chat' | 'system' | 'reaction';
  createdAt: string;
}

export interface PartyStatePayload {
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
  };
  participantId: string | null;
  participants: ParticipantData[];
  songs: SongData[];
  chatMessages: ChatMessageData[];
  currentSong: SongData | null;
  playbackOffset: number | null;
  isHost: boolean;
}

export interface PartyEndedPayload {
  winner: SongData | null;
  songResults: (SongData & {
    totalScore: number;
    reactionBreakdown: Record<string, number>;
  })[];
  stats: {
    totalSongs: number;
    totalParticipants: number;
    totalReactions: number;
  };
}

export interface VoteUpdatedPayload {
  songId: string;
  netVotes: number;
}

export interface NowPlayingPayload {
  song: SongData | null;
}

export interface SongAddedPayload {
  song: SongData;
}

export interface ParticipantJoinedPayload {
  participant: ParticipantData;
}

export interface ErrorPayload {
  message: string;
}

// ─── Socket Event Maps ───────────────────────────────────────────────────────

export interface ClientToServerEvents {
  'add-song': (payload: AddSongPayload) => void;
  'vote': (payload: VotePayload) => void;
  'chat-message': (payload: ChatMessagePayload) => void;
  'reaction': (payload: ReactionPayload) => void;
  'skip-song': () => void;
  'end-party': () => void;
  'kick-participant': (payload: { participantId: string }) => void;
  'join-room': (payload: { partyCode: string; clientToken: string }) => void;
}

export interface ServerToClientEvents {
  'party-state': (payload: PartyStatePayload) => void;
  'leaderboard-updated': (payload: LeaderboardSongData[]) => void;
  'song-added': (payload: SongAddedPayload) => void;
  'vote-updated': (payload: VoteUpdatedPayload) => void;
  'now-playing': (payload: NowPlayingPayload) => void;
  'chat-message': (payload: ChatMessageData) => void;
  'reaction': (payload: { participantName: string; emoji: string }) => void;
  'participant-joined': (payload: ParticipantJoinedPayload) => void;
  'participant-left': (payload: { participantId: string }) => void;
  'party-ended': (payload: PartyEndedPayload) => void;
  'kicked': (payload: { message: string }) => void;
  'error': (payload: ErrorPayload) => void;
}

// ─── REST API Types ──────────────────────────────────────────────────────────

export interface CreatePartyRequest {
  name: string;
  hostName: string;
  maxSongsPerPerson?: number;
  maxUsers?: number;
  maxDurationMinutes?: number;
  addMode?: 'everyone' | 'host';
}

export interface CreatePartyResponse {
  code: string;
  hostToken: string;
}

export interface JoinPartyRequest {
  name: string;
  clientToken: string;
}

export interface JoinPartyResponse {
  participantId: string;
  partyCode: string;
}

export interface PartyInfoResponse {
  name: string;
  hostName: string;
  status: string;
  participantCount: number;
  maxUsers: number;
}
