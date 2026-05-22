import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QUICK_REACTIONS } from '../components/reactionOptions';
import { usePartyStore } from '../stores/partyStore';

const TrophyIcon = () => (
  <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.996.178-1.768.65-2.08 1.377a2.265 2.265 0 00.267 2.264c.956 1.196 2.61 1.71 3.818 1.123m-2.005-4.764a9.06 9.06 0 002.005 4.764m-2.005-4.764L5.25 3M7.255 9c.388.469.85.882 1.372 1.222m0 0c.61.4 1.296.678 2.025.81M18.75 4.236c.996.178 1.768.65 2.08 1.377a2.265 2.265 0 01-.267 2.264c-.956 1.196-2.61 1.71-3.818 1.123m2.005-4.764a9.06 9.06 0 01-2.005 4.764m2.005-4.764L18.75 3m-2.495 6c-.388.469-.85.882-1.372 1.222m0 0a6.003 6.003 0 01-2.025.81" />
  </svg>
);

const EmptyIcon = () => (
  <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
  </svg>
);

const reactionByKey = new Map<string, (typeof QUICK_REACTIONS)[number]>(
  QUICK_REACTIONS.map((reaction) => [reaction.reaction, reaction])
);

type ResultSong = ReturnType<typeof usePartyStore.getState>['songResults'][number];

function ReactionSummary({ song }: { song: ResultSong }) {
  const entries = Object.entries(song.reactionBreakdown ?? {}).filter(([, count]) => count > 0);

  if (entries.length === 0) {
    return <span className="text-xs font-medium text-[#8d8075]">No votes</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([key, count]) => {
        const reaction = reactionByKey.get(key);
        if (!reaction) return null;
        const Icon = reaction.icon;

        return (
          <span
            key={key}
            className="inline-flex items-center gap-1 rounded-full border border-[#eadcc8] bg-white px-2 py-1 text-xs font-bold text-[#5f554d]"
            title={reaction.label}
          >
            <Icon /> {count}
          </span>
        );
      })}
    </div>
  );
}

