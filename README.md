# Nero Party

Nero Party is a shared listening room where friends create a party, add music videos to a live queue, vote with reactions, chat, and crown a winning song when the party ends.

## Local Setup

### Prerequisites

- Node.js 18+
- npm
- Optional but recommended: a Google Cloud API key with **YouTube Data API v3** enabled

The app boots without a YouTube key, but YouTube search will return a configuration error until `YOUTUBE_API_KEY` is set.

### Quick Start

```bash
npm install
cp .env.example .env
cp frontend/.env.example frontend/.env
npm --prefix backend run prisma:push
npm run dev
```

### API Keys

The app requires a **Google API key** with YouTube Data API v3 enabled. To get one:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a project (or select an existing one)
3. Enable the [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com)
4. Create an API key under **Credentials**
5. Paste it in `.env`:

```bash
YOUTUBE_API_KEY=your_key_here
```

The app boots without this key, but song search will not work until it's set.

When running, open:

- Frontend: `http://localhost:5173`
- Backend health check: `http://localhost:3000/health`

## Scripts

```bash
npm run dev              # run backend and frontend together
npm run dev:backend      # backend only
npm run dev:frontend     # frontend only
npm --prefix backend test
npm --prefix backend run build
npm --prefix frontend run build
node frontend/tests/e2e/room-multiuser-smoke.mjs
```

The smoke test expects the dev server to be running. It creates two rooms, connects host plus guest agents through Socket.IO, verifies “Everyone can add”, verifies “Only host can add”, and checks leaderboard voting updates.

## Product Flow

1. Create a room with host name, room capacity, songs-per-person limit, duration, and add mode.
2. Share the room code or link with friends.
3. Search YouTube and add songs to the queue.
4. Listen together with realtime playback, queue, chat, participant, and leaderboard updates.
5. Vote with quick reactions.
6. End the party and reveal the winner with final leaderboard results.

## Architecture

```text
nero-party/
├── shared/                    # Shared TypeScript contracts
├── backend/
│   ├── prisma/                # SQLite schema
│   ├── src/
│   │   ├── constants/         # Cross-module constants
│   │   ├── dto/               # Request/payload shapes
│   │   ├── exceptions/        # HTTP/socket error boundaries
│   │   ├── models/            # Prisma client and DTO mappers
│   │   ├── routing/           # REST routes
│   │   ├── services/          # YouTube, leaderboard, queue, text services
│   │   └── socket/            # Realtime routing, context, playback, state
│   └── tests/                 # App, routing, regression, and service tests
├── frontend/
│   ├── src/
│   │   ├── components/        # Player, queue, search, chat, leaderboard
│   │   ├── constants/         # UI constants
│   │   ├── lib/               # Socket and client types
│   │   ├── pages/             # Landing, join, party room, winner reveal
│   │   └── stores/            # Zustand room state
│   └── tests/                 # Screenshots and E2E smoke test
└── docs/                      # Architecture and realtime flow notes
```

## Tech Stack

- Backend: Express, Socket.IO, Prisma, SQLite
- Frontend: React, Vite, TailwindCSS, Zustand, React Router
- Music: YouTube Data API v3 for search, YouTube IFrame API for playback
- Tests: Vitest plus a Socket.IO smoke test

## Notes For Developers

- Local state is SQLite-backed; no external database is required.
- Durable room data lives in Prisma. Process-local live playback/socket state lives under `backend/src/socket`.
- Host identity is the `clientToken`/host token, stored in the browser as `nero-client-token`.
- YouTube ad/CORS noise and browser extension console messages can appear inside the embedded player; these are external to the app.
- More architecture details are in [docs/architecture.md](./docs/architecture.md) and [docs/realtime-flow.md](./docs/realtime-flow.md).

