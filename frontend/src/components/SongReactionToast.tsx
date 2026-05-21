import { useEffect, useRef, useState } from 'react';
import { socket } from '../lib/socket';
import { usePartyStore } from '../stores/partyStore';

const DISMISS_TIMEOUT = 10_000; // 10 seconds

const FireIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z" />
  </svg>
);

const HeartIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
  </svg>
);

const MehIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
  </svg>
);

const ThumbsDownIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.498 15.25H4.372c-1.026 0-1.945-.694-2.054-1.715A12.137 12.137 0 012.25 12c0-2.848.992-5.464 2.649-7.521C5.293 3.987 5.985 3.75 6.704 3.75h2.544c.406 0 .799.156 1.089.448l.442.428a3.001 3.001 0 002.122.874h2.6a3 3 0 002.122-.874l.442-.428c.29-.292.683-.448 1.089-.448h.958c.719 0 1.411.237 1.805.729A11.955 11.955 0 0121.75 12c0 .437-.024.868-.068 1.293-.109 1.021-1.028 1.715-2.054 1.715h-1.126a.75.75 0 00-.707.497l-.96 2.7a2.25 2.25 0 01-2.124 1.545h-.002a2.25 2.25 0 01-2.21-1.824l-.504-2.74A.75.75 0 0011.252 15H7.498z" />
  </svg>
);

const reactions = [
  { key: 'fire', icon: FireIcon, label: 'Fire!' },
  { key: 'heart', icon: HeartIcon, label: 'Loved it' },
  { key: 'meh', icon: MehIcon, label: 'Meh' },
  { key: 'thumbsdown', icon: ThumbsDownIcon, label: 'Not for me' },
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
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)] transition-[transform,opacity] duration-300 ease-out ${
        visible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-8 opacity-0'
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
            {reactions.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => handleReaction(key)}
                className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-nero-surface-hover transition-colors group"
              >
                <span className="text-nero-muted group-hover:text-nero-accent group-hover:scale-110 transition-all">
                  <Icon />
                </span>
                <span className="text-[10px] text-nero-dim group-hover:text-nero-text transition-colors">
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-nero-surface">
          <div
            className="h-full bg-nero-accent transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
