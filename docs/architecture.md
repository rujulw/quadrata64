# Architecture

## Overview
`quadrata64` is a monorepo with a React + Vite client and a Node.js + TypeScript WebSocket server (`ws`).

Current intent:
- Real-time multiplayer chess over WebSockets.
- Server-authoritative game state to prevent desync and enforce validity.
- Deterministic move validation using `chess.js` (server as source of truth).

## Repository Structure
- `client/`: React app (Vite), board UI, WebSocket client, local input handling.
- `server/`: WebSocket server (`ws`), game session model, authoritative state + move validation.
- `docs/`: architecture and planning docs.

## Runtime Architecture
### Frontend (`client`)
Core modules (planned):
- `src/lib/ws.ts`: WebSocket client + message send/receive utilities.
- `src/state/game.ts`: client-side view state derived from server snapshots.
- `src/routes/`: lobby and game routes.
- `src/components/Board/`: board rendering + interaction.

Data flow (target):
1. Client connects to WebSocket server (`VITE_WS_URL`).
2. Client joins or creates a room.
3. Server sends an initial state snapshot.
4. Client sends move intent (from-square, to-square, optional promotion).
5. Server validates move via `chess.js`, updates authoritative state.
6. Server broadcasts updated state snapshot to all room participants.
7. Client renders board purely from the latest server snapshot.

### Backend (`server`)
Core modules (planned):
- `src/index.ts`: WebSocket server boot + connection lifecycle.
- `src/protocol/`: message types and payload schemas.
- `src/game/`: room + game session model.
- `src/game/engine.ts`: `chess.js` wrapper for validation and state transitions.

Data flow (target):
1. Client `join_room` message arrives.
2. Server associates socket with a room and initializes/loads a session.
3. Client `move` message arrives (intent only).
4. Server validates and applies move.
5. Server broadcasts `state` update to room.

## Synchronization Model
- Server is authoritative for all chess state.
- Clients do not apply moves locally as truth; they render from server snapshots.
- Invalid moves are rejected server-side with an error response.

## Message Envelope (Planned)
All messages follow:
- `type`: message kind (join_room, state, move, error, etc.)
- `roomId`: room identifier
- `payload`: message-specific data

## Current Gaps / Risks
- No matchmaking layer yet (manual room creation/join only).
- No persistence (sessions reset on server restart).
- No reconnection strategy yet.
- No clock/time-control implementation.
- No automated tests yet.

## Target Architecture
### Short-term target
- Implement room model + state snapshots.
- Implement move validation and broadcast loop.
- Implement minimal lobby -> game flow.

### Near-term target
- Add reconnection handling and basic session recovery.
- Add time controls (increment/blitz).
- Add persistence (optional) for finished games / history.
- Add tests around protocol, state transitions, and move validity.

## Environment Variables
### Server
- `PORT` (default `3000`)
- `CLIENT_URL` (default `http://localhost:5173`)

### Client
- `VITE_WS_URL` (default `ws://localhost:3000`)

## Development Commands
### Setup
- `make setup`

### Run dev
- `make dev`

### Build
- `make build`

### Typecheck
- `make typecheck`