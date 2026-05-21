import { useEffect, useRef, useState, useCallback } from 'react';
import { socket } from '../lib/socket';
import { usePartyStore } from '../stores/partyStore';
import PlayerControls from './PlayerControls';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }

    const existing = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]'
    );
    if (existing) {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };
      return;
    }

    window.onYouTubeIframeAPIReady = () => resolve();
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
}

export default function Player() {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const playerReady = useRef(false);
  const lastVideoId = useRef<string | null>(null);

  const currentSong = usePartyStore((s) => s.currentSong);
  const playbackOffset = usePartyStore((s) => s.playbackOffset);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const handleVideoClick = useCallback(() => {
    const player = playerRef.current;
    if (!player || !playerReady.current || !currentSong) return;
    const state = player.getPlayerState?.();
    if (state === 1) {
      player.pauseVideo();
      setIsPaused(true);
    } else {
      if (state === 0) player.seekTo(0, true);
      player.playVideo();
      setIsPaused(false);
    }
    setShowPlayIcon(true);
    setTimeout(() => setShowPlayIcon(false), 800);
  }, [currentSong]);

  useEffect(() => {
    let mounted = true;

    loadYouTubeAPI().then(() => {
      if (!mounted || !containerRef.current || playerRef.current) return;

      playerRef.current = new window.YT.Player(containerRef.current, {
        height: '100%',
        width: '100%',
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          fs: 0,
          playsinline: 1,
          disablekb: 1,
          iv_load_policy: 3,
          cc_load_policy: 0,
        },
        events: {
          onReady: () => {
            playerReady.current = true;
            const song = usePartyStore.getState().currentSong;
            const offset = usePartyStore.getState().playbackOffset;
            if (song) {
              loadVideo(song.youtubeVideoId, offset);
            }
          },
          onStateChange: (event: any) => {
            if (event.data === 0 && usePartyStore.getState().isHost) {
              socket.emit('skip-song');
            }
          },
        },
      });
    });

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const handlePlaybackControl = (data: { action: string; seconds?: number }) => {
      const player = playerRef.current;
      if (!player || !playerReady.current) return;

      switch (data.action) {
        case 'pause':
          player.pauseVideo();
          break;
        case 'resume':
          player.playVideo();
          break;
        case 'seek':
          if (typeof data.seconds === 'number') {
            const currentTime = player.getCurrentTime?.() ?? 0;
            const targetTime = Math.max(0, currentTime + data.seconds);
            player.seekTo(targetTime, true);
          }
          break;
        case 'restart':
          player.seekTo(0, true);
          break;
      }
    };

    socket.on('playback-control', handlePlaybackControl);
    return () => {
      socket.off('playback-control', handlePlaybackControl);
    };
  }, []);

  function loadVideo(videoId: string, offset: number | null) {
    const player = playerRef.current;
    if (!player || !playerReady.current) return;
    if (lastVideoId.current === videoId) return;

    lastVideoId.current = videoId;
    player.loadVideoById(videoId);
    if (offset && offset > 0) {
      setTimeout(() => {
        player.seekTo(offset / 1000, true);
      }, 500);
    }
  }

  useEffect(() => {
    if (!currentSong) return;
    loadVideo(currentSong.youtubeVideoId, playbackOffset);
  }, [currentSong?.youtubeVideoId, playbackOffset]);

  return (
    <div className="rounded-xl bg-nero-surface">
      {/* Video area — fixed height, iframe handles aspect ratio internally */}
      <div className="relative w-full h-[35vh] bg-black rounded-t-xl overflow-hidden">
        <div ref={containerRef} className="absolute inset-0" />
        {/* Transparent overlay: blocks YouTube UI, captures clicks for play/pause */}
        {currentSong && (
          <div
            className="absolute inset-0 z-10 cursor-pointer"
            onClick={handleVideoClick}
          >
            {showPlayIcon && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-black/60 rounded-full p-4 animate-pulse">
                  {isPaused ? (
                    <svg className="w-12 h-12 text-nero-text" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  ) : (
                    <svg className="w-12 h-12 text-nero-text ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {!currentSong && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-nero-surface">
            <svg className="w-12 h-12 text-nero-muted mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
            <p className="text-nero-text text-sm font-medium">No song playing</p>
            <p className="text-nero-dim text-xs mt-1">Search below to queue something up</p>
          </div>
        )}
      </div>

      {/* Now playing info */}
      {currentSong && (
        <div className="px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs text-nero-accent uppercase tracking-widest font-medium mb-1">
              Now Playing
            </p>
            <p className="text-lg text-nero-text font-semibold tracking-tight truncate">
              {currentSong.title}
            </p>
            <p className="text-nero-muted text-sm truncate">
              {currentSong.artist} · Added by {currentSong.addedByName}
            </p>
          </div>
        </div>
      )}

      {/* Custom playback controls */}
      <PlayerControls playerRef={playerRef} playerReady={playerReady} />
    </div>
  );
}
