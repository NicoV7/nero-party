import { socket } from '../lib/socket';
import { usePartyStore } from '../stores/partyStore';
import { QUICK_REACTIONS } from './reactionOptions';

export default function SongLeaderboard() {
  const leaderboard = usePartyStore((s) => s.leaderboard);
  const songs = usePartyStore((s) => s.songs);
  const currentSong = usePartyStore((s) => s.currentSong);

  const visibleSongs = leaderboard.length > 0
    ? leaderboard
    : songs.map((song) => ({
        ...song,
        totalScore: song.totalScore ?? 0,
        reactionCount: 0,
        reactionBreakdown: {},
      }));

  const rankedSongs = [...visibleSongs]
    .sort((a, b) => {
      if ((b.totalScore ?? 0) !== (a.totalScore ?? 0)) {
        return (b.totalScore ?? 0) - (a.totalScore ?? 0);
      }
      if (a.status === 'playing') return -1;
      if (b.status === 'playing') return 1;
      return a.position - b.position;
    })
    .slice(0, 6);

  const handleVote = (songId: string, reaction: string) => {
    socket.emit('react-to-song', { songId, reaction });
  };

  return (
    <div className="flex max-h-[430px] flex-col">
      <div className="border-b border-nero-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-nero-text">
              Leaderboard
            </h2>
            <p className="mt-1 text-xs text-nero-muted">
              Vote on any song. Scores update for the room.
            </p>
          </div>
          <span className="rounded-full bg-nero-surface-hover px-3 py-1 text-xs font-bold text-nero-muted">
            Live
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {rankedSongs.length === 0 ? (
          <div className="rounded-2xl bg-nero-surface-hover px-4 py-8 text-center">
            <p className="text-sm font-bold text-nero-text">No songs to rank yet</p>
            <p className="mt-1 text-xs text-nero-muted">Add the first song and the board appears here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rankedSongs.map((song, index) => {
              const isPlaying = currentSong?.id === song.id || song.status === 'playing';
              const score = song.totalScore ?? 0;

              return (
                <article
                  key={song.id}
                  className={`rounded-2xl border p-3 transition-[background-color,border-color,box-shadow] duration-200 ease-[var(--ease-ui)] ${
                    isPlaying
                      ? 'border-nero-accent/35 bg-nero-accent/8'
                      : 'border-nero-border bg-white'
                  }`}
                >
                  <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
                    <div className="flex w-8 flex-col items-center">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                        index === 0 ? 'bg-nero-accent text-white' : 'bg-nero-surface-hover text-nero-muted'
                      }`}>
                        {index + 1}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex gap-2.5">
                        <img
                          src={song.thumbnailUrl}
                          alt=""
                          className="h-14 w-16 shrink-0 rounded-xl object-cover"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-nero-text">{song.title}</p>
                              <p className="truncate text-xs font-medium text-nero-muted">
                                {song.artist}
                              </p>
                              <p className="truncate text-[11px] font-medium text-nero-dim">
                                Added by {song.addedByName}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-lg font-black tabular-nums text-nero-text">{score}</p>
                              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-nero-dim">
                                score
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {QUICK_REACTIONS.map((reaction) => {
                          const Icon = reaction.icon;

                          return (
                            <button
                              key={reaction.key}
                              type="button"
                              onClick={() => handleVote(song.id, reaction.reaction)}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-nero-border bg-nero-surface text-nero-muted transition-[border-color,color,background-color,transform] duration-150 ease-[var(--ease-ui)] hover:border-nero-accent hover:text-nero-accent active:scale-[0.97]"
                              title={`${reaction.label} (${reaction.score})`}
                              aria-label={`${reaction.label} vote for ${song.title}`}
                            >
                              <Icon />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
