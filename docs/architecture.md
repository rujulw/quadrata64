# Architecture

## Overview
`quadrata64` is a monorepo with a React + Vite client and a Node.js + TypeScript websocket server (`ws`).

Current model:
- server-authoritative session state
- typed websocket protocol boundary
- waiting-room lifecycle with readiness-based activation
- per-session game registry and deterministic terminal-state broadcasts
- authoritative time-control presets and per-side timer state
- full-bleed landing UI with motion, spotlight lighting, and dotted-map atmosphere
- live client waiting-room sync on `/play` (join + room-state hydration + ready toggle dispatch)
- interactive board move intent flow with legal-target guidance
- pointer-driven drag-and-drop piece interaction with thresholded lift and captured drag preview
- client-side timeout lockout and synchronized board/side-panel clock display
- gameplay side panel with move feed, turn indicator, and terminal result surfacing

## Repository Structure
- `client/`: React app (Vite), board UI, websocket client integration.
- `server/`: websocket server, protocol validation, room/session lifecycle.
- `docker/`: container build definitions for client and server images.
- `server/src/ws/`: websocket router + payload/envelope validators.
- `docs/`: design decisions, roadmap, architecture, and bug history.

## Runtime Architecture
### Frontend (`client`)
Target responsibilities:
- open websocket connection
- send intent messages (`join_room`, `leave_room`, `ready`, `move`)
- render from server snapshots (`room_state`, `init_game`, future game-state updates)
- maintain CSS-first Tailwind v4 visual system (`src/styles/index.css`)
- enforce brand visual direction: dark minimal shell with lavender accents and restrained motion
- apply motion + accessibility defaults (reduced-motion safe transitions)
- provide reusable UI primitives in `src/components/ui/*` (button, highlight, spotlight, map effects)
- keep landing composition in `src/pages/LandingPage.tsx` with hero messaging and board-first framing
- enforce feature boundaries under `src/features/*`:
- `src/features/ws/*` owns websocket sync contracts, state adapter, and transport-facing intent API
- `src/features/room/*` owns waiting-room state contracts and seat/readiness presentation
- `src/features/board/*` owns board/game snapshot contracts and board surface rendering
- compose feature modules in route pages (`src/pages/PlayPage.tsx`) without cross-feature coupling
- persist tab-scoped transport identity (`sessionStorage`) for multi-tab room testing
- maintain move feed state from authoritative move events with SAN notation fallback
- project timer continuity across partial snapshots and reconnect-style `init_game` hydration
- keep `/play` presentation lighter than landing page so active gameplay avoids unnecessary atmosphere effects
- support root-level containerized startup via compose and `VITE_WS_URL` environment injection
- run client coverage via Vitest + Testing Library:
- `src/features/room/WaitingRoomPanel.test.tsx`
- `src/features/board/BoardSurface.test.tsx`
- `src/features/ws/useWsSync.test.tsx`

### Backend (`server`)
Current responsibilities:
- bootstrap server process in `src/index.ts`
- parse envelope + payload boundaries in `src/ws/validators.ts`
- route websocket message handlers in `src/ws/router.ts`
- maintain in-memory room lifecycle via `src/session/RoomManager.ts`
- enforce session preconditions with typed error responses
- maintain active game registry via `src/game/GameManager.ts`
- apply authoritative chess moves via `src/game/GameEngine.ts`
- own authoritative time-control config and timer consumption/increment behavior in game-core
- expose websocket service cleanly to local container orchestration through environment-based port binding

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
- consumes active-side clock before move application and resolves timeout as a terminal result
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
- `draw_offered`
- `draw_declined`
- `error`

## Known Gaps
- No persistence across server restarts.
- No reconnect/session recovery path.
- No end-to-end multiplayer integration test suite.
- No persistence for completed game history/move archives.
- No profiler-guided production performance pass on `/play`.

## Environment Variables
### Root / Compose
- `SERVER_PORT` (default `3000`)
- `CLIENT_PORT` (default `5173`)
- `VITE_WS_URL` (default `ws://localhost:3000`)

### Server
- `PORT` (default `3000`)

### Client
- `VITE_WS_URL` (default `ws://localhost:3000`)

## Development Commands
- `make setup`
- `make dev`
- `make build`
- `make typecheck`
- `make docker-build`
- `make docker-up`
- `make docker-down`
- `make docker-logs`
- `cd client && npm run test`
- `cd client && npm run test:run`
- `cd server && npm run test`
