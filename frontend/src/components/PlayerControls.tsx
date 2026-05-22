import { useState, useEffect, useRef, useCallback } from 'react';
import { socket } from '../lib/socket';
import { usePartyStore } from '../stores/partyStore';

interface PlayerControlsProps {
  playerRef: React.MutableRefObject<any>;
  playerReady: React.MutableRefObject<boolean>;
  onFullscreen: () => void;
  captionsEnabled: boolean;
  onToggleCaptions: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PlayerControls({
  playerRef,
  playerReady,
  onFullscreen,
  captionsEnabled,
  onToggleCaptions,
}: PlayerControlsProps) {
  const isHost = usePartyStore((s) => s.isHost);
  const currentSong = usePartyStore((s) => s.currentSong);

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [currentQuality, setCurrentQuality] = useState('auto');
  const [isSeeking, setIsSeeking] = useState(false);
  const [copied, setCopied] = useState(false);

  const lastPrevClick = useRef(0);
  const songStartTime = useRef(Date.now());
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    songStartTime.current = Date.now();
  }, [currentSong?.youtubeVideoId]);

  // Poll player state for timeline
  const updateProgress = useCallback(() => {
    const player = playerRef.current;
    if (player && playerReady.current && !isSeeking) {
      const ct = player.getCurrentTime?.() ?? 0;
      const dur = player.getDuration?.() ?? 0;
      setCurrentTime(ct);
      if (dur > 0) setDuration(dur);
    }
    animFrameRef.current = requestAnimationFrame(updateProgress);
  }, [playerRef, playerReady, isSeeking]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(updateProgress);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [updateProgress]);

  // Sync volume from player on mount
  useEffect(() => {
    const player = playerRef.current;
    if (player && playerReady.current) {
      const v = player.getVolume?.() ?? 100;
      setVolume(v);
      setIsMuted(player.isMuted?.() ?? false);
      const qualities = player.getAvailableQualityLevels?.() ?? [];
      setAvailableQualities(qualities);
    }
  }, [currentSong?.youtubeVideoId, playerRef, playerReady]);

  if (!currentSong) return null;

  const handlePlayPause = () => {
    if (!isHost) return;
    if (isPlaying) {
      socket.emit('pause');
      setIsPlaying(false);
    } else {
      socket.emit('resume');
      setIsPlaying(true);
    }
  };

  const handlePrev = () => {
    if (!isHost) return;
    const now = Date.now();
    const timeSinceLastClick = now - lastPrevClick.current;
    const timeSinceSongStart = now - songStartTime.current;
    lastPrevClick.current = now;

    if (timeSinceLastClick < 500 || timeSinceSongStart < 5000) {
      socket.emit('prev-song');
    } else {
      socket.emit('restart-song');
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
  };

  const handleSeekCommit = (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
    if (!isHost) return;
    setIsSeeking(false);
    const target = e.currentTarget;
    const val = parseFloat(target.value);
    const player = playerRef.current;
    if (player && playerReady.current) {
      player.seekTo(val, true);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    const player = playerRef.current;
    if (player) {
      player.setVolume(val);
      if (val === 0) player.mute(); else player.unMute();
    }
  };

  const toggleMute = () => {
    const player = playerRef.current;
    if (!player) return;
    if (isMuted) {
      player.unMute();
      player.setVolume(volume || 50);
      setIsMuted(false);
      if (volume === 0) setVolume(50);
    } else {
      player.mute();
      setIsMuted(true);
    }
  };

  const changeSpeed = (rate: number) => {
    const player = playerRef.current;
    if (player) player.setPlaybackRate(rate);
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  const changeQuality = (quality: string) => {
    const player = playerRef.current;
    if (player) player.setPlaybackQuality(quality);
    setCurrentQuality(quality);
    setShowQualityMenu(false);
  };

  const openOnYouTube = () => {
    window.open(`https://www.youtube.com/watch?v=${currentSong.youtubeVideoId}`, '_blank');
  };

  const shareVideo = () => {
    const url = `https://youtu.be/${currentSong.youtubeVideoId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  const qualityLabels: Record<string, string> = {
    hd1080: '1080p', hd720: '720p', large: '480p',
    medium: '360p', small: '240p', tiny: '144p', auto: 'Auto',
  };

  const btnBase = "flex shrink-0 items-center justify-center rounded-md transition-[background-color,color,filter,transform] duration-150 ease-[var(--ease-ui)] active:scale-[0.97]";
  const btnSmall = `${btnBase} h-9 w-9 text-nero-muted hover:bg-nero-surface-hover hover:text-nero-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nero-secondary`;
  const btnPlay = `${btnBase} h-12 w-12 rounded-full bg-nero-accent text-white shadow-[0_14px_30px_-22px_rgba(217,85,56,0.7)] hover:bg-nero-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nero-secondary`;

  return (
    <div className="px-4 pb-4 pt-1 sm:px-5">
      {/* Timeline scrubber */}
      <div className="mb-3 flex items-center gap-3">
        <span className="text-[11px] text-nero-dim w-10 text-right tabular-nums">
          {formatTime(currentTime)}
        </span>
        <div className="flex-1 relative group">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            onMouseDown={() => setIsSeeking(true)}
            onMouseUp={handleSeekCommit}
            onTouchStart={() => setIsSeeking(true)}
            onTouchEnd={handleSeekCommit}
            disabled={!isHost}
            className="w-full h-1 bg-nero-border rounded-full appearance-none cursor-pointer disabled:cursor-default
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-nero-text [&::-webkit-slider-thumb]:opacity-0
              group-hover:[&::-webkit-slider-thumb]:opacity-100 [&::-webkit-slider-thumb]:transition-opacity"
            style={{
              background: `linear-gradient(to right, #0f766e ${progress}%, #dccdb9 ${progress}%)`,
            }}
          />
        </div>
        <span className="text-[11px] text-nero-dim w-10 tabular-nums">
          {formatTime(duration)}
        </span>
      </div>

      {/* Controls row */}
      <div className="grid gap-2 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <div className="hidden lg:block" />

        {/* Center: transport controls */}
        <div className="flex items-center justify-center gap-1.5">
          {isHost && (
            <button onClick={handlePrev} className={btnSmall} title="Previous">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>
          )}
          {isHost && (
            <button onClick={() => socket.emit('seek', { seconds: -10 })} className={btnSmall} title="Rewind 10s">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 8H4V3" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.7 8A8 8 0 1112 20" />
                <text x="8.2" y="15.6" fill="currentColor" stroke="none" fontSize="6.5" fontWeight="800">10</text>
              </svg>
            </button>
          )}

          <button onClick={handlePlayPause} className={isHost ? btnPlay : `${btnPlay} opacity-50 cursor-default`} title={isPlaying ? "Pause" : "Play"} disabled={!isHost}>
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {isHost && (
            <button onClick={() => socket.emit('seek', { seconds: 10 })} className={btnSmall} title="Forward 10s">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 8h5V3" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.3 8A8 8 0 1012 20" />
                <text x="8.2" y="15.6" fill="currentColor" stroke="none" fontSize="6.5" fontWeight="800">10</text>
              </svg>
            </button>
          )}
          {isHost && (
            <button onClick={() => socket.emit('skip-song')} className={btnSmall} title="Next">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
          )}
        </div>

        {/* Right: utility controls (everyone) */}
        <div className="flex min-w-0 flex-wrap items-center justify-center gap-1.5 lg:justify-end">
          {/* Volume */}
          <button onClick={toggleMute} className={btnSmall} title={isMuted ? "Unmute" : "Mute"}>
            {isMuted || volume === 0 ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            ) : volume < 50 ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            )}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="hidden h-1 w-16 cursor-pointer appearance-none rounded-full bg-nero-border xl:block
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-nero-text"
          />

          {/* Speed */}
          <div className="relative">
            <button
              onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowQualityMenu(false); }}
              className={`${btnSmall} w-auto px-2 text-[11px] font-semibold`}
              title="Playback speed"
            >
              {playbackRate}x
            </button>
            {showSpeedMenu && (
              <div className="absolute bottom-full right-0 z-20 mb-1 overflow-hidden rounded-md border border-nero-border bg-nero-surface shadow-[0_18px_46px_-34px_rgba(36,31,27,0.46)]">
                {speeds.map((s) => (
                  <button
                    key={s}
                    onClick={() => changeSpeed(s)}
                    className={`block w-full px-4 py-2 text-left text-xs transition-colors hover:bg-nero-surface-hover ${s === playbackRate ? 'text-nero-secondary' : 'text-nero-text'}`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quality */}
          {availableQualities.length > 0 && (
            <div className="relative">
              <button
                onClick={() => { setShowQualityMenu(!showQualityMenu); setShowSpeedMenu(false); }}
                className={btnSmall}
                title="Quality"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
                </svg>
              </button>
              {showQualityMenu && (
                <div className="absolute bottom-full right-0 z-20 mb-1 min-w-24 origin-bottom-right overflow-hidden rounded-md border border-nero-border bg-nero-surface shadow-[0_18px_46px_-34px_rgba(36,31,27,0.46)]">
                  {availableQualities.map((q) => (
                    <button
                      key={q}
                      onClick={() => changeQuality(q)}
                      className={`block w-full px-4 py-2 text-left text-xs transition-colors duration-150 ease-[var(--ease-ui)] hover:bg-nero-surface-hover ${q === currentQuality ? 'text-nero-secondary' : 'text-nero-text'}`}
                    >
                      {qualityLabels[q] ?? q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Link to YouTube */}
          <button
            onClick={onToggleCaptions}
            className={`${btnSmall} w-auto px-2 text-[11px] font-black ${captionsEnabled ? 'bg-nero-surface-hover text-nero-secondary' : ''}`}
            title={captionsEnabled ? 'Hide captions' : 'Show captions'}
          >
            CC
          </button>

          <button onClick={onFullscreen} className={btnSmall} title="Fullscreen">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 3H4a1 1 0 00-1 1v4m13-5h4a1 1 0 011 1v4M8 21H4a1 1 0 01-1-1v-4m18 0v4a1 1 0 01-1 1h-4" />
            </svg>
          </button>

          <button onClick={openOnYouTube} className={btnSmall} title="Open on YouTube">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
            </svg>
          </button>

          {/* Share / copy link */}
          <button onClick={shareVideo} className={btnSmall} title={copied ? "Copied!" : "Copy video link"}>
            {copied ? (
              <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
