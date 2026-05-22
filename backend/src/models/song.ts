import type { Song } from "@prisma/client";

type SongWithAddedBy = Song & {
  addedBy?: {
    id: string;
    name: string;
    avatarColor: string;
  };
};

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
  reactionBreakdown: Record<string, number>;
  reactionCount: number;
}

export function toSongData(song: SongWithAddedBy): SongData {
  return {
    id: song.id,
    youtubeVideoId: song.youtubeVideoId,
    title: song.title,
    artist: song.artist,
    thumbnailUrl: song.thumbnailUrl,
    addedById: song.addedBy?.id ?? song.addedById ?? null,
    addedByName: song.addedBy?.name ?? "Unknown",
    position: song.position,
    status: song.status,
    netVotes: 0,
    totalScore: 0,
    userVote: null,
  };
}
