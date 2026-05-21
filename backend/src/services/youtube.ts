import { env } from "../env.js";

export interface YouTubeResult {
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
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
    maxResults: "1",
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
    thumbnailUrl: item.snippet.thumbnails.high.url,
  };
}

export async function searchQuery(
  query: string,
  maxResults = 5
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
    maxResults: String(maxResults + 3),
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
    thumbnailUrl: item.snippet.thumbnails.high.url,
  }));
}

export async function searchMultipleSongs(
  songs: Array<{ title: string; artist: string }>
): Promise<YouTubeResult[]> {
  const results = await Promise.allSettled(
    songs.map((song) => searchSong(song.title, song.artist))
  );

  return results
    .filter(
      (result): result is PromiseFulfilledResult<YouTubeResult | null> =>
        result.status === "fulfilled"
    )
    .map((result) => result.value)
    .filter((value): value is YouTubeResult => value !== null);
}
