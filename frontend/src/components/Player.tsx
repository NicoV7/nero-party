import { useEffect, useRef } from 'react';
import { socket } from '../lib/socket';
import { usePartyStore } from '../stores/partyStore';
import PlaybackControls from './PlaybackControls';

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

  // Auto-initialize YouTube player on mount — no click gate needed
  useEffect(() => {
    let mounted = true;

    loadYouTubeAPI().then(() => {
      if (!mounted || !containerRef.current || playerRef.current) return;

      playerRef.current = new window.YT.Player(containerRef.current, {
        height: '100%',
        width: '100%',
        playerVars: {
          autoplay: 1,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          fs: 0,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            playerReady.current = true;
            // If a song is already set, load it now
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

  // Listen for playback-control events to sync play/pause/seek across clients
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
            player.seekTo(data.seconds, true);
          }
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

  // Load video when currentSong changes
  useEffect(() => {
    if (!currentSong) return;
    loadVideo(currentSong.youtubeVideoId, playbackOffset);
  }, [currentSong?.youtubeVideoId, playbackOffset]);

  return (
    <div className="rounded-xl bg-[#1a1a1a] overflow-hidden">
      {/* Player area */}
      <div className="relative w-full aspect-video max-h-[38vh]">
        <div ref={containerRef} className="absolute inset-0" />
        {!currentSong && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a1a]">
            <div className="text-5xl mb-3">🎵</div>
            <p className="text-gray-400 text-sm">Waiting for the first song...</p>
            <p className="text-gray-600 text-xs mt-1">Search below or try AI Magic</p>
          </div>
        )}
      </div>

      {/* Now playing info */}
      {currentSong && (
        <div className="px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs text-purple-400 uppercase tracking-wider font-medium mb-1">
              Now Playing
            </p>
            <p className="text-white font-semibold truncate">
              {currentSong.title}
            </p>
            <p className="text-gray-400 text-sm truncate">
              {currentSong.artist} · Added by {currentSong.addedByName}
            </p>
          </div>
        </div>
      )}

      {/* Playback controls */}
      <PlaybackControls />
    </div>
  );
}
