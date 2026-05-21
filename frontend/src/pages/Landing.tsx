import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePartyStore } from "../stores/partyStore";
import { API_URL } from "../lib/api";

type CreateForm = {
  partyName: string;
  hostName: string;
  maxSongsPerPerson: number;
  maxDurationMinutes: number;
};

export default function Landing() {
  const navigate = useNavigate();
  const reset = usePartyStore((s) => s.reset);
  const setClientToken = usePartyStore((s) => s.setClientToken);

  // Clear any stale party state when returning to the landing page
  useEffect(() => {
    reset();
  }, [reset]);

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<CreateForm>({
    partyName: "",
    hostName: "",
    maxSongsPerPerson: 5,
    maxDurationMinutes: 60,
  });

  const handleCreate = async () => {
    if (!form.partyName.trim() || !form.hostName.trim()) {
      setError("Party name and your name are required.");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/parties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.partyName.trim(),
          hostName: form.hostName.trim(),
          maxSongsPerPerson: form.maxSongsPerPerson,
          maxDurationMinutes: form.maxDurationMinutes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create party.");
        return;
      }

      const { code, hostToken } = await res.json();
      localStorage.setItem("hostToken", hostToken);
      setClientToken(hostToken);
      navigate(`/party/${code}`);
    } catch {
      setError("Could not connect to the server.");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setError("Please enter a party code.");
      return;
    }
    navigate(`/join/${code}`);
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center px-4">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-6xl sm:text-7xl font-extrabold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent mb-4">
          Nero Party
        </h1>
        <p className="text-lg sm:text-xl text-gray-400 max-w-md mx-auto">
          Listen together. Vibe together. Crown the winner.
        </p>
      </div>

      {/* Action Buttons */}
      {!showCreate && !showJoin && (
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => {
              setShowCreate(true);
              setShowJoin(false);
              setError(null);
            }}
            className="px-8 py-3 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold text-lg transition-colors cursor-pointer"
          >
            Create a Party
          </button>
          <button
            onClick={() => {
              setShowJoin(true);
              setShowCreate(false);
              setError(null);
            }}
            className="px-8 py-3 rounded-xl border-2 border-[#7c3aed] text-[#7c3aed] hover:bg-[#7c3aed]/10 font-semibold text-lg transition-colors cursor-pointer"
          >
            Join with Code
          </button>
        </div>
      )}

      {/* Create Party Form */}
      {showCreate && (
        <div className="w-full max-w-md bg-[#1a1a1a] border border-[#333] rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-white">Create a Party</h2>
            <button
              onClick={() => {
                setShowCreate(false);
                setError(null);
              }}
              className="text-gray-500 hover:text-gray-300 text-2xl leading-none cursor-pointer"
            >
              &times;
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Party Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.partyName}
              onChange={(e) =>
                setForm((f) => ({ ...f, partyName: e.target.value }))
              }
              placeholder="Friday Night Vibes"
              maxLength={100}
              className="w-full px-4 py-2.5 rounded-lg bg-[#111] border border-[#333] text-white placeholder-gray-600 focus:outline-none focus:border-[#7c3aed] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Your Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.hostName}
              onChange={(e) =>
                setForm((f) => ({ ...f, hostName: e.target.value }))
              }
              placeholder="DJ Shadow"
              maxLength={50}
              className="w-full px-4 py-2.5 rounded-lg bg-[#111] border border-[#333] text-white placeholder-gray-600 focus:outline-none focus:border-[#7c3aed] transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Max Songs / Person
              </label>
              <select
                value={form.maxSongsPerPerson}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    maxSongsPerPerson: Number(e.target.value),
                  }))
                }
                className="w-full px-4 py-2.5 rounded-lg bg-[#111] border border-[#333] text-white focus:outline-none focus:border-[#7c3aed] transition-colors cursor-pointer"
              >
                {[3, 5, 10, 15, 20].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Party Duration
              </label>
              <select
                value={form.maxDurationMinutes}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    maxDurationMinutes: Number(e.target.value),
                  }))
                }
                className="w-full px-4 py-2.5 rounded-lg bg-[#111] border border-[#333] text-white focus:outline-none focus:border-[#7c3aed] transition-colors cursor-pointer"
              >
                {[15, 30, 45, 60, 90, 120].map((n) => (
                  <option key={n} value={n}>
                    {n} min
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full py-3 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-lg transition-colors cursor-pointer"
          >
            {creating ? "Creating..." : "Start Party"}
          </button>
        </div>
      )}

      {/* Join with Code */}
      {showJoin && (
        <div className="w-full max-w-md bg-[#1a1a1a] border border-[#333] rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-white">Join with Code</h2>
            <button
              onClick={() => {
                setShowJoin(false);
                setError(null);
              }}
              className="text-gray-500 hover:text-gray-300 text-2xl leading-none cursor-pointer"
            >
              &times;
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Party Code
            </label>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              className="w-full px-4 py-2.5 rounded-lg bg-[#111] border border-[#333] text-white placeholder-gray-600 tracking-widest text-center text-xl font-mono focus:outline-none focus:border-[#7c3aed] transition-colors uppercase"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleJoin();
              }}
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            onClick={handleJoin}
            className="w-full py-3 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold text-lg transition-colors cursor-pointer"
          >
            Join
          </button>
        </div>
      )}
    </div>
  );
}
