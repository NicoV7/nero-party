import { useState, useCallback, useRef, type SyntheticEvent } from 'react';
import { socket } from '../lib/socket';
import { usePartyStore } from '../stores/partyStore';
import { API_URL } from '../constants/api';

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
  const isHost = usePartyStore((s) => s.isHost);
  const maxSongs = party?.maxSongsPerPerson ?? 5;
  const canAddSongs = party?.addMode !== 'host' || isHost;

  const mySongCount = songs.filter(
    (s: any) => s.addedById === participantId
  ).length;
  const songsRemaining = Math.max(0, maxSongs - mySongCount);
  const addDisabled = !canAddSongs || songsRemaining <= 0;

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
    if (addDisabled) return;

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

  const handleThumbnailError = (event: SyntheticEvent<HTMLImageElement>, videoId: string) => {
    const image = event.currentTarget;
    const fallback = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
    if (image.src !== fallback) {
      image.src = fallback;
    }
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
            disabled={addDisabled}
            className="flex-1 bg-nero-surface border border-nero-border rounded-lg px-4 py-3 text-nero-text placeholder-nero-dim focus:outline-none focus:border-nero-accent transition-colors disabled:opacity-50"
          />
          <button
            onClick={() => searchYouTube(query)}
            disabled={!query.trim() || loading || addDisabled}
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
            {canAddSongs ? `${songsRemaining} left` : 'Host only'}
          </span>
        </div>

        {!canAddSongs && (
          <p className="mt-2 text-sm font-medium text-nero-muted">
            This room is set so only the host can add songs.
          </p>
        )}

        {error && (
          <p className="mt-2 text-sm text-red-400">{error}</p>
        )}

        {/* Search Results */}
        {results.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-xl border border-nero-border bg-nero-surface shadow-[0_18px_50px_-42px_rgba(36,31,27,0.48)]">
            <div className="flex items-center justify-between border-b border-nero-border px-3 py-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-nero-muted">
                YouTube results
              </span>
              <span className="text-xs font-semibold text-nero-secondary">
                Showing {results.length} results
              </span>
            </div>
            <div className="max-h-[22rem] overflow-y-auto overscroll-contain pr-1">
              {results.map((result) => (
                <button
                  key={result.videoId}
                  onClick={() => handleAddSong(result)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-nero-surface-hover focus-visible:bg-nero-surface-hover focus-visible:outline-none"
                >
                  <img
                    src={result.thumbnailUrl}
                    alt=""
                    onError={(event) => handleThumbnailError(event, result.videoId)}
                    className="h-11 w-16 flex-shrink-0 rounded-md object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-nero-text">
                      {decodeHtml(result.title)}
                    </p>
                    <p className="truncate text-xs text-nero-muted">
                      {decodeHtml(result.artist)}
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-xs font-bold text-nero-secondary">
                    Add
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
