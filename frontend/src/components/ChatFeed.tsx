import { useState, useEffect, useRef } from 'react';
import { socket } from '../lib/socket';
import { usePartyStore } from '../stores/partyStore';

const FireIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z" />
  </svg>
);

const HeartIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
  </svg>
);

const SleepIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
  </svg>
);

const SparkleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
  </svg>
);

const QUICK_REACTIONS = [
  { key: 'fire', icon: FireIcon, label: 'Fire', reaction: 'fire' },
  { key: 'heart', icon: HeartIcon, label: 'Love', reaction: 'heart' },
  { key: 'sleep', icon: SleepIcon, label: 'Meh', reaction: 'meh' },
  { key: 'sparkle', icon: SparkleIcon, label: 'Hype', reaction: 'fire' },
] as const;

export default function ChatFeed() {
  const chatMessages = usePartyStore((s) => s.chatMessages);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    socket.emit('chat-message', { content: input.trim() });
    setInput('');
  };

  const currentSong = usePartyStore((s) => s.currentSong);

  const handleReaction = (reactionKey: string) => {
    socket.emit('reaction', { emoji: reactionKey });
    // Also register as a song reaction if a song is playing
    if (currentSong) {
      socket.emit('react-to-song', { songId: currentSong.id, reaction: reactionKey });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 p-3 min-h-0">
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center py-10">
            <svg className="w-8 h-8 text-nero-muted mb-2" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z" />
            </svg>
            <p className="text-nero-text text-sm font-medium">No messages yet</p>
            <p className="text-nero-dim text-xs mt-0.5">Say something to break the ice</p>
          </div>
        )}

        {chatMessages.map((msg) => {
          if (msg.type === 'system') {
            return (
              <div key={msg.id} className="text-center">
                <span className="text-sm text-nero-dim italic">
                  {msg.content}
                </span>
              </div>
            );
          }

          if (msg.type === 'ai-vibe-card') {
            return (
              <div
                key={msg.id}
                className="rounded-lg border-l-4 border-nero-accent p-3 bg-nero-accent/10"
              >
                <span className="text-xs font-semibold text-nero-accent block mb-1">
                  Nero AI
                </span>
                <p className="text-sm text-nero-text">{msg.content}</p>
              </div>
            );
          }

          if (msg.type === 'reaction') {
            return (
              <div key={msg.id} className="text-center">
                <span className="text-sm text-nero-muted">
                  <span className="font-medium text-nero-accent">
                    {msg.participantName}
                  </span>{' '}
                  reacted {msg.content}
                </span>
              </div>
            );
          }

          // Regular chat message
          return (
            <div key={msg.id} className="flex gap-2">
              <div className="min-w-0">
                <span className="text-sm font-semibold text-nero-accent">
                  {msg.participantName ?? 'Anonymous'}
                </span>
                <p className="text-sm text-nero-text break-words">
                  {msg.content}
                </p>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input Bar */}
      <div className="border-t border-nero-border p-3">
        {/* Quick Reactions */}
        <div className="flex gap-2 mb-2">
          {QUICK_REACTIONS.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => handleReaction(key)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-nero-surface border border-nero-border text-nero-muted hover:text-nero-accent hover:border-nero-accent hover:scale-110 transition-all active:scale-95"
              title={label}
            >
              <Icon />
            </button>
          ))}
        </div>

        {/* Text Input */}
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-nero-surface border border-nero-border rounded-lg px-3 py-2 text-sm text-nero-text placeholder-nero-dim focus:outline-none focus:border-nero-accent transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="bg-nero-accent hover:bg-nero-accent-hover disabled:opacity-50 text-nero-bg px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
