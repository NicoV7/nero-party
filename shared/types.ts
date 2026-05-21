// ─── Client → Server Payloads ────────────────────────────────────────────────

export interface AddSongPayload {
  youtubeVideoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
}

export interface AiSuggestPayload {
  prompt: string;
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

export interface VibeCard {
  reading: string;
  emoji: string;
}

export interface SongData {
  id: string;
  youtubeVideoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  addedById: string | null;
  addedByName: string;
  addedByAI: boolean;
  aiPrompt: string | null;
  position: number;
  status: string;
  netVotes: number;
  totalScore: number;
  userVote: number | null;
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
  type: 'chat' | 'system' | 'ai-vibe-card' | 'reaction';
  createdAt: string;
}

export interface AiResponsePayload {
  vibeCard: VibeCard;
  songs: SongData[];
}

export interface PartyStatePayload {
  party: {
    id: string;
    name: string;
    code: string;
    hostName: string;
    maxSongsPerPerson: number;
    maxDurationMinutes: number;
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
  stats: {
    totalSongs: number;
    totalParticipants: number;
    totalReactions: number;
    aiPicks: number;
  };
}

export interface VoteUpdatedPayload {
  songId: string;
  netVotes: number;
}

export interface NowPlayingPayload {
  song: SongData;
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
  'ai-suggest': (payload: AiSuggestPayload) => void;
  'vote': (payload: VotePayload) => void;
  'chat-message': (payload: ChatMessagePayload) => void;
  'reaction': (payload: ReactionPayload) => void;
  'skip-song': () => void;
  'end-party': () => void;
  'join-room': (payload: { partyCode: string; clientToken: string }) => void;
}

export interface ServerToClientEvents {
  'party-state': (payload: PartyStatePayload) => void;
  'song-added': (payload: SongAddedPayload) => void;
  'ai-response': (payload: AiResponsePayload) => void;
  'vote-updated': (payload: VoteUpdatedPayload) => void;
  'now-playing': (payload: NowPlayingPayload) => void;
  'chat-message': (payload: ChatMessageData) => void;
  'reaction': (payload: { participantName: string; emoji: string }) => void;
  'participant-joined': (payload: ParticipantJoinedPayload) => void;
  'participant-left': (payload: { participantId: string }) => void;
  'party-ended': (payload: PartyEndedPayload) => void;
  'error': (payload: ErrorPayload) => void;
}

// ─── REST API Types ──────────────────────────────────────────────────────────

export interface CreatePartyRequest {
  name: string;
  hostName: string;
  maxSongsPerPerson?: number;
  maxDurationMinutes?: number;
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
}
