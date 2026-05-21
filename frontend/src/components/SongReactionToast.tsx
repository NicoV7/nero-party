import { useEffect, useRef, useState } from 'react';
import { socket } from '../lib/socket';
import { usePartyStore } from '../stores/partyStore';

const DISMISS_TIMEOUT = 10_000; // 10 seconds

const reactions = [
  { emoji: '\uD83D\uDD25', label: 'Fire!' },
  { emoji: '\u2764\uFE0F', label: 'Loved it' },
  { emoji: '\uD83D\uDE10', label: 'Meh' },
  { emoji: '\uD83D\uDC4E', label: 'Not for me' },
] as const;

export default function SongReactionToast() {
  const pendingReaction = usePartyStore((s) => s.pendingReaction);
  const clearPendingReaction = usePartyStore((s) => s.clearPendingReaction);

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Show/hide animation and auto-dismiss
  useEffect(() => {
    if (pendingReaction) {
      // Trigger slide-up animation
      requestAnimationFrame(() => setVisible(true));
      startTimeRef.current = Date.now();
      setProgress(100);

      // Animate progress bar
      const animate = () => {
        const elapsed = Date.now() - startTimeRef.current;
        const remaining = Math.max(0, 100 - (elapsed / DISMISS_TIMEOUT) * 100);
        setProgress(remaining);
        if (remaining > 0) {
          animFrameRef.current = requestAnimationFrame(animate);
        }
      };
      animFrameRef.current = requestAnimationFrame(animate);

      // Auto-dismiss
      timerRef.current = setTimeout(() => {
        dismiss();
      }, DISMISS_TIMEOUT);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [pendingReaction]);

  const dismiss = () => {
    setVisible(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    // Wait for exit animation before clearing
    setTimeout(() => {
      clearPendingReaction();
    }, 300);
  };

  const handleReaction = (emoji: string) => {
    if (!pendingReaction) return;
    socket.emit('react-to-song', {
      songId: pendingReaction.songId,
      emoji,
    });
    dismiss();
  };

  if (!pendingReaction) return null;

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)] transition-all duration-300 ease-out ${
        visible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-8 opacity-0'
      }`}
    >
      <div className="bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Content */}
        <div className="px-5 pt-4 pb-3 text-center">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2">
            How was that?
          </p>
          <p className="text-white font-semibold truncate">
            {pendingReaction.title}
          </p>
          <p className="text-gray-400 text-sm truncate mb-4">
            {pendingReaction.artist}
          </p>

          {/* Reaction buttons */}
          <div className="flex items-center justify-center gap-3">
            {reactions.map(({ emoji, label }) => (
              <button
                key={label}
                onClick={() => handleReaction(emoji)}
                className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors group"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">
                  {emoji}
                </span>
                <span className="text-[10px] text-gray-500 group-hover:text-gray-300 transition-colors">
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-white/5">
          <div
            className="h-full bg-purple-500 transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
