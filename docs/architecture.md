# Architecture

## Overview
`quadrata64` is a monorepo with a React + Vite client and a Node.js + TypeScript websocket server (`ws`).

Current model:
- server-authoritative session state
- typed websocket protocol boundary
- waiting-room lifecycle with readiness-based activation

## Repository Structure
- `client/`: React app (Vite), board UI, websocket client integration.
- `server/`: websocket server, protocol validation, room/session lifecycle.
- `docs/`: design decisions, roadmap, architecture, and bug history.

## Runtime Architecture
### Frontend (`client`)
Target responsibilities:
- open websocket connection
- send intent messages (`join_room`, `leave_room`, `ready`, `move`)
- render from server snapshots (`room_state`, `init_game`, future game-state updates)

### Backend (`server`)
Current responsibilities:
- parse and validate websocket message envelopes
- validate payload boundaries per message type
- route by message type in `src/index.ts`
- maintain in-memory room lifecycle via `src/session/RoomManager.ts`
- enforce session preconditions with typed error responses

In-progress game-core responsibilities:
- define game domain contracts in `src/game/types.ts`
- define protocol contracts for game lifecycle payloads in `src/protocol/types.ts`

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
- move application path intentionally deferred to next milestone

## Synchronization Model
- Server is source of truth for room/session state.
- Clients never infer authoritative room state from local actions.
- Invalid actions receive structured `error` messages with typed error codes.

## Message Envelope
All messages use:
- `type`: message kind
- `roomId`: session identifier
- `payload`: message-specific body

Current server-handled inbound types:
- `join_room`
- `leave_room`
- `ready`
- `move` (gated, application deferred)

Current outbound types:
- `room_state`
- `init_game`
- `error`
- contract-ready (next behavior commit): `move_applied`, structured `game_over`

## Known Gaps
- No chess move execution yet (`move` is only precondition-gated).
- No persistence across server restarts.
- No reconnect/session recovery path.
- No automated tests yet.

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
