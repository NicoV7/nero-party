import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePartyStore } from '../stores/partyStore';

export default function WinnerReveal() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { party, winner, stats } = usePartyStore();

  useEffect(() => {
    if (!party || party.status !== 'ended') {
      navigate(`/party/${code}`);
    }
  }, [party, code, navigate]);

  if (!party || !stats) {
    return (
      <div className="min-h-screen bg-nero-bg flex items-center justify-center">
        <p className="text-nero-muted">Loading results...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nero-bg flex items-center justify-center p-4">
      <div className="text-center max-w-lg w-full">
        {/* Confetti header */}
        <div className="flex items-center justify-center gap-3 mb-4 animate-bounce">
          <svg className="w-10 h-10 text-nero-accent" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
          <svg className="w-12 h-12 text-nero-accent" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
          <svg className="w-10 h-10 text-nero-accent" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
        </div>

        <h1 className="text-3xl font-extrabold text-nero-text mb-2">
          The Party Has Spoken!
        </h1>

        {winner ? (
          <>
            <div className="mt-6 bg-nero-surface rounded-2xl p-6 border border-nero-accent">
              {winner.thumbnailUrl && (
                <img
                  src={winner.thumbnailUrl}
                  alt={winner.title}
                  className="w-32 h-32 rounded-xl mx-auto mb-4 object-cover"
                />
              )}
              <p className="text-2xl font-bold text-nero-accent">{winner.title}</p>
              <p className="text-nero-muted mt-1">
                {winner.artist} · Added by {winner.addedByName}
              </p>
              <div className="mt-3 inline-flex items-center gap-1 bg-nero-accent/20 text-nero-accent px-3 py-1 rounded-full text-sm font-semibold">
                ▲ {winner.totalScore ?? 0} score
              </div>
              {winner.addedByAI && (
                <p className="text-xs text-[#ec4899] mt-2 flex items-center justify-center gap-1">
                  <svg className="w-3.5 h-3.5 inline-block" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 14.5M14.25 3.104c.251.023.501.05.75.082M19.8 14.5l-2.147 2.147m0 0a2.25 2.25 0 01-3.182 0L12 14.18l-2.471 2.467a2.25 2.25 0 01-3.182 0L4.2 14.5" />
                  </svg>
                  AI pick from &quot;{winner.aiPrompt}&quot;
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="text-nero-muted mt-4">No winner — no songs were voted on!</p>
        )}

        {/* Stats */}
        <div className="flex gap-6 justify-center mt-8">
          <div className="text-center">
            <div className="text-3xl font-extrabold text-nero-accent">
              {stats.totalSongs}
            </div>
            <div className="text-xs text-nero-dim mt-1">Songs Played</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-extrabold text-nero-accent">
              {stats.totalParticipants}
            </div>
            <div className="text-xs text-nero-dim mt-1">Participants</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-extrabold text-nero-accent">
              {stats.totalReactions}
            </div>
            <div className="text-xs text-nero-dim mt-1">Reactions</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-extrabold text-nero-accent">
              {stats.aiPicks}
            </div>
            <div className="text-xs text-nero-dim mt-1">AI Picks</div>
          </div>
        </div>

        {/* Back to home */}
        <button
          onClick={() => navigate('/')}
          className="mt-10 px-8 py-3 bg-nero-accent text-nero-bg rounded-xl font-semibold hover:bg-nero-accent-hover transition-colors"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
