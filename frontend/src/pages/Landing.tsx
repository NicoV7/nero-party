import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { usePartyStore } from "../stores/partyStore";
import { API_URL } from "../constants/api";

type CreateForm = {
  partyName: string;
  hostName: string;
  maxSongsPerPerson: number | "";
  maxUsers: number | "";
  maxDurationMinutes: number;
};

type ActivePanel = "create" | "join";

const heroSlides = [
  {
    src: "/images/nero-party-lively-hero.png",
    alt: "Friends choosing songs together in a bright living room",
    label: "Living room vote",
  },
  {
    src: "/images/nero-section-queue-ref.png",
    alt: "A colorful party queue interface on a shared screen",
    label: "Shared queue",
  },
  {
    src: "/images/nero-section-winner-ref.png",
    alt: "Friends celebrating the winning song at the end of a party",
    label: "Final winner",
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const reset = usePartyStore((s) => s.reset);
  const setClientToken = usePartyStore((s) => s.setClientToken);

  useEffect(() => {
    reset();
  }, [reset]);

  const [activePanel, setActivePanel] = useState<ActivePanel>("create");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateForm>({
    partyName: "",
    hostName: "",
    maxSongsPerPerson: 5,
    maxUsers: 12,
    maxDurationMinutes: 60,
  });

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentSlide((slide) => (slide + 1) % heroSlides.length);
    }, 6200);

    return () => window.clearInterval(interval);
  }, []);

  const switchPanel = (panel: ActivePanel) => {
    setActivePanel(panel);
    setError(null);
  };

  const handleCreate = async () => {
    if (!form.partyName.trim() || !form.hostName.trim()) {
      setError("Party name and your name are required.");
      return;
    }

    const maxSongsPerPerson = Number(form.maxSongsPerPerson);
    if (!Number.isInteger(maxSongsPerPerson) || maxSongsPerPerson < 1 || maxSongsPerPerson > 20) {
      setError("Songs each must be a whole number from 1 to 20.");
      return;
    }

    const maxUsers = Number(form.maxUsers);
    if (!Number.isInteger(maxUsers) || maxUsers < 2 || maxUsers > 100) {
      setError("Max users must be a whole number from 2 to 100.");
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
          maxSongsPerPerson,
          maxUsers,
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
    <main className="min-h-[100dvh] overflow-x-hidden bg-nero-bg text-nero-text">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(217,85,56,0.12),transparent_34%),radial-gradient(circle_at_84%_12%,rgba(15,118,110,0.16),transparent_32%),linear-gradient(180deg,#fff9f2_0%,#fffdf8_50%,#f5eadb_100%)]" />

      <section className="relative mx-auto flex min-h-[100dvh] max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <nav className="flex items-center justify-between rounded-full border border-white/75 bg-white/70 px-3 py-3 shadow-[0_20px_70px_-58px_rgba(41,35,30,0.45)] backdrop-blur-2xl sm:px-4">
          <button
            type="button"
            className="rounded-full px-3 py-2 text-left text-sm font-black uppercase tracking-[0.2em] transition-[background-color,transform] duration-150 ease-[var(--ease-ui)] hover:bg-white/85 active:scale-[0.97]"
            onClick={() => switchPanel("create")}
          >
            <span className="text-nero-accent">nero</span> party
          </button>
          <button
            type="button"
            onClick={() => switchPanel("join")}
            className="rounded-full bg-[#29231e] px-5 py-2.5 text-sm font-bold text-white shadow-[0_14px_34px_-26px_rgba(41,35,30,0.7)] transition-[background-color,box-shadow,transform] duration-150 ease-[var(--ease-ui)] hover:bg-[#3b332c] active:scale-[0.97]"
          >
            Join room
          </button>
        </nav>

        <div className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:py-12">
          <div className="min-w-0">
            <div className="relative overflow-hidden rounded-[1.4rem] border border-white/80 bg-nero-surface shadow-[0_34px_110px_-76px_rgba(36,31,27,0.54)]">
              <div className="relative aspect-[1.08/1] min-h-[500px] overflow-hidden bg-[#efe2d1] sm:aspect-[16/10] sm:min-h-[520px] lg:aspect-[1.18/1]">
                {heroSlides.map((slide, index) => (
                  <div
                    key={slide.src}
                    className={`hero-slide absolute inset-0 transition-opacity duration-[1600ms] ease-[var(--ease-ui)] ${
                      index === currentSlide ? "opacity-100" : "opacity-0"
                    }`}
                    aria-hidden={index !== currentSlide}
                  >
                    <img
                      src={slide.src}
                      alt={slide.alt}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(36,31,27,0.16)_0%,rgba(36,31,27,0.36)_42%,rgba(36,31,27,0.78)_100%)] sm:bg-[linear-gradient(90deg,rgba(36,31,27,0.76)_0%,rgba(36,31,27,0.25)_45%,rgba(36,31,27,0.04)_100%)]" />
                <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-nero-bg to-transparent" />

                <div className="absolute left-5 top-5 rounded-md border border-white/20 bg-white/18 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-xl sm:left-7 sm:top-7">
                  Live listening room
                </div>

                <div className="absolute inset-x-5 bottom-6 max-w-[calc(100%-2.5rem)] text-white sm:bottom-9 sm:left-8 sm:right-auto sm:max-w-2xl">
                  <h1 className="max-w-[9ch] text-[clamp(2.35rem,13vw,4.2rem)] font-black leading-[0.92] tracking-tight sm:max-w-3xl sm:text-[clamp(3rem,8vw,6.6rem)] sm:leading-[0.9]">
                    Make song picking feel like the party.
                  </h1>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/80 bg-white/82 p-5 shadow-[0_28px_90px_-64px_rgba(41,35,30,0.56)] shadow-nero-accent/5 backdrop-blur-2xl sm:p-6">
            <div className="mb-6 grid grid-cols-2 rounded-[1.25rem] bg-[#f3eadf] p-1">
              <button
                type="button"
                onClick={() => switchPanel("create")}
                className={`rounded-[1rem] px-4 py-2.5 text-sm font-bold transition-[background-color,color,box-shadow,transform] duration-150 ease-[var(--ease-ui)] ${
                  activePanel === "create"
                    ? "bg-white text-nero-text shadow-[0_12px_32px_-22px_rgba(41,35,30,0.45)]"
                    : "text-nero-muted hover:text-nero-text"
                }`}
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => switchPanel("join")}
                className={`rounded-[1rem] px-4 py-2.5 text-sm font-bold transition-[background-color,color,box-shadow,transform] duration-150 ease-[var(--ease-ui)] ${
                  activePanel === "join"
                    ? "bg-white text-nero-text shadow-[0_12px_32px_-22px_rgba(41,35,30,0.45)]"
                    : "text-nero-muted hover:text-nero-text"
                }`}
              >
                Join
              </button>
            </div>

            {activePanel === "create" ? (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Start a party</h2>
                  <p className="mt-1 text-sm text-nero-muted">Set the room rules and invite friends.</p>
                </div>

                <Field label="Party name" helper="Shown on the room screen.">
                  <input
                    type="text"
                    value={form.partyName}
                    onChange={(e) => setForm((f) => ({ ...f, partyName: e.target.value }))}
                    placeholder="Kitchen table session"
                    maxLength={100}
                    className="field-input"
                  />
                </Field>

                <Field label="Your name" helper="You will be the host.">
                  <input
                    type="text"
                    value={form.hostName}
                    onChange={(e) => setForm((f) => ({ ...f, hostName: e.target.value }))}
                    placeholder="Nico"
                    maxLength={50}
                    className="field-input"
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Songs each" helper="Keep it moving.">
                    <input
                      type="number"
                      value={form.maxSongsPerPerson}
                      min={1}
                      max={20}
                      step={1}
                      inputMode="numeric"
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm((f) => ({
                          ...f,
                          maxSongsPerPerson: value === "" ? "" : Number(value),
                        }));
                      }}
                      onBlur={() => {
                        setForm((f) => {
                          const value = Number(f.maxSongsPerPerson);
                          if (!Number.isFinite(value)) return { ...f, maxSongsPerPerson: 5 };
                          return {
                            ...f,
                            maxSongsPerPerson: Math.min(20, Math.max(1, Math.round(value))),
                          };
                        });
                      }}
                      className="field-input"
                    />
                  </Field>
                  <Field label="Max users" helper="Room capacity.">
                    <input
                      type="number"
                      value={form.maxUsers}
                      min={2}
                      max={100}
                      step={1}
                      inputMode="numeric"
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm((f) => ({
                          ...f,
                          maxUsers: value === "" ? "" : Number(value),
                        }));
                      }}
                      onBlur={() => {
                        setForm((f) => {
                          const value = Number(f.maxUsers);
                          if (!Number.isFinite(value)) return { ...f, maxUsers: 12 };
                          return {
                            ...f,
                            maxUsers: Math.min(100, Math.max(2, Math.round(value))),
                          };
                        });
                      }}
                      className="field-input"
                    />
                  </Field>
                  <Field label="Duration" helper="Then reveal the winner.">
                    <select
                      value={form.maxDurationMinutes}
                      onChange={(e) => setForm((f) => ({ ...f, maxDurationMinutes: Number(e.target.value) }))}
                      className="field-input cursor-pointer"
                    >
                      {[15, 30, 45, 60, 90, 120].map((n) => (
                        <option key={n} value={n}>{n} min</option>
                      ))}
                    </select>
                  </Field>
                </div>

                {error && <p className="rounded-2xl border border-nero-accent/25 bg-nero-accent/8 px-4 py-3 text-sm font-medium text-[#a83a25]">{error}</p>}

                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating}
                  className="w-full rounded-full bg-nero-accent px-6 py-4 text-base font-bold text-white transition-[background-color,opacity,transform] duration-150 ease-[var(--ease-ui)] hover:bg-nero-accent-hover disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.97]"
                >
                  {creating ? "Creating room..." : "Create room"}
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Join a room</h2>
                  <p className="mt-1 text-sm text-nero-muted">Enter the code from a host.</p>
                </div>

                <Field label="Party code" helper="Six characters, letters or numbers.">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="ABC123"
                    maxLength={6}
                    className="field-input text-center font-mono text-xl uppercase tracking-[0.35em]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleJoin();
                    }}
                  />
                </Field>

                {error && <p className="rounded-2xl border border-nero-accent/25 bg-nero-accent/8 px-4 py-3 text-sm font-medium text-[#a83a25]">{error}</p>}

                <button
                  type="button"
                  onClick={handleJoin}
                  className="w-full rounded-full bg-nero-accent px-6 py-4 text-base font-bold text-white transition-[background-color,transform] duration-150 ease-[var(--ease-ui)] hover:bg-nero-accent-hover active:scale-[0.97]"
                >
                  Join room
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3 border-t border-nero-border/70 py-6 text-sm text-nero-muted sm:grid-cols-3">
          <p><span className="font-bold text-nero-text">1.</span> Create a room and share the code.</p>
          <p><span className="font-bold text-nero-text">2.</span> Everyone adds songs to the queue.</p>
          <p><span className="font-bold text-nero-text">3.</span> Vote, listen together, crown a winner.</p>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="block text-sm font-bold text-nero-text">{label}</span>
      {children}
      <span className="block text-xs leading-5 text-nero-muted">{helper}</span>
    </label>
  );
}
