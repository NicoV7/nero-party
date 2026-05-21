import { useState, useEffect, useRef } from 'react';
import { socket } from '../lib/socket';
import { usePartyStore } from '../stores/partyStore';

const QUICK_EMOJIS = ['\u{1F525}', '\u2764\uFE0F', '\u{1F634}', '\u{1F680}'];

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

  // Map chat emojis to song reaction emojis
  const EMOJI_TO_REACTION: Record<string, string> = {
    '\u{1F525}': '🔥',   // 🔥 → Fire
    '\u2764\uFE0F': '❤️', // ❤️ → Loved it
    '\u{1F634}': '😐',    // 😴 → Meh
    '\u{1F680}': '🔥',    // 🚀 → Fire (rocket = hype)
  };

  const handleReaction = (emoji: string) => {
    socket.emit('reaction', { emoji });
    // Also register as a song reaction if a song is playing
    if (currentSong) {
      const songReaction = EMOJI_TO_REACTION[emoji];
      if (songReaction) {
        socket.emit('react-to-song', { songId: currentSong.id, reaction: songReaction });
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 p-3 min-h-0">
        {chatMessages.length === 0 && (
          <p className="text-gray-600 text-sm text-center py-8">
            No messages yet. Say something!
          </p>
        )}

        {chatMessages.map((msg) => {
          if (msg.type === 'system') {
            return (
              <div key={msg.id} className="text-center">
                <span className="text-sm text-gray-500 italic">
                  {msg.content}
                </span>
              </div>
            );
          }

          if (msg.type === 'ai-vibe-card') {
            return (
              <div
                key={msg.id}
                className="rounded-lg border-l-4 border-[#7c3aed] p-3"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(236, 72, 153, 0.1))',
                }}
              >
                <span className="text-xs font-semibold text-[#ec4899] block mb-1">
                  Nero AI
                </span>
                <p className="text-sm text-gray-200">{msg.content}</p>
              </div>
            );
          }

          if (msg.type === 'reaction') {
            return (
              <div key={msg.id} className="text-center">
                <span className="text-sm text-gray-400">
                  <span className="font-medium text-[#7c3aed]">
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
                <span className="text-sm font-semibold text-[#7c3aed]">
                  {msg.participantName ?? 'Anonymous'}
                </span>
                <p className="text-sm text-white break-words">
                  {msg.content}
                </p>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input Bar */}
      <div className="border-t border-gray-800 p-3">
        {/* Quick Reactions */}
        <div className="flex gap-2 mb-2">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              className="text-xl hover:scale-125 transition-transform active:scale-95"
              title={`React with ${emoji}`}
            >
              {emoji}
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
            className="flex-1 bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#7c3aed] transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
