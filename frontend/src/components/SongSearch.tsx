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
  const [mode, setMode] = useState<'search' | 'ai'>('search');
  const [query, setQuery] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showApiKeyBanner, setShowApiKeyBanner] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { party, songs, participantId } = usePartyStore();
  const maxSongs = party?.maxSongsPerPerson ?? 5;

  // Count songs added by the current user
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

          // Detect API-key / quota issues and show persistent banner
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

  const handleAiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim() || aiLoading || songsRemaining <= 0) return;

    setAiLoading(true);
    setAiError(null);
    socket.emit('ai-suggest', { prompt: aiPrompt.trim() });

    // Listen for the response once
    const handleResponse = () => {
      setAiLoading(false);
      setAiPrompt('');
    };
    const handleError = (payload: { message?: string }) => {
      setAiLoading(false);
      setAiError(payload.message ?? 'AI suggestion failed');
    };
    socket.once('ai-response', handleResponse);
    socket.once('error', handleError);

    // Safety timeout
    setTimeout(() => {
      setAiLoading(false);
      socket.off('ai-response', handleResponse);
      socket.off('error', handleError);
    }, 15000);
  };

  const decodeHtml = (html: string) => {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  };

  return (
    <div className="w-full">
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
              className="underline text-red-200 hover:text-white"
            >
              Check Google Cloud Console
            </a>
          </p>
        </div>
      )}

      {/* Mode Toggle */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setMode('search')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'search'
              ? 'bg-[#7c3aed] text-white'
              : 'bg-[#1a1a1a] text-gray-400 hover:text-white'
          }`}
        >
          Search
        </button>
        <button
          onClick={() => setMode('ai')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'ai'
              ? 'bg-gradient-to-r from-[#7c3aed] to-[#ec4899] text-white'
              : 'bg-[#1a1a1a] text-gray-400 hover:text-white'
          }`}
        >
          AI Magic
        </button>
        <span className="ml-auto text-sm text-gray-500">
          {songsRemaining} song{songsRemaining !== 1 ? 's' : ''} left
        </span>
      </div>

      {/* Search Mode */}
      {mode === 'search' && (
        <div className="relative">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Search songs..."
              disabled={songsRemaining <= 0}
              className="flex-1 bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#7c3aed] transition-colors disabled:opacity-50"
            />
            <button
              onClick={() => searchYouTube(query)}
              disabled={!query.trim() || loading || songsRemaining <= 0}
              className="bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 text-white px-4 py-3 rounded-lg transition-colors"
            >
              {loading ? (
                <svg
                  className="animate-spin h-5 w-5"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                'Search'
              )}
            </button>
          </div>

          {error && (
            <p className="mt-2 text-sm text-red-400">{error}</p>
          )}

          {/* Search Results Dropdown */}
          {results.length > 0 && (
            <div className="absolute z-10 mt-2 w-full bg-[#1a1a1a] border border-gray-700 rounded-lg overflow-hidden shadow-xl">
              {results.map((result) => (
                <button
                  key={result.videoId}
                  onClick={() => handleAddSong(result)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#252525] transition-colors text-left"
                >
                  <img
                    src={result.thumbnailUrl}
                    alt=""
                    className="w-12 h-9 rounded object-cover flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">
                      {decodeHtml(result.title)}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {decodeHtml(result.artist)}
                    </p>
                  </div>
                  <span className="text-[#7c3aed] text-xs font-medium flex-shrink-0">
                    + Add
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Magic Mode */}
      {mode === 'ai' && (
        <form onSubmit={handleAiSubmit}>
          <div className="relative rounded-lg bg-gradient-to-r from-[#7c3aed] to-[#ec4899] p-[1px]">
            <div className="bg-[#0f0f0f] rounded-lg">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder='Describe a mood or vibe...'
                disabled={aiLoading || songsRemaining <= 0}
                className="w-full bg-transparent px-4 py-3 text-white placeholder-gray-500 focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Try "sunset beach chill" or "post-workout energy"
          </p>
          {aiError && (
            <p className="mt-2 text-sm text-red-400">{aiError}</p>
          )}
          <button
            type="submit"
            disabled={!aiPrompt.trim() || aiLoading || songsRemaining <= 0}
            className="mt-3 w-full bg-gradient-to-r from-[#7c3aed] to-[#ec4899] hover:opacity-90 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-opacity flex items-center justify-center gap-2"
          >
            {aiLoading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Nero is thinking...
              </>
            ) : (
              'Generate with AI'
            )}
          </button>
        </form>
      )}
    </div>
  );
}
