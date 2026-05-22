import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePartyStore } from "../stores/partyStore";
import { API_URL } from "../constants/api";

interface PartyInfo {
  name: string;
  hostName: string;
  status: string;
  participantCount: number;
  maxUsers: number;
}

export default function JoinParty() {
  const { code } = useParams<{ code: string }>();
  const normalizedCode = code?.toUpperCase();
  const navigate = useNavigate();
  const clientToken = usePartyStore((s) => s.clientToken);
  const setParticipantId = usePartyStore((s) => s.setParticipantId);

  const [partyInfo, setPartyInfo] = useState<PartyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!normalizedCode) return;

    const fetchParty = async () => {
      try {
        const res = await fetch(`${API_URL}/api/parties/${normalizedCode}`);

        if (res.status === 404) {
          setError("Party not found. Check the code and try again.");
          return;
        }

        if (!res.ok) {
          setError("Something went wrong. Please try again.");
          return;
        }

        const data: PartyInfo = await res.json();

        if (data.status === "ended") {
          setError("This party has already ended.");
          return;
        }

        setPartyInfo(data);
      } catch {
        setError("Could not connect to the server.");
      } finally {
        setLoading(false);
      }
    };

    fetchParty();
  }, [normalizedCode]);

  const handleJoin = async () => {
    if (!normalizedCode) {
      setError("Party code is missing.");
      return;
    }

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    setJoining(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_URL}/api/parties/${normalizedCode}/join`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            clientToken,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to join the party.");
        return;
      }

      const { participantId } = await res.json();
      setParticipantId(participantId);
      navigate(`/party/${normalizedCode}`);
    } catch {
      setError("Could not connect to the server.");
    } finally {
      setJoining(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-nero-bg flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-10 h-10 border-4 border-nero-border border-t-nero-accent rounded-full animate-spin mb-4" />
          <p className="text-nero-muted text-lg">Finding the party...</p>
        </div>
      </div>
    );
  }

  // Error state (no party info loaded)
  if (error && !partyInfo) {
    return (
      <div className="min-h-screen bg-nero-bg flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-nero-surface border border-nero-border rounded-xl p-8 text-center">
          <div className="text-5xl mb-4">
            {error.includes("ended") ? "\u23F9" : "\u26A0\uFE0F"}
          </div>
          <h2 className="text-xl font-bold text-nero-text mb-2">
            {error.includes("ended") ? "Party Ended" : "Oops"}
          </h2>
          <p className="text-nero-muted mb-6">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-2.5 rounded-xl bg-nero-accent hover:bg-nero-accent-hover text-nero-bg font-semibold transition-colors cursor-pointer"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Join form
  return (
    <div className="min-h-screen bg-nero-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-nero-surface border border-nero-border rounded-xl p-8">
        {/* Party info */}
        <div className="text-center mb-8">
          <p className="text-sm font-medium text-nero-accent uppercase tracking-wider mb-1">
            Joining Party
          </p>
          <h1 className="text-3xl font-bold text-nero-text mb-2">
            {partyInfo?.name}
          </h1>
          <div className="flex items-center justify-center gap-4 text-sm text-nero-muted">
            <span>
              Hosted by{" "}
              <span className="text-nero-text font-medium">
                {partyInfo?.hostName}
              </span>
            </span>
            <span className="text-nero-border">|</span>
            <span>
              {partyInfo?.participantCount}/{partyInfo?.maxUsers} people here
            </span>
          </div>
        </div>

        {/* Name input */}
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-nero-muted mb-1">
              Your Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={50}
              className="w-full px-4 py-2.5 rounded-lg bg-nero-surface border border-nero-border text-nero-text placeholder-nero-dim focus:outline-none focus:border-nero-accent transition-colors"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleJoin();
              }}
              autoFocus
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full py-3 rounded-xl bg-nero-accent hover:bg-nero-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-nero-bg font-semibold text-lg transition-colors cursor-pointer"
          >
            {joining ? "Joining..." : "Join & Listen"}
          </button>
        </div>

        {/* Back link */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate("/")}
            className="text-nero-dim hover:text-nero-text text-sm transition-colors cursor-pointer"
          >
            &larr; Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
