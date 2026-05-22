import {
  DEFAULT_YOUTUBE_SEARCH_RESULTS,
  YOUTUBE_SEARCH_RESULT_BUFFER,
  YOUTUBE_SINGLE_RESULT_COUNT,
} from "../constants/youtube.js";
import { env } from "../env.js";

export interface YouTubeResult {
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
}

type YouTubeThumbnailSet = {
  default?: { url?: string };
  medium?: { url?: string };
  high?: { url?: string };
  standard?: { url?: string };
  maxres?: { url?: string };
};

function pickThumbnail(videoId: string, thumbnails: YouTubeThumbnailSet): string {
  return (
    thumbnails.high?.url ||
    thumbnails.medium?.url ||
    thumbnails.default?.url ||
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  );
}

export async function searchSong(
  title: string,
  artist: string
): Promise<YouTubeResult | null> {
  if (!env.YOUTUBE_API_KEY) {
    throw new Error(
      "YouTube API key not configured. Set YOUTUBE_API_KEY in .env"
    );
  }

  const params = new URLSearchParams({
    part: "snippet",
    q: `${title} ${artist} official audio`,
    type: "video",
    videoCategoryId: "10",
    maxResults: YOUTUBE_SINGLE_RESULT_COUNT,
    key: env.YOUTUBE_API_KEY,
  });

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params}`
  );

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(
        "YouTube Data API v3 is not enabled for your API key. Enable it at: https://console.cloud.google.com/apis/library/youtube.googleapis.com"
      );
    }
    throw new Error(
      `YouTube API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    return null;
  }

  const item = data.items[0];

  return {
    videoId: item.id.videoId,
    title: item.snippet.title,
    artist,
    thumbnailUrl: pickThumbnail(item.id.videoId, item.snippet.thumbnails),
  };
}

export async function searchQuery(
  query: string,
  maxResults = DEFAULT_YOUTUBE_SEARCH_RESULTS
): Promise<YouTubeResult[]> {
  if (!env.YOUTUBE_API_KEY) {
    throw new Error(
      "YouTube API key not configured. Set YOUTUBE_API_KEY in .env"
    );
  }

  const params = new URLSearchParams({
    part: "snippet",
    q: `${query} song`,
    type: "video",
    videoCategoryId: "10",
    maxResults: String(maxResults + YOUTUBE_SEARCH_RESULT_BUFFER),
    key: env.YOUTUBE_API_KEY,
  });

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params}`
  );

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(
        "YouTube Data API v3 is not enabled for your API key. Enable it at: https://console.cloud.google.com/apis/library/youtube.googleapis.com"
      );
    }
    throw new Error(
      `YouTube API error: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    return [];
  }

  // Filter out topic channels and non-playable results
  const filtered = data.items.filter((item: any) => {
    const channel = item.snippet.channelTitle || "";
    // Exclude "- Topic" auto-generated channels (not real videos)
    if (channel.endsWith("- Topic")) return false;
    // Exclude results with no videoId (channels/playlists that slipped through)
    if (!item.id?.videoId) return false;
    return true;
  });

  return filtered.slice(0, maxResults).map((item: any) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    artist: item.snippet.channelTitle,
    thumbnailUrl: pickThumbnail(item.id.videoId, item.snippet.thumbnails),
  }));
}
