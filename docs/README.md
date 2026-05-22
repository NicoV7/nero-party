# Nero Party Documentation

Concise engineering notes for maintaining Nero Party.

## Contents

- [Architecture](./architecture.md) - system shape, data ownership, and module responsibilities.
- [Realtime Flow](./realtime-flow.md) - Socket.IO room lifecycle, events, playback, and participant state.
- [Error Handling and Testing](./error-handling-and-testing.md) - error conventions, current coverage, and testing strategy.

## Maintenance Principles

- Keep durable state in Prisma models and use in-memory maps only for live socket/session state.
- Treat `clientToken` as the reconnection and host identity key; do not rely on socket IDs beyond a single connection.
- Keep REST routes for setup and lookup flows; keep room activity in Socket.IO events.
- Validate and sanitize at backend boundaries before writing to the database or broadcasting.
- Update shared/frontend socket payload types when event contracts change.
