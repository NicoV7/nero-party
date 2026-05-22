# Nero Party

A shared listening party app where friends join, queue songs, listen together in real-time, vote, and crown a winning song.

## Quick Start

### Prerequisites

- Node.js 18+
- A [Google Cloud API key](https://console.cloud.google.com/apis/credentials) with **YouTube Data API v3** enabled

### Installation

```bash
# Install all dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your API keys (see below)

# Also set up the frontend env
cp frontend/.env.example frontend/.env
# Add the same YouTube API key to frontend/.env

# Set up the database
cd backend && npx prisma db push && cd ..

# Start the development servers
npm run dev
```

### Environment Variables

**`.env`** (backend):
```
PORT=3000
YOUTUBE_API_KEY=your_google_api_key_here
```

**`frontend/.env`** (frontend):
```
VITE_YOUTUBE_API_KEY=your_google_api_key_here
```

This will start:
- Backend on `http://localhost:3000`
- Frontend on `http://localhost:5173`

### Running Tests

```bash
cd backend && npm test
```

## How It Works

1. **Create a Party** — Set a name, configure max songs per person and party duration
2. **Share the Link** — Copy the join link and send it to friends
3. **Add Songs** — Search YouTube and add tracks to the shared queue
4. **Listen Together** — Songs play via YouTube for all participants in real-time
5. **Vote** — Upvote/downvote songs to influence the queue order
6. **Crown the Winner** — When the party ends, the highest-voted song wins!

## Architecture

```
nero-party/
├── shared/              # Shared TypeScript types
│   └── types.ts         # Socket.IO event contracts
├── backend/             # Express + Socket.IO server
│   ├── prisma/          # Database schema (SQLite)
│   ├── src/
│   │   ├── dto/         # Transport payload shapes
│   │   ├── models/      # Prisma client, domain constants, and mappers
│   │   ├── routing/     # REST API endpoints
│   │   ├── services/    # Domain services and YouTube integration
│   │   └── socket/      # Real-time event handlers
│   └── tests/           # Tests organized by app component
└── frontend/            # React + Vite client
    └── src/
        ├── pages/       # Landing, JoinParty, PartyRoom, WinnerReveal
        ├── components/  # Player, Queue, SongSearch, ChatFeed, etc.
        ├── stores/      # Zustand state management
        └── lib/         # Socket.IO client, types
```

## Tech Stack

- **Backend:** Express.js, Prisma, Socket.IO
- **Frontend:** React, Vite, TailwindCSS, Zustand, React Router
- **Database:** SQLite (local, zero setup)
- **Music:** YouTube IFrame API (playback) + YouTube Data API v3 (search)
- **Tests:** Vitest

## Design Decisions

- **YouTube over Spotify/Deezer** — Full song playback for free, massive catalog, no user auth required
- **Split-panel layout** — Player + queue on the left, social feed on the right. Familiar Discord-meets-Spotify pattern
- **In-memory playback sync** — Server tracks current song + timestamp, clients seek on join. "Close enough" sync (within ~2 seconds) matches what Spotify Jam does
