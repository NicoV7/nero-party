import { useState } from 'react';
import { socket } from '../lib/socket';
import { usePartyStore } from '../stores/partyStore';

export default function Participants() {
  const participants = usePartyStore((s) => s.participants);
  const party = usePartyStore((s) => s.party);
  const isCurrentUserHost = usePartyStore((s) => s.isHost);
  const currentParticipantId = usePartyStore((s) => s.participantId);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={expanded}
      >
        <div>
          <h3 className="text-sm font-black tracking-tight text-nero-text">
            In the room
          </h3>
          <p className="mt-0.5 text-xs font-semibold text-nero-muted">
            {participants.length} {participants.length === 1 ? 'person' : 'people'}
          </p>
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-nero-surface-hover text-nero-muted transition-transform duration-150 ease-[var(--ease-ui)]">
          <svg
            className={`h-4 w-4 transition-transform duration-150 ease-[var(--ease-ui)] ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {!expanded && (
        <div className="mt-3 flex flex-wrap gap-2">
          {participants.slice(0, 8).map((p) => {
            const firstLetter = p.name.charAt(0).toUpperCase();

            return (
              <div
                key={p.id}
                className={`flex h-9 w-9 items-center justify-center rounded-md text-sm font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] ${
                  p.isConnected ? 'opacity-100' : 'opacity-45'
                }`}
                style={{ backgroundColor: p.avatarColor }}
                title={p.name}
              >
                {firstLetter}
              </div>
            );
          })}
          {participants.length > 8 && (
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-nero-surface-hover text-xs font-black text-nero-muted">
              +{participants.length - 8}
            </div>
          )}
        </div>
      )}

      {expanded && (
        <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto overscroll-contain pr-1">
          {participants.map((p) => {
            const isParticipantHost = p.name === party?.hostName;
            const firstLetter = p.name.charAt(0).toUpperCase();
            const canKick = isCurrentUserHost && !isParticipantHost && p.id !== currentParticipantId;

            return (
              <div
                key={p.id}
                className={`flex items-center gap-3 rounded-lg px-2 py-2 transition-[background-color,opacity] hover:bg-nero-surface-hover ${
                  p.isConnected ? 'opacity-100' : 'opacity-40'
                }`}
                title={`${p.name}${isParticipantHost ? ' (Host)' : ''}${
                  !p.isConnected ? ' (disconnected)' : ''
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-sm font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] ${
                    isParticipantHost ? 'ring-2 ring-nero-accent ring-offset-2 ring-offset-nero-bg' : ''
                  }`}
                  style={{ backgroundColor: p.avatarColor }}
                >
                  {firstLetter}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-nero-text">{p.name}</p>
                  <p className="text-xs font-semibold text-nero-muted">
                    {isParticipantHost ? 'Host' : p.isConnected ? 'In room' : 'Disconnected'}
                  </p>
                </div>
                {canKick && (
                  <button
                    type="button"
                    onClick={() => socket.emit('kick-participant', { participantId: p.id })}
                    className="rounded-md border border-nero-border bg-nero-surface px-2.5 py-1.5 text-xs font-bold text-nero-muted transition-[border-color,color,background-color,transform] duration-150 ease-[var(--ease-ui)] hover:border-nero-accent hover:bg-white hover:text-nero-accent active:scale-[0.97]"
                  >
                    Kick
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
