export interface CreatePartyRequest {
  name?: string;
  hostName?: string;
  maxSongsPerPerson?: number;
  maxUsers?: number;
  maxDurationMinutes?: number;
  addMode?: string;
}

export interface JoinPartyRequest {
  name?: string;
  clientToken?: string;
}

export interface AddSongPayload {
  youtubeVideoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
}

export interface JoinRoomPayload {
  partyCode: string;
  clientToken: string;
}
