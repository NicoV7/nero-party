import { useState, useRef, useEffect } from 'react';
import { socket } from '../lib/socket';
import { usePartyStore } from '../stores/partyStore';

export default function PlaybackControls() {
  const isHost = usePartyStore((s) => s.isHost);
  const currentSong = usePartyStore((s) => s.currentSong);
  const [isPlaying, setIsPlaying] = useState(true);
  const lastPrevClick = useRef(0);
  const songStartTime = useRef(Date.now());

  // Reset song start time when song changes
  useEffect(() => {
    songStartTime.current = Date.now();
  }, [currentSong?.id]);

  if (!currentSong) return null;

  const handlePlayPause = () => {
    if (isPlaying) {
      socket.emit('pause');
      setIsPlaying(false);
    } else {
      socket.emit('resume');
      setIsPlaying(true);
    }
  };

  // Previous button: restart current song, or go to previous song if
  // double-clicked or clicked within first 5 seconds of playback
  const handlePrev = () => {
    const now = Date.now();
    const timeSinceLastClick = now - lastPrevClick.current;
    const timeSinceSongStart = now - songStartTime.current;
    const isDoubleClick = timeSinceLastClick < 500;
    const isEarlyInSong = timeSinceSongStart < 5000;

    lastPrevClick.current = now;

    if (isDoubleClick || isEarlyInSong) {
      socket.emit('prev-song');
    } else {
      socket.emit('restart-song');
    }
  };

  const btnBase = "flex items-center justify-center rounded-full transition-all duration-200";
  const btnSmall = `${btnBase} w-10 h-10 text-gray-300 hover:text-white hover:bg-white/10`;
  const btnLarge = `${btnBase} w-14 h-14 bg-purple-600 text-white hover:bg-purple-500 hover:scale-105`;

  return (
    <div className="flex items-center justify-center gap-3 px-4 py-3">
      {/* Previous */}
      {isHost && (
        <button onClick={handlePrev} className={btnSmall} title="Previous (click: restart, double-click: previous song)">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
          </svg>
        </button>
      )}

      {/* Rewind 10s */}
      {isHost && (
        <button onClick={() => socket.emit('seek', { seconds: -10 })} className={btnSmall} title="Rewind 10s">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.5 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
          </svg>
        </button>
      )}

      {/* Play/Pause toggle */}
      <button onClick={handlePlayPause} className={btnLarge} title={isPlaying ? "Pause" : "Play"}>
        {isPlaying ? (
          <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Forward 10s */}
      {isHost && (
        <button onClick={() => socket.emit('seek', { seconds: 10 })} className={btnSmall} title="Forward 10s">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18 13c0 3.31-2.69 6-6 6s-6-2.69-6-6h-2c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8V1l-5 5 5 5V7c3.31 0 6 2.69 6 6z" />
          </svg>
        </button>
      )}

      {/* Next/Skip */}
      {isHost && (
        <button onClick={() => socket.emit('skip-song')} className={btnSmall} title="Next">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
          </svg>
        </button>
      )}
    </div>
  );
}
