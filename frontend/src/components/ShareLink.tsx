import { useState } from 'react';
import { usePartyStore } from '../stores/partyStore';

export default function ShareLink() {
  const party = usePartyStore((s) => s.party);
  const [copied, setCopied] = useState(false);

  if (!party) return null;

  const link = `${window.location.origin}/join/${party.code}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = link;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex items-center gap-2 bg-[#1a1a1a] rounded-lg p-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 mb-1">Share this link to invite friends</p>
        <p className="text-sm text-white truncate font-mono">{link}</p>
      </div>
      <button
        onClick={handleCopy}
        className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          copied
            ? 'bg-green-600 text-white'
            : 'bg-[#7c3aed] hover:bg-[#6d28d9] text-white'
        }`}
      >
        {copied ? 'Copied!' : 'Copy Link'}
      </button>
    </div>
  );
}
