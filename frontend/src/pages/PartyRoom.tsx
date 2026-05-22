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
import SongLeaderboard from '../components/SongLeaderboard';

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
  const setLeaderboard = usePartyStore((s) => s.setLeaderboard);
  const setConnected = usePartyStore((s) => s.setConnected);
  const isConnected = usePartyStore((s) => s.isConnected);
  const isHost = usePartyStore((s) => s.isHost);
  const setPendingReaction = usePartyStore((s) => s.setPendingReaction);
  const clearPendingReaction = usePartyStore((s) => s.clearPendingReaction);
  const reset = usePartyStore((s) => s.reset);

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

    socket.on('leaderboard-updated', (songs: any[]) => {
      setLeaderboard(songs);
    });

    socket.on('song-added', (data: any) => {
      // Backend emits the song object directly
      const song = data.song ?? data;
      addSong(song);
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
      setPartyEnded(payload.winner, payload.songResults ?? [], payload.stats);
      navigate(`/party/${code}/results`);
    });

    socket.on('kicked', (payload: any) => {
      setErrorToast(payload.message ?? 'You were removed from this room.');
      setTimeout(() => {
        reset();
        navigate('/');
      }, 1600);
    });

    socket.on('error', (payload: any) => {
      setErrorToast(payload.message ?? 'Something went wrong');
      setTimeout(() => setErrorToast(null), 5000);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('party-state');
      socket.off('leaderboard-updated');
      socket.off('song-added');
      socket.off('now-playing');
      socket.off('song-ended');
      socket.off('reaction-saved');
      socket.off('chat-message');
      socket.off('reaction');
      socket.off('queue-updated');
      socket.off('participant-joined');
      socket.off('participant-left');
      socket.off('party-ended');
      socket.off('kicked');
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
    setLeaderboard,
    setConnected,
    setPendingReaction,
    clearPendingReaction,
    reset,
  ]);

  if (!party) {
    return (
      <div className="min-h-[100dvh] bg-nero-bg flex items-center justify-center px-5">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-[1.75rem] border border-nero-border bg-nero-surface p-8 text-center shadow-[0_24px_70px_-56px_rgba(41,35,30,0.45)]">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-nero-accent border-t-transparent" />
          <p className="text-sm font-bold text-nero-text">Joining the party...</p>
          <p className="text-sm text-nero-muted">Connecting to the shared room and syncing the queue.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-nero-bg text-nero-text">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_8%,rgba(217,85,56,0.12),transparent_34%),radial-gradient(circle_at_92%_2%,rgba(15,118,110,0.16),transparent_30%),linear-gradient(180deg,#fff9f2_0%,#fffdf8_58%,#f5eadb_100%)]" />

      <header className="relative z-30 px-3 pb-2 pt-3 sm:px-6">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 rounded-xl border border-white/75 bg-white/74 px-3 py-2.5 shadow-[0_22px_70px_-58px_rgba(36,31,27,0.58)] shadow-nero-accent/5 backdrop-blur-2xl sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 shrink-0 items-center justify-center rounded-lg bg-nero-text px-3 text-sm font-black uppercase tracking-[0.18em] text-white shadow-[0_14px_34px_-26px_rgba(36,31,27,0.75)]">
              <span className="text-nero-accent">nero</span>
              <span className="ml-1 text-white">party</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-black tracking-tight sm:text-base">
                  {party.name}
                </h1>
                <span className={`h-2 w-2 shrink-0 rounded-full ${isConnected ? 'bg-nero-secondary' : 'bg-nero-dim'}`} />
              </div>
              <p className="mt-0.5 truncate text-xs font-bold uppercase tracking-[0.16em] text-nero-muted">
                {isConnected ? 'Live listening room' : 'Reconnecting'}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div className="rounded-md border border-nero-border/80 bg-nero-bg/80 px-3 py-2 text-xs font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] sm:px-4 sm:text-sm">
              <span className="hidden text-nero-muted sm:inline">Code</span>
              <span className="ml-0 font-mono tracking-[0.18em] text-nero-accent sm:ml-2">{party.code}</span>
            </div>
            <div className="hidden rounded-md border border-nero-border/80 bg-nero-bg/80 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-nero-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] sm:block">
              {isHost ? 'Host' : 'Guest'}
            </div>
            {isHost && (
              <button
                onClick={() => {
                  if (confirm('End the party and reveal the winner?')) {
                    socket.emit('end-party');
                  }
                }}
                className="rounded-md bg-nero-text px-4 py-2 text-sm font-bold text-white shadow-[0_12px_30px_-24px_rgba(36,31,27,0.7)] transition-[background-color,transform] duration-150 ease-[var(--ease-ui)] hover:bg-[#362f29] active:scale-[0.97]"
              >
                End
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="relative mx-auto grid max-w-[1600px] gap-4 px-4 pb-4 pt-5 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)_340px] xl:grid-cols-[270px_minmax(0,1fr)_380px]">
        <aside className="order-2 space-y-4 lg:order-1">
          <section className="rounded-xl border border-white/80 bg-white/80 p-4 shadow-[0_18px_58px_-52px_rgba(36,31,27,0.42)] backdrop-blur-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-nero-muted">Room code</p>
                <p className="mt-1 font-mono text-2xl font-black tracking-[0.22em] text-nero-accent">{party.code}</p>
              </div>
              <span className="rounded-md bg-nero-surface-hover px-3 py-1 text-xs font-bold text-nero-secondary">
                {party.status}
              </span>
            </div>
            <ShareLink />
          </section>

          <section className="rounded-xl border border-white/80 bg-white/80 p-4 shadow-[0_18px_58px_-52px_rgba(36,31,27,0.42)] backdrop-blur-2xl">
            <Participants />
          </section>

          <section className="overflow-hidden rounded-xl border border-white/80 bg-white/80 shadow-[0_18px_58px_-52px_rgba(36,31,27,0.42)] backdrop-blur-2xl">
            <SongLeaderboard />
          </section>
        </aside>

        <section className="order-1 min-w-0 space-y-4 lg:order-2">
          <Player />

          <div className="rounded-xl border border-white/80 bg-white/80 p-4 shadow-[0_18px_58px_-52px_rgba(36,31,27,0.42)] backdrop-blur-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black tracking-tight">Add a song</h2>
                <p className="text-sm text-nero-muted">Search YouTube and send the next pick into the room.</p>
              </div>
              <span className="hidden rounded-md bg-nero-surface-hover px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-nero-secondary sm:inline">
                {party.addMode === 'host' ? 'Only host can add' : 'Everyone can add'}
              </span>
            </div>
            <SongSearch />
          </div>
        </section>

        <aside className="order-3 grid min-h-0 gap-4">
          <section className="min-h-[420px] overflow-hidden rounded-xl border border-white/80 bg-white/80 shadow-[0_18px_58px_-52px_rgba(36,31,27,0.42)] backdrop-blur-2xl">
            <Queue />
          </section>
          <section className="min-h-[420px] overflow-hidden rounded-xl border border-white/80 bg-white/80 shadow-[0_18px_58px_-52px_rgba(36,31,27,0.42)] backdrop-blur-2xl">
            <ChatFeed />
          </section>
        </aside>
      </main>

      {!isHost && (
        <div className="relative mx-auto max-w-[1600px] px-4 pb-4 sm:px-6">
          <div className="rounded-xl border border-white/80 bg-white/72 px-4 py-3 text-sm font-medium text-nero-muted shadow-[0_18px_58px_-52px_rgba(36,31,27,0.42)] backdrop-blur-2xl">
            The host controls playback. {party.addMode === 'host' ? 'Only the host can add songs. You can vote, chat, and react.' : 'You can add songs, vote, chat, and react.'}
          </div>
        </div>
      )}

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
