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
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <p className="text-gray-400">Loading results...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-4">
      <div className="text-center max-w-lg w-full">
        {/* Confetti header */}
        <div className="text-5xl mb-4 animate-bounce">🎉 ⭐ 🎉</div>

        <h1 className="text-3xl font-extrabold text-white mb-2">
          The Party Has Spoken!
        </h1>

        {winner ? (
          <>
            <div className="mt-6 bg-[#1a1a1a] rounded-2xl p-6 border border-[#7c3aed]">
              {winner.thumbnailUrl && (
                <img
                  src={winner.thumbnailUrl}
                  alt={winner.title}
                  className="w-32 h-32 rounded-xl mx-auto mb-4 object-cover"
                />
              )}
              <p className="text-2xl font-bold text-[#7c3aed]">{winner.title}</p>
              <p className="text-gray-400 mt-1">
                {winner.artist} · Added by {winner.addedByName}
              </p>
              <div className="mt-3 inline-flex items-center gap-1 bg-[#7c3aed]/20 text-[#7c3aed] px-3 py-1 rounded-full text-sm font-semibold">
                ▲ {winner.totalScore ?? 0} score
              </div>
              {winner.addedByAI && (
                <p className="text-xs text-[#ec4899] mt-2">
                  🤖 AI pick from &quot;{winner.aiPrompt}&quot;
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="text-gray-400 mt-4">No winner — no songs were voted on!</p>
        )}

        {/* Stats */}
        <div className="flex gap-6 justify-center mt-8">
          <div className="text-center">
            <div className="text-3xl font-extrabold text-[#7c3aed]">
              {stats.totalSongs}
            </div>
            <div className="text-xs text-gray-500 mt-1">Songs Played</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-extrabold text-[#7c3aed]">
              {stats.totalParticipants}
            </div>
            <div className="text-xs text-gray-500 mt-1">Participants</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-extrabold text-[#7c3aed]">
              {stats.totalReactions}
            </div>
            <div className="text-xs text-gray-500 mt-1">Reactions</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-extrabold text-[#7c3aed]">
              {stats.aiPicks}
            </div>
            <div className="text-xs text-gray-500 mt-1">AI Picks</div>
          </div>
        </div>

        {/* Back to home */}
        <button
          onClick={() => navigate('/')}
          className="mt-10 px-8 py-3 bg-[#7c3aed] text-white rounded-xl font-semibold hover:bg-[#6d28d9] transition-colors"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
