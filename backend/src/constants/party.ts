export const AVATAR_COLORS = [
  "#7c3aed",
  "#2563eb",
  "#16a34a",
  "#ea580c",
  "#e11d48",
  "#0891b2",
  "#c026d3",
  "#65a30d",
] as const;

export const PARTY_CODE_LENGTH = 6;
export const PARTY_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const PARTY_CODE_MAX_ATTEMPTS = 10;

export const DEFAULT_MAX_SONGS_PER_PERSON = 5;
export const MIN_MAX_SONGS_PER_PERSON = 1;
export const MAX_MAX_SONGS_PER_PERSON = 20;

export const DEFAULT_MAX_USERS = 12;
export const MIN_MAX_USERS = 2;
export const MAX_MAX_USERS = 100;

export const DEFAULT_PARTY_DURATION_MINUTES = 60;
export const MIN_PARTY_DURATION_MINUTES = 5;
export const MAX_PARTY_DURATION_MINUTES = 180;
export const PARTY_TIMER_MS_PER_MINUTE = 60_000;

export const SONG_STATUS_ORDER: Record<string, number> = {
  playing: 0,
  queued: 1,
  played: 2,
};
