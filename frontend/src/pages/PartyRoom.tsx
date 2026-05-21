import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket, connectSocket, disconnectSocket } from '../lib/socket';
import { usePartyStore } from '../stores/partyStore';
import Player from '../components/Player';
import Queue from '../components/Queue';
import SongSearch from '../components/SongSearch';
import ChatFeed from '../components/ChatFeed';
import Participants from '../components/Participants';
import ShareLink from '../components/ShareLink';
import SongReactionToast from '../components/SongReactionToast';

export default function PartyRoom() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const listenersAttached = useRef(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const clientToken = usePartyStore((s) => s.clientToken);
  const party = usePartyStore((s) => s.party);
  const setPartyState = usePartyStore((s) => s.setPartyState);
  const addSong = usePartyStore((s) => s.addSong);
  const setSongs = usePartyStore((s) => s.setSongs);
  const setCurrentSong = usePartyStore((s) => s.setCurrentSong);
  const addChatMessage = usePartyStore((s) => s.addChatMessage);
  const addParticipant = usePartyStore((s) => s.addParticipant);
  const removeParticipant = usePartyStore((s) => s.removeParticipant);
  const setPartyEnded = usePartyStore((s) => s.setPartyEnded);
  const setConnected = usePartyStore((s) => s.setConnected);
  const isHost = usePartyStore((s) => s.isHost);
  const setPendingReaction = usePartyStore((s) => s.setPendingReaction);
  const clearPendingReaction = usePartyStore((s) => s.clearPendingReaction);

  useEffect(() => {
    if (!code || listenersAttached.current) return;
    listenersAttached.current = true;

    connectSocket();

    // Emit join-room once connected (or immediately if already connected)
    const emitJoin = () => {
      socket.emit('join-room', { partyCode: code, clientToken });
    };

    if (socket.connected) {
      emitJoin();
    }

    socket.on('connect', () => {
      setConnected(true);
      emitJoin();
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('party-state', (payload) => {
      setPartyState(payload);
      setConnected(true);
    });

    socket.on('song-added', (data: any) => {
      // Backend emits the song object directly
      const song = data.song ?? data;
      addSong(song);
    });

    socket.on('ai-response', (payload: any) => {
      // Add each song from AI
      if (payload.songs && Array.isArray(payload.songs)) {
        for (const song of payload.songs) {
          addSong(song);
        }
      }
      // Add vibe card as a chat message
      if (payload.vibeCard) {
        addChatMessage({
          id: `ai-vibe-${Date.now()}`,
          participantName: null,
          content: typeof payload.vibeCard === 'string' ? payload.vibeCard : payload.vibeCard.reading,
          type: 'ai-vibe-card',
          createdAt: new Date().toISOString(),
        });
      }
    });

    socket.on('now-playing', (payload: any) => {
      setCurrentSong(payload.song ?? null);
    });

    socket.on('song-ended', (data: any) => {
      // Show reaction toast for the song that just ended
      const song = data.song ?? data;
      if (song?.id && song?.title && song?.artist) {
        setPendingReaction({
          songId: song.id,
          title: song.title,
          artist: song.artist,
        });
      }
    });

    socket.on('reaction-saved', () => {
      clearPendingReaction();
    });

    socket.on('chat-message', (data: any) => {
      addChatMessage({
        id: data.id,
        participantName: data.participant?.name ?? data.participantName ?? null,
        content: data.content,
        type: data.type,
        createdAt: data.createdAt,
      });
    });

    socket.on('reaction', (data: any) => {
      addChatMessage({
        id: `reaction-${Date.now()}-${Math.random()}`,
        participantName: data.participantName,
        content: data.emoji,
        type: 'reaction',
        createdAt: new Date().toISOString(),
      });
    });

    socket.on('queue-updated', (songs: any[]) => {
      setSongs(songs);
    });

    socket.on('participant-joined', (data: any) => {
      const participant = data.participant ?? data;
      addParticipant(participant);
    });

    socket.on('participant-left', (data: any) => {
      const participantId = data.participantId ?? data.id;
      removeParticipant(participantId);
    });

    socket.on('party-ended', (payload: any) => {
      setPartyEnded(payload.winner, payload.stats);
      navigate(`/party/${code}/results`);
    });

    socket.on('error', (payload: any) => {
      setErrorToast(payload.message ?? 'Something went wrong');
      setTimeout(() => setErrorToast(null), 5000);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('party-state');
      socket.off('song-added');
      socket.off('ai-response');
      socket.off('now-playing');
      socket.off('song-ended');
      socket.off('reaction-saved');
      socket.off('chat-message');
      socket.off('reaction');
      socket.off('queue-updated');
      socket.off('participant-joined');
      socket.off('participant-left');
      socket.off('party-ended');
      socket.off('error');
      disconnectSocket();
      listenersAttached.current = false;
    };
  }, [
    code,
    clientToken,
    navigate,
    setPartyState,
    addSong,
    setSongs,
    setCurrentSong,
    addChatMessage,
    addParticipant,
    removeParticipant,
    setPartyEnded,
    setConnected,
    setPendingReaction,
    clearPendingReaction,
  ]);

  if (!party) {
    return (
      <div className="min-h-screen bg-nero-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-nero-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-nero-muted text-sm">Joining the party...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-nero-bg text-nero-text flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-nero-border shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tighter">
            <span className="text-nero-accent">nero</span>party
          </h1>
          <span className="text-nero-dim">|</span>
          <span className="text-nero-text font-medium">{party.name}</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-nero-muted">
          <span className="px-2 py-1 rounded bg-nero-surface text-xs uppercase tracking-wider">
            {party.status}
          </span>
          {isHost && (
            <button
              onClick={() => {
                if (confirm('End the party and reveal the winner?')) {
                  socket.emit('end-party');
                }
              }}
              className="px-3 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/40 hover:text-red-300 text-xs font-medium transition-colors"
            >
              End Party
            </button>
          )}
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_380px] min-h-0 overflow-hidden">
        {/* Left panel — scrollable */}
        <div className="flex flex-col gap-4 p-4 overflow-y-auto min-h-0">
          <Player />
          <Queue />
          <SongSearch />
        </div>

        {/* Right panel */}
        <div className="hidden lg:flex flex-col border-l border-nero-border min-h-0 overflow-hidden">
          <div className="p-4 border-b border-nero-border shrink-0">
            <Participants />
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <ChatFeed />
          </div>
          <div className="p-4 border-t border-nero-border shrink-0">
            <ShareLink />
          </div>
        </div>
      </div>

      {/* Error toast */}
      {errorToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)]">
          <div className="bg-red-900/90 border border-red-700 text-red-200 px-4 py-3 rounded-xl shadow-2xl text-sm flex items-center justify-between gap-3">
            <span>{errorToast}</span>
            <button onClick={() => setErrorToast(null)} className="text-red-400 hover:text-nero-text shrink-0">&times;</button>
          </div>
        </div>
      )}

      {/* Song reaction toast overlay */}
      <SongReactionToast />
    </div>
  );
}
