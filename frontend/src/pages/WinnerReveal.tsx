import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePartyStore } from '../stores/partyStore';

const TrophyIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.996.178-1.768.65-2.08 1.377a2.265 2.265 0 00.267 2.264c.956 1.196 2.61 1.71 3.818 1.123m-2.005-4.764a9.06 9.06 0 002.005 4.764m-2.005-4.764L5.25 3M7.255 9c.388.469.85.882 1.372 1.222m0 0c.61.4 1.296.678 2.025.81M18.75 4.236c.996.178 1.768.65 2.08 1.377a2.265 2.265 0 01-.267 2.264c-.956 1.196-2.61 1.71-3.818 1.123m2.005-4.764a9.06 9.06 0 01-2.005 4.764m2.005-4.764L18.75 3m-2.495 6c-.388.469-.85.882-1.372 1.222m0 0a6.003 6.003 0 01-2.025.81" />
  </svg>
);

const FireIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
  </svg>
);

const HeartIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
  </svg>
);

const REACTION_LABELS: Record<string, { icon: typeof FireIcon; label: string }> = {
  fire: { icon: FireIcon, label: 'Fire' },
  heart: { icon: HeartIcon, label: 'Love' },
};

export default function WinnerReveal() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { party, winner, songResults, stats } = usePartyStore();

  useEffect(() => {
    if (!party || party.status !== 'ended') {
      navigate(`/party/${code}`);
    }
  }, [party, code, navigate]);

  if (!party || !stats) {
    return (
      <div className="min-h-[100dvh] bg-nero-bg flex items-center justify-center">
        <p className="text-nero-muted">Loading results...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-nero-bg px-4 py-12">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-nero-accent/10 text-nero-accent mb-4">
            <TrophyIcon />
          </div>
          <h1 className="text-3xl font-bold tracking-tighter text-nero-text">
            {party.name}
          </h1>
          <p className="text-nero-muted mt-1">The party has spoken.</p>
        </div>

        {/* Winner Card */}
        {winner ? (
          <div className="bg-nero-surface rounded-2xl border border-nero-border overflow-hidden mb-8">
            <div className="flex items-center gap-5 p-6">
              {winner.thumbnailUrl && (
                <img
                  src={winner.thumbnailUrl}
                  alt={winner.title}
                  className="w-24 h-24 rounded-xl object-cover shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-nero-accent tracking-widest uppercase mb-1">
                  Winner
                </p>
                <p className="text-xl font-semibold tracking-tight text-nero-text truncate">
                  {winner.title}
                </p>
                <p className="text-nero-muted text-sm truncate mt-0.5">
                  {winner.artist}
                </p>
                <p className="text-nero-dim text-xs mt-1">
                  Added by {winner.addedByName}
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-bold text-nero-accent">
                  {winner.totalScore ?? 0}
                </div>
                <div className="text-xs text-nero-dim">points</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-nero-surface rounded-2xl border border-nero-border p-8 text-center mb-8">
            <p className="text-nero-muted">No winner. No songs were voted on.</p>
          </div>
        )}

        {/* Leaderboard */}
        {songResults.length > 1 && (
          <div className="mb-8">
            <h2 className="text-sm font-medium text-nero-dim tracking-widest uppercase mb-3">
              All results
            </h2>
            <div className="bg-nero-surface rounded-xl border border-nero-border divide-y divide-nero-border overflow-hidden">
              {songResults.map((song, index) => (
                <div
                  key={song.id}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    index === 0 ? 'bg-nero-accent/5' : ''
                  }`}
                >
                  <span className={`text-sm font-semibold w-6 text-center shrink-0 ${
                    index === 0 ? 'text-nero-accent' : 'text-nero-dim'
                  }`}>
                    {index + 1}
                  </span>
                  <img
                    src={song.thumbnailUrl}
                    alt={song.title}
                    className="w-12 h-12 rounded-lg object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${
                      index === 0 ? 'text-nero-text' : 'text-nero-muted'
                    }`}>
                      {song.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-nero-dim truncate">
                        {song.addedByName}
                      </span>
                      {song.reactionBreakdown && Object.entries(song.reactionBreakdown).map(([key, count]) => {
                        const info = REACTION_LABELS[key];
                        if (!info || !count) return null;
                        const Icon = info.icon;
                        return (
                          <span key={key} className="flex items-center gap-0.5 text-xs text-nero-dim">
                            <Icon /> {count as number}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <span className={`text-sm font-semibold shrink-0 ${
                    index === 0 ? 'text-nero-accent' : 'text-nero-muted'
                  }`}>
                    {song.totalScore}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { value: stats.totalSongs, label: 'Songs played' },
            { value: stats.totalParticipants, label: 'Participants' },
            { value: stats.totalReactions, label: 'Reactions' },
            { value: stats.aiPicks, label: 'AI picks' },
          ].map((stat) => (
            <div key={stat.label} className="bg-nero-surface rounded-xl border border-nero-border p-4 text-center">
              <div className="text-2xl font-bold text-nero-text">{stat.value}</div>
              <div className="text-xs text-nero-dim mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Back */}
        <div className="text-center">
          <button
            onClick={() => navigate('/')}
            className="px-8 py-3 bg-nero-accent text-nero-bg rounded-xl font-semibold hover:bg-nero-accent-hover transition-colors"
          >
            Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
