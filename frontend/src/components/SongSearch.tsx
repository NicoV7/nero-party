import { useState, useCallback, useRef } from 'react';
import { socket } from '../lib/socket';
import { usePartyStore } from '../stores/partyStore';
import { API_URL } from '../lib/api';

interface SearchResult {
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
}

export default function SongSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApiKeyBanner, setShowApiKeyBanner] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { party, songs, participantId } = usePartyStore();
  const maxSongs = party?.maxSongsPerPerson ?? 5;

  const mySongCount = songs.filter(
    (s: any) => s.addedById === participantId
  ).length;
  const songsRemaining = Math.max(0, maxSongs - mySongCount);

  const searchYouTube = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      setError(null);
      setShowApiKeyBanner(false);

      try {
        const res = await fetch(
          `${API_URL}/api/search?q=${encodeURIComponent(q.trim())}`
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: `Search failed (${res.status})` }));
          const message = body.error ?? body.message ?? `Search failed (${res.status})`;

          if (
            res.status === 403 ||
            /403|not enabled|forbidden|quota/i.test(message)
          ) {
            setShowApiKeyBanner(true);
          }

          throw new Error(message);
        }

        const data: SearchResult[] = await res.json();
        setResults(data);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Search failed';
        setError(message);
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleSearchInput = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchYouTube(value);
    }, 400);
  };

  const handleAddSong = (result: SearchResult) => {
    if (songsRemaining <= 0) return;

    socket.emit('add-song', {
      youtubeVideoId: result.videoId,
      title: result.title,
      artist: result.artist,
      thumbnailUrl: result.thumbnailUrl,
    });

    setResults([]);
    setQuery('');
  };

  const decodeHtml = (html: string) => {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  };

  return (
    <div className="w-full shrink-0">
      {/* API Key / Quota Banner */}
      {showApiKeyBanner && (
        <div className="mb-3 rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-300">
          <p className="font-medium">YouTube API error</p>
          <p className="mt-1">
            The YouTube Data API may not be enabled or the quota has been
            exceeded.{' '}
            <a
              href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-red-200 hover:text-nero-text"
            >
              Check Google Cloud Console
            </a>
          </p>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Search songs..."
            disabled={songsRemaining <= 0}
            className="flex-1 bg-nero-surface border border-nero-border rounded-lg px-4 py-3 text-nero-text placeholder-nero-dim focus:outline-none focus:border-nero-accent transition-colors disabled:opacity-50"
          />
          <button
            onClick={() => searchYouTube(query)}
            disabled={!query.trim() || loading || songsRemaining <= 0}
            className="bg-nero-accent hover:bg-nero-accent-hover disabled:opacity-50 text-nero-bg px-4 py-3 rounded-lg transition-colors"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              'Search'
            )}
          </button>
          <span className="text-sm text-nero-dim shrink-0">
            {songsRemaining} left
          </span>
        </div>

        {error && (
          <p className="mt-2 text-sm text-red-400">{error}</p>
        )}

        {/* Search Results Dropdown */}
        {results.length > 0 && (
          <div className="absolute z-10 mt-2 w-full bg-nero-surface border border-nero-border rounded-lg overflow-hidden shadow-xl">
            {results.map((result) => (
              <button
                key={result.videoId}
                onClick={() => handleAddSong(result)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-nero-surface-hover transition-colors text-left"
              >
                <img
                  src={result.thumbnailUrl}
                  alt=""
                  className="w-12 h-9 rounded object-cover flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-nero-text truncate">
                    {decodeHtml(result.title)}
                  </p>
                  <p className="text-xs text-nero-muted truncate">
                    {decodeHtml(result.artist)}
                  </p>
                </div>
                <span className="text-nero-accent text-xs font-medium flex-shrink-0">
                  + Add
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
