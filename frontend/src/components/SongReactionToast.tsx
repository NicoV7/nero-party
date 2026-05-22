import { useCallback, useEffect, useRef, useState } from 'react';
import { SONG_REACTION_TOAST_DISMISS_MS } from '../constants/player';
import { QUICK_REACTIONS } from '../constants/reactions';
import { socket } from '../lib/socket';
import { usePartyStore } from '../stores/partyStore';

export default function SongReactionToast() {
  const pendingReaction = usePartyStore((s) => s.pendingReaction);
  const clearPendingReaction = usePartyStore((s) => s.clearPendingReaction);

  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    setTimeout(() => {
      clearPendingReaction();
    }, 220);
  }, [clearPendingReaction]);

  // Show/hide animation and auto-dismiss
  useEffect(() => {
    if (pendingReaction) {
      requestAnimationFrame(() => setVisible(true));
      timerRef.current = setTimeout(() => {
        dismiss();
      }, SONG_REACTION_TOAST_DISMISS_MS);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dismiss, pendingReaction]);

  const handleReaction = (key: string) => {
    if (!pendingReaction) return;
    socket.emit('react-to-song', {
      songId: pendingReaction.songId,
      reaction: key,
    });
    dismiss();
  };

  if (!pendingReaction) return null;

  return (
    <div
      className={`fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md transition-[transform,opacity] duration-[220ms] ease-[var(--ease-ui)] ${
        visible
          ? '-translate-x-1/2 translate-y-0 opacity-100'
          : '-translate-x-1/2 translate-y-4 opacity-0'
      }`}
    >
      <div className="bg-nero-surface border border-nero-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Content */}
        <div className="px-5 pt-4 pb-3 text-center">
          <p className="text-xs text-nero-muted uppercase tracking-wider font-medium mb-2">
            How was that?
          </p>
          <p className="text-nero-text font-semibold truncate">
            {pendingReaction.title}
          </p>
          <p className="text-nero-muted text-sm truncate mb-4">
            {pendingReaction.artist}
          </p>

          {/* Reaction buttons */}
          <div className="flex items-center justify-center gap-3">
            {QUICK_REACTIONS.map(({ key, reaction, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => handleReaction(reaction)}
                className="group flex min-w-14 flex-col items-center gap-1.5 rounded-xl px-3 py-2 transition-[background-color,transform] duration-150 ease-[var(--ease-ui)] hover:bg-nero-surface-hover active:scale-[0.97]"
              >
                <span className="text-nero-muted transition-colors duration-150 ease-[var(--ease-ui)] group-hover:text-nero-accent">
                  <Icon />
                </span>
                <span className="text-[10px] text-nero-dim transition-colors duration-150 ease-[var(--ease-ui)] group-hover:text-nero-text">
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-nero-surface">
          <div
            className={`h-full origin-left bg-nero-accent transition-transform ease-linear ${visible ? 'scale-x-0' : 'scale-x-100'}`}
            style={{ transitionDuration: `${SONG_REACTION_TOAST_DISMISS_MS}ms` }}
          />
        </div>
      </div>
    </div>
  );
}
