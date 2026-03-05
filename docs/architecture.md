# Architecture

## Overview
`quadrata64` is a monorepo with a React + Vite client and a Node.js + TypeScript websocket server (`ws`).

Current model:
- server-authoritative session state
- typed websocket protocol boundary
- waiting-room lifecycle with readiness-based activation
- per-session game registry and deterministic terminal-state broadcasts

## Repository Structure
- `client/`: React app (Vite), board UI, websocket client integration.
- `server/`: websocket server, protocol validation, room/session lifecycle.
- `server/src/ws/`: websocket router + payload/envelope validators.
- `docs/`: design decisions, roadmap, architecture, and bug history.

## Runtime Architecture
### Frontend (`client`)
Target responsibilities:
- open websocket connection
- send intent messages (`join_room`, `leave_room`, `ready`, `move`)
- render from server snapshots (`room_state`, `init_game`, future game-state updates)
- maintain CSS-first Tailwind v4 visual system (`src/styles/index.css`)
- enforce brand visual direction: AMOLED shell + purple/white chessboard palette
- apply motion + accessibility defaults (reduced-motion safe transitions)

### Backend (`server`)
Current responsibilities:
- bootstrap server process in `src/index.ts`
- parse envelope + payload boundaries in `src/ws/validators.ts`
- route websocket message handlers in `src/ws/router.ts`
- maintain in-memory room lifecycle via `src/session/RoomManager.ts`
- enforce session preconditions with typed error responses
- maintain active game registry via `src/game/GameManager.ts`
- apply authoritative chess moves via `src/game/GameEngine.ts`

Game-core responsibilities:
- own typed game domain contracts in `src/game/types.ts`
- own typed protocol payload contracts in `src/protocol/types.ts`
- provide deterministic move application and terminal-result detection

## Session Lifecycle (Implemented)
1. `join_room`:
- creates room if missing
- assigns player slot (`white`/`black`) or spectator policy outcome
- binds socket membership to `(roomId, peerId)`
- broadcasts `room_state`

2. `leave_room`:
- validates socket ownership
- removes participant and seat/spectator mapping
- auto-closes room when empty
- broadcasts updated `room_state` or closed-room state

3. `ready`:
- validates socket ownership
- updates participant readiness
- transitions room `waiting -> active` when both seated players are ready
- broadcasts `room_state`
- emits `init_game` snapshot on activation edge

4. `move`:
- validates socket ownership and payload boundary
- rejects if room is not active
- applies move through game engine for active rooms
- broadcasts `move_applied` with authoritative snapshot
- emits `game_over` with structured result on terminal state
- rejects subsequent moves for finished games

## Synchronization Model
- Server is source of truth for room/session state.
- Clients never infer authoritative room state from local actions.
- Invalid actions receive structured `error` messages with typed error codes.

## Legacy Decomposition
Old prototype classes were split to match current boundaries:
- Old `Game.ts` responsibilities now live in `GameEngine` (chess state, move validity, terminal results).
- Old `GameManager.ts` matchmaking/pending-user flow is replaced by `RoomManager` readiness lifecycle.
- Websocket transport concerns are isolated in `ws/router.ts` and `ws/validators.ts`.

## Message Envelope
All messages use:
- `type`: message kind
- `roomId`: session identifier
- `payload`: message-specific body

Current server-handled inbound types:
- `join_room`
- `leave_room`
- `ready`
- `move`

Current outbound types:
- `room_state`
- `init_game`
- `move_applied`
- `game_over`
- `error`

## Known Gaps
- No persistence across server restarts.
- No reconnect/session recovery path.
- No automated tests yet.
- Frontend still lacks feature modules (`pages`, `features`, `components/ui`) beyond style scaffold.

## Environment Variables
### Server
- `PORT` (default `3000`)

### Client
- `VITE_WS_URL` (default `ws://localhost:3000`)

## Development Commands
- `make setup`
- `make dev`
- `make build`
- `make typecheck`
