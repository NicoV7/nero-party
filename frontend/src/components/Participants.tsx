import { usePartyStore } from '../stores/partyStore';

export default function Participants() {
  const participants = usePartyStore((s) => s.participants);
  const party = usePartyStore((s) => s.party);

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-gray-400 mb-3">
        In the Room ({participants.length})
      </h3>

      <div className="flex flex-wrap gap-3">
        {participants.map((p) => {
          const isHost = p.name === party?.hostName;
          const firstLetter = p.name.charAt(0).toUpperCase();

          return (
            <div
              key={p.id}
              className={`flex flex-col items-center gap-1 transition-opacity ${
                p.isConnected ? 'opacity-100' : 'opacity-40'
              }`}
              title={`${p.name}${isHost ? ' (Host)' : ''}${
                !p.isConnected ? ' (disconnected)' : ''
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                  isHost ? 'ring-2 ring-[#7c3aed] ring-offset-2 ring-offset-[#0f0f0f]' : ''
                }`}
                style={{ backgroundColor: p.avatarColor }}
              >
                {firstLetter}
              </div>
              <span className="text-xs text-gray-400 max-w-[60px] truncate">
                {p.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
