import { useState, useEffect, useRef } from 'react';
import { socket } from '../lib/socket';
import { usePartyStore } from '../stores/partyStore';
import { QUICK_REACTIONS, getQuickReaction, type QuickReaction } from '../constants/reactions';

export default function ChatFeed() {
  const chatMessages = usePartyStore((s) => s.chatMessages);
  const participants = usePartyStore((s) => s.participants);
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

  const handleReaction = (reaction: QuickReaction) => {
    socket.emit('reaction', { emoji: reaction.key });
    // Also register as a song reaction if a song is playing
    if (currentSong) {
      socket.emit('react-to-song', { songId: currentSong.id, reaction: reaction.reaction });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-nero-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-nero-text">
              Chat
            </h2>
            <p className="mt-1 text-xs text-nero-muted">
              {participants.length} {participants.length === 1 ? 'person' : 'people'} in the room
            </p>
          </div>
          <span className="rounded-full bg-nero-surface-hover px-3 py-1 text-xs font-bold text-nero-muted">
            Live
          </span>
        </div>
      </div>

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

          if (msg.type === 'reaction') {
            const reaction = getQuickReaction(msg.content);
            const Icon = reaction?.icon;

            return (
              <div key={msg.id} className="text-center">
                <span className="inline-flex items-center gap-1.5 text-sm text-nero-muted">
                  <span className="font-medium text-nero-accent">
                    {msg.participantName}
                  </span>{' '}
                  reacted
                  {Icon ? (
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-nero-border bg-nero-surface text-nero-accent">
                      <Icon />
                    </span>
                  ) : (
                    <span>{msg.content}</span>
                  )}
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
          {QUICK_REACTIONS.map((reaction) => {
            const Icon = reaction.icon;

            return (
            <button
              key={reaction.key}
              onClick={() => handleReaction(reaction)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-nero-border bg-nero-surface text-nero-muted transition-[border-color,color,background-color,transform] duration-150 ease-[var(--ease-ui)] hover:border-nero-accent hover:text-nero-accent active:scale-[0.97]"
              title={reaction.label}
            >
              <Icon />
            </button>
            );
          })}
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
