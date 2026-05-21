import { usePartyStore } from '../stores/partyStore';

export default function Queue() {
  const songs = usePartyStore((s) => s.songs);

  const playingSong = songs.find((s) => s.status === 'playing');
  const queuedSongs = songs
    .filter((s) => s.status === 'queued')
    .sort((a, b) => a.position - b.position);
  const playedSongs = songs.filter((s) => s.status === 'played');

  const totalActive = queuedSongs.length + (playingSong ? 1 : 0);

  return (
    <div className="rounded-xl bg-[#1a1a1a] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
          Up Next
        </h2>
        <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
          {queuedSongs.length} {queuedSongs.length === 1 ? 'song' : 'songs'}
        </span>
      </div>

      {/* Queue list */}
      {totalActive === 0 && playedSongs.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <div className="text-3xl mb-3">🎶</div>
          <p className="text-gray-400 text-sm">
            No songs in the queue yet.
          </p>
          <p className="text-gray-500 text-xs mt-1">
            Search for songs or try AI Magic!
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {/* Currently playing song */}
          {playingSong && (
            <QueueItem song={playingSong} badge="NOW PLAYING" />
          )}

          {/* Queued songs with position numbers */}
          {queuedSongs.map((song, index) => (
            <QueueItem key={song.id} song={song} position={index + 1} />
          ))}

          {/* Played songs (grayed out) */}
          {playedSongs.map((song) => (
            <QueueItem key={song.id} song={song} played />
          ))}
        </div>
      )}
    </div>
  );
}

function QueueItem({
  song,
  badge,
  position,
  played,
}: {
  song: {
    id: string;
    title: string;
    artist: string;
    thumbnailUrl: string;
    addedByName: string;
    addedByAI: boolean;
    aiPrompt: string | null;
  };
  badge?: string;
  position?: number;
  played?: boolean;
}) {
  const addedLabel = song.addedByAI
    ? `AI pick from "${song.aiPrompt ?? 'vibes'}"`
    : `Added by ${song.addedByName}`;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition-colors ${
        played ? 'opacity-40' : 'hover:bg-white/[0.02]'
      }`}
    >
      {/* Position number or badge */}
      <div className="w-7 shrink-0 text-center">
        {badge ? (
          <span className="inline-block w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
        ) : position != null ? (
          <span className="text-xs font-medium text-gray-500">{position}</span>
        ) : (
          <span className="text-xs text-gray-600">--</span>
        )}
      </div>

      {/* Thumbnail */}
      <img
        src={song.thumbnailUrl}
        alt={song.title}
        className="w-12 h-12 rounded-md object-cover shrink-0 bg-white/5"
      />

      {/* Song info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white truncate">{song.title}</p>
          {badge && (
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-600/20 px-1.5 py-0.5 rounded">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 truncate">{song.artist}</p>
        <p className="text-xs text-gray-500 truncate mt-0.5">{addedLabel}</p>
      </div>
    </div>
  );
}
