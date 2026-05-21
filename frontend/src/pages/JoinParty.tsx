import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePartyStore } from "../stores/partyStore";
import { API_URL } from "../lib/api";

interface PartyInfo {
  name: string;
  hostName: string;
  status: string;
  participantCount: number;
}

export default function JoinParty() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const clientToken = usePartyStore((s) => s.clientToken);
  const setParticipantId = usePartyStore((s) => s.setParticipantId);

  const [partyInfo, setPartyInfo] = useState<PartyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!code) return;

    const fetchParty = async () => {
      try {
        const res = await fetch(`${API_URL}/api/parties/${code}`);

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
  }, [code]);

  const handleJoin = async () => {
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    setJoining(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_URL}/api/parties/${code}/join`,
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
      navigate(`/party/${code}`);
    } catch {
      setError("Could not connect to the server.");
    } finally {
      setJoining(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-10 h-10 border-4 border-[#333] border-t-[#7c3aed] rounded-full animate-spin mb-4" />
          <p className="text-gray-400 text-lg">Finding the party...</p>
        </div>
      </div>
    );
  }

  // Error state (no party info loaded)
  if (error && !partyInfo) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-[#1a1a1a] border border-[#333] rounded-xl p-8 text-center">
          <div className="text-5xl mb-4">
            {error.includes("ended") ? "\u23F9" : "\u26A0\uFE0F"}
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            {error.includes("ended") ? "Party Ended" : "Oops"}
          </h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-2.5 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold transition-colors cursor-pointer"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Join form
  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#1a1a1a] border border-[#333] rounded-xl p-8">
        {/* Party info */}
        <div className="text-center mb-8">
          <p className="text-sm font-medium text-[#7c3aed] uppercase tracking-wider mb-1">
            Joining Party
          </p>
          <h1 className="text-3xl font-bold text-white mb-2">
            {partyInfo?.name}
          </h1>
          <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
            <span>
              Hosted by{" "}
              <span className="text-gray-200 font-medium">
                {partyInfo?.hostName}
              </span>
            </span>
            <span className="text-[#333]">|</span>
            <span>
              {partyInfo?.participantCount}{" "}
              {partyInfo?.participantCount === 1 ? "person" : "people"} here
            </span>
          </div>
        </div>

        {/* Name input */}
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Your Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={50}
              className="w-full px-4 py-2.5 rounded-lg bg-[#111] border border-[#333] text-white placeholder-gray-600 focus:outline-none focus:border-[#7c3aed] transition-colors"
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
            className="w-full py-3 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-lg transition-colors cursor-pointer"
          >
            {joining ? "Joining..." : "Join & Listen"}
          </button>
        </div>

        {/* Back link */}
        <div className="text-center mt-6">
          <button
            onClick={() => navigate("/")}
            className="text-gray-500 hover:text-gray-300 text-sm transition-colors cursor-pointer"
          >
            &larr; Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
