import { usePartyStore } from '../stores/partyStore';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';

export default function ShareLink() {
  const party = usePartyStore((s) => s.party);
  const { copied, copy } = useCopyToClipboard();

  if (!party) return null;

  const link = `${window.location.origin}/join/${party.code}`;

  const handleCopy = () => copy(link);

  return (
    <div className="flex items-center gap-2 bg-nero-surface rounded-lg p-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-nero-dim mb-1">Share this link to invite friends</p>
        <p className="text-sm text-nero-text truncate font-mono">{link}</p>
      </div>
      <button
        onClick={handleCopy}
        className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-[background-color,color] ${
          copied
            ? 'bg-green-600 text-nero-text'
            : 'bg-nero-accent hover:bg-nero-accent-hover text-nero-bg'
        }`}
      >
        {copied ? 'Copied!' : 'Copy Link'}
      </button>
    </div>
  );
}