function ResultRow({ song, index }: { song: ResultSong; index: number }) {
  const isWinner = index === 0;

  return (
    <article
      className={`grid grid-cols-[2rem_4rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[2.5rem_5rem_minmax(0,1fr)_auto] ${
        isWinner ? 'bg-[#fff4e9]' : 'bg-white'
      }`}
    >
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black tabular-nums ${
          isWinner ? 'bg-nero-accent text-white' : 'bg-[#f3eadf] text-[#6f6258]'
        }`}
      >
        {index + 1}
      </div>

      <img
        src={song.thumbnailUrl}
        alt=""
        className="h-12 w-16 rounded-xl object-cover sm:h-14 sm:w-20"
      />

      <div className="min-w-0">
        <p className="truncate text-sm font-black text-nero-text sm:text-base">{song.title}</p>
        <p className="truncate text-xs font-semibold text-[#6f6258] sm:text-sm">
          {song.artist} · Added by {song.addedByName}
        </p>
        <div className="mt-2">
          <ReactionSummary song={song} />
        </div>
      </div>

      <div className="text-right">
        <p className={`text-2xl font-black tabular-nums ${isWinner ? 'text-nero-accent' : 'text-nero-text'}`}>
          {song.totalScore ?? 0}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8d8075]">
          score
        </p>
      </div>
    </article>
  );
}

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
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#fff8ef] px-5">
        <div className="w-full max-w-sm rounded-[1.75rem] border border-white/80 bg-white/80 p-8 text-center shadow-[0_24px_70px_-56px_rgba(41,35,30,0.45)] backdrop-blur-2xl">
          <p className="text-sm font-bold text-nero-text">Loading results...</p>
          <p className="mt-2 text-sm text-[#6f6258]">Pulling together the final leaderboard.</p>
        </div>
      </div>
    );
  }

  const rankedResults = songResults.length > 0 ? songResults : winner ? [winner as ResultSong] : [];
  const totalScore = rankedResults.reduce((sum, song) => sum + (song.totalScore ?? 0), 0);

  return (
    <main className="min-h-[100dvh] bg-[#fff8ef] text-nero-text">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(232,93,61,0.12),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(255,205,131,0.32),transparent_30%),linear-gradient(180deg,#fff8ef_0%,#fffdf8_58%,#fff3e5_100%)]" />

      <div className="relative mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        <header className="mb-5 flex items-center justify-between rounded-full border border-white/80 bg-white/72 px-3 py-3 shadow-[0_22px_70px_-58px_rgba(41,35,30,0.58)] backdrop-blur-2xl sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#29231e] text-white">
              <TrophyIcon />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-black sm:text-base">{party.name}</h1>
              <p className="truncate text-xs font-bold uppercase tracking-[0.16em] text-[#6f6258]">
                Final results
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/')}
            className="rounded-full bg-[#29231e] px-5 py-2.5 text-sm font-bold text-white shadow-[0_14px_34px_-26px_rgba(41,35,30,0.7)] transition-[background-color,transform] duration-150 ease-[var(--ease-ui)] hover:bg-[#3b332c] active:scale-[0.97]"
          >
            Home
          </button>
        </header>

        {winner ? (
          <section className="mb-5 overflow-hidden rounded-[2.25rem] border border-white/80 bg-white shadow-[0_34px_110px_-76px_rgba(41,35,30,0.62)]">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_360px]">
              <div className="relative min-h-[380px] overflow-hidden bg-[#201b17]">
                <img
                  src={winner.thumbnailUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full scale-105 object-cover opacity-70 blur-2xl"
                />
                <img
                  src={winner.thumbnailUrl}
                  alt={winner.title}
                  className="relative z-10 h-full min-h-[380px] w-full object-cover"
                />
                <div className="absolute inset-0 z-20 bg-[linear-gradient(180deg,rgba(41,35,30,0.02)_0%,rgba(41,35,30,0.74)_100%)]" />
                <div className="absolute bottom-5 left-5 z-30 rounded-full border border-white/25 bg-white/18 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white backdrop-blur-xl">
                  Winning music video
                </div>
              </div>

              <div className="flex flex-col justify-between gap-8 p-6 sm:p-8">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-nero-accent">Winner</p>
                  <h2 className="mt-3 text-4xl font-black leading-[0.95] tracking-tight text-nero-text sm:text-5xl">
                    {winner.title}
                  </h2>
                  <p className="mt-4 text-lg font-bold text-[#5f554d]">{winner.artist}</p>
                  <p className="mt-1 text-sm font-semibold text-[#7d7066]">Added by {winner.addedByName}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[1.5rem] bg-[#fff4e9] p-4">
                    <p className="text-4xl font-black tabular-nums text-nero-accent">{winner.totalScore ?? 0}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-[#7d7066]">winning score</p>
                  </div>
                  <div className="rounded-[1.5rem] bg-[#f3eadf] p-4">
                    <p className="text-4xl font-black tabular-nums text-nero-text">{rankedResults.length}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-[#7d7066]">songs ranked</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="mb-5 rounded-[2rem] border border-white/80 bg-white/82 p-10 text-center shadow-[0_28px_90px_-64px_rgba(41,35,30,0.56)] backdrop-blur-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-[#fff4e9] text-nero-accent">
              <EmptyIcon />
            </div>
            <h2 className="text-2xl font-black tracking-tight">No winner this round</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6f6258]">
              No songs received votes before the party ended.
            </p>
          </section>
        )}

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/82 shadow-[0_24px_80px_-62px_rgba(41,35,30,0.5)] backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-[#eadcc8] px-5 py-4">
              <div>
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-nero-text">Leaderboard</h2>
                <p className="mt-1 text-xs font-semibold text-[#6f6258]">Every song, ranked by room votes.</p>
              </div>
              <span className="rounded-full bg-[#f3eadf] px-3 py-1 text-xs font-bold text-[#6f6258]">
                {totalScore} total score
              </span>
            </div>

            {rankedResults.length > 0 ? (
              <div className="divide-y divide-[#eadcc8]">
                {rankedResults.map((song, index) => (
                  <ResultRow key={song.id} song={song} index={index} />
                ))}
              </div>
            ) : (
              <div className="px-5 py-10 text-center text-sm font-semibold text-[#6f6258]">
                No songs were available for ranking.
              </div>
            )}
          </div>

          <aside className="rounded-[1.75rem] border border-white/80 bg-white/82 p-5 shadow-[0_24px_80px_-62px_rgba(41,35,30,0.5)] backdrop-blur-2xl">
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-nero-text">Room recap</h2>
            <div className="mt-4 space-y-3">
              {[
                { value: stats.totalSongs, label: 'Songs played' },
                { value: stats.totalParticipants, label: 'People joined' },
                { value: stats.totalReactions, label: 'Votes cast' },
                { value: stats.aiPicks, label: 'Suggested picks' },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center justify-between rounded-[1.25rem] bg-[#fff8ef] px-4 py-3">
                  <span className="text-sm font-semibold text-[#6f6258]">{stat.label}</span>
                  <span className="font-mono text-xl font-black text-nero-text">{stat.value}</span>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
