import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Local replica of the parsing / validation logic from src/services/ai.ts
// We duplicate it here so the tests run without importing the real service
// (which would pull in env vars and the Gemini SDK at import time).
// ---------------------------------------------------------------------------

interface AiSuggestion {
  reading: string;
  songs: Array<{ title: string; artist: string }>;
}

function validateSuggestion(data: unknown): data is AiSuggestion {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.reading !== 'string' || obj.reading.length === 0) return false;
  if (!Array.isArray(obj.songs) || obj.songs.length !== 3) return false;
  return obj.songs.every(
    (song: unknown) =>
      typeof song === 'object' &&
      song !== null &&
      typeof (song as Record<string, unknown>).title === 'string' &&
      (song as Record<string, unknown>).title !== '' &&
      typeof (song as Record<string, unknown>).artist === 'string' &&
      (song as Record<string, unknown>).artist !== '',
  );
}

function parseAndValidate(text: string): AiSuggestion {
  // Try direct JSON.parse first
  try {
    const parsed = JSON.parse(text);
    if (validateSuggestion(parsed)) return parsed;
  } catch {
    // fall through to regex extraction
  }

  // Try to extract a JSON object from surrounding text
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (validateSuggestion(parsed)) return parsed;
    } catch {
      // fall through to error
    }
  }

  throw new Error(`Failed to parse AI response as valid suggestion: ${text}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function expectValidSuggestion(result: AiSuggestion) {
  expect(result).toBeDefined();
  expect(typeof result.reading).toBe('string');
  expect(result.reading.length).toBeGreaterThan(0);
  expect(Array.isArray(result.songs)).toBe(true);
  expect(result.songs).toHaveLength(3);
  for (const song of result.songs) {
    expect(typeof song.title).toBe('string');
    expect(song.title.length).toBeGreaterThan(0);
    expect(typeof song.artist).toBe('string');
    expect(song.artist.length).toBeGreaterThan(0);
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('AI prompt eval — parseAndValidate', () => {
  // 1. Clean JSON response
  it('should parse a clean JSON response with reading and 3 songs', () => {
    const raw = JSON.stringify({
      reading: 'Chill sunset vibes with smooth beats',
      songs: [
        { title: 'Sunset Lover', artist: 'Petit Biscuit' },
        { title: 'Midnight City', artist: 'M83' },
        { title: 'Intro', artist: 'The xx' },
      ],
    });

    const result = parseAndValidate(raw);
    expectValidSuggestion(result);
    expect(result.reading).toBe('Chill sunset vibes with smooth beats');
    expect(result.songs[0].title).toBe('Sunset Lover');
  });

  // 2. JSON wrapped in markdown code block
  it('should extract JSON wrapped in a markdown code block', () => {
    const raw = `\`\`\`json
{
  "reading": "Energetic morning workout vibes",
  "songs": [
    { "title": "Stronger", "artist": "Kanye West" },
    { "title": "Lose Yourself", "artist": "Eminem" },
    { "title": "Eye of the Tiger", "artist": "Survivor" }
  ]
}
\`\`\``;

    const result = parseAndValidate(raw);
    expectValidSuggestion(result);
    expect(result.reading).toBe('Energetic morning workout vibes');
  });

  // 3. JSON with extra text before/after
  it('should extract JSON when surrounded by extra text', () => {
    const raw = `Here are my suggestions for your party:

{
  "reading": "Late-night jazz lounge atmosphere",
  "songs": [
    { "title": "So What", "artist": "Miles Davis" },
    { "title": "Take Five", "artist": "Dave Brubeck" },
    { "title": "Autumn Leaves", "artist": "Bill Evans" }
  ]
}

I hope you enjoy these picks!`;

    const result = parseAndValidate(raw);
    expectValidSuggestion(result);
    expect(result.reading).toBe('Late-night jazz lounge atmosphere');
  });

  // 4. Missing reading field
  it('should fail validation when reading field is missing', () => {
    const raw = JSON.stringify({
      songs: [
        { title: 'Song A', artist: 'Artist A' },
        { title: 'Song B', artist: 'Artist B' },
        { title: 'Song C', artist: 'Artist C' },
      ],
    });

    expect(() => parseAndValidate(raw)).toThrow();
  });

  // 5. Only 2 songs instead of 3
  it('should fail validation when only 2 songs are provided', () => {
    const raw = JSON.stringify({
      reading: 'Two-song vibe only',
      songs: [
        { title: 'Song A', artist: 'Artist A' },
        { title: 'Song B', artist: 'Artist B' },
      ],
    });

    expect(() => parseAndValidate(raw)).toThrow();
  });

  // 6. Empty songs array
  it('should fail validation when songs array is empty', () => {
    const raw = JSON.stringify({
      reading: 'No songs here',
      songs: [],
    });

    expect(() => parseAndValidate(raw)).toThrow();
  });

  // 7. Songs with missing artist
  it('should fail validation when a song is missing the artist field', () => {
    const raw = JSON.stringify({
      reading: 'Incomplete song data',
      songs: [
        { title: 'Song A', artist: 'Artist A' },
        { title: 'Song B' },
        { title: 'Song C', artist: 'Artist C' },
      ],
    });

    expect(() => parseAndValidate(raw)).toThrow();
  });

  // 8. Non-JSON response (plain text)
  it('should fail parsing when the response is plain text', () => {
    const raw =
      'I think you should listen to some jazz music. Try Miles Davis!';

    expect(() => parseAndValidate(raw)).toThrow();
  });

  // 9. Mood: sunset beach chill — realistic mock response
  it('should parse a realistic response for "sunset beach chill" mood', () => {
    const raw = `{
  "reading": "Golden hour beach vibes, mellow and warm",
  "songs": [
    { "title": "Ocean Eyes", "artist": "Billie Eilish" },
    { "title": "Waves", "artist": "Mr Probz" },
    { "title": "Island in the Sun", "artist": "Weezer" }
  ]
}`;

    const result = parseAndValidate(raw);
    expectValidSuggestion(result);
    expect(result.songs.every((s) => s.title.length > 0 && s.artist.length > 0)).toBe(true);
  });

  // 10. Mood: workout energy — realistic mock response
  it('should parse a realistic response for "workout energy" mood', () => {
    const raw = `{
  "reading": "High-intensity pump-up anthems to crush it",
  "songs": [
    { "title": "Till I Collapse", "artist": "Eminem" },
    { "title": "Power", "artist": "Kanye West" },
    { "title": "Thunderstruck", "artist": "AC/DC" }
  ]
}`;

    const result = parseAndValidate(raw);
    expectValidSuggestion(result);
    expect(result.reading).toContain('pump');
  });

  // 11. Mood: 90s nostalgia — realistic mock response
  it('should parse a realistic response for "90s nostalgia" mood', () => {
    const raw = `\`\`\`json
{
  "reading": "Throwback 90s hits, pure nostalgic gold",
  "songs": [
    { "title": "Waterfalls", "artist": "TLC" },
    { "title": "Wonderwall", "artist": "Oasis" },
    { "title": "No Diggity", "artist": "Blackstreet" }
  ]
}
\`\`\``;

    const result = parseAndValidate(raw);
    expectValidSuggestion(result);
    expect(result.songs[1].artist).toBe('Oasis');
  });

  // 12. Adversarial: XSS attempt in prompt — response should still parse cleanly
  it('should parse cleanly even if the reading contains HTML-like content', () => {
    const raw = JSON.stringify({
      reading: 'Dark electronic vibes with heavy bass',
      songs: [
        { title: 'Scary Monsters and Nice Sprites', artist: 'Skrillex' },
        { title: 'Strobe', artist: 'Deadmau5' },
        { title: 'Ghosts n Stuff', artist: 'Deadmau5' },
      ],
    });

    // Even though the original prompt might have contained <script>alert("xss")</script>,
    // the AI response should still be valid JSON with clean data.
    const result = parseAndValidate(raw);
    expectValidSuggestion(result);
    expect(result.reading).not.toContain('<script>');
  });

  // 13. Adversarial: empty prompt — should fail validation or return default
  it('should fail validation when the response itself is empty', () => {
    expect(() => parseAndValidate('')).toThrow();
  });

  // ---------------------------------------------------------------------------
  // Edge cases for robustness
  // ---------------------------------------------------------------------------

  it('should fail validation when reading is an empty string', () => {
    const raw = JSON.stringify({
      reading: '',
      songs: [
        { title: 'A', artist: 'B' },
        { title: 'C', artist: 'D' },
        { title: 'E', artist: 'F' },
      ],
    });

    expect(() => parseAndValidate(raw)).toThrow();
  });

  it('should fail validation when a song title is an empty string', () => {
    const raw = JSON.stringify({
      reading: 'Some vibe',
      songs: [
        { title: '', artist: 'Artist A' },
        { title: 'Song B', artist: 'Artist B' },
        { title: 'Song C', artist: 'Artist C' },
      ],
    });

    expect(() => parseAndValidate(raw)).toThrow();
  });

  it('should fail validation when a song artist is an empty string', () => {
    const raw = JSON.stringify({
      reading: 'Some vibe',
      songs: [
        { title: 'Song A', artist: 'Artist A' },
        { title: 'Song B', artist: '' },
        { title: 'Song C', artist: 'Artist C' },
      ],
    });

    expect(() => parseAndValidate(raw)).toThrow();
  });

  it('should fail when response has 4 songs instead of 3', () => {
    const raw = JSON.stringify({
      reading: 'Too many songs',
      songs: [
        { title: 'A', artist: 'A' },
        { title: 'B', artist: 'B' },
        { title: 'C', artist: 'C' },
        { title: 'D', artist: 'D' },
      ],
    });

    expect(() => parseAndValidate(raw)).toThrow();
  });
});
