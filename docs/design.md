# Design Choices

## 1. Identity Model — peerId as Transport Primitive

Decision:
Use `peerId` as the transport-level participant identifier in websocket payloads and room membership mapping.

Why:
- Preserves separation between transport identity and user-facing profile identity.
- Keeps session routing logic deterministic and low-coupling.
- Avoids introducing auth/user dependencies in early websocket milestones.

Impact:
- Socket membership map is keyed by `(roomId, peerId)`.
- `join_room`, `leave_room`, `ready`, and `move` boundaries validate `peerId` ownership per socket.
- Future auth/username layers can be composed without rewriting room transport logic.

---

## 2. Waiting-Room Readiness Gate as Session Transition

Decision:
Rooms start in `waiting` and transition to `active` only when both seated players (`white`, `black`) are marked ready.

Why:
- Prevents race conditions where one player sends moves before both peers are prepared.
- Gives a clean state boundary for emitting a single `init_game` snapshot.
- Keeps move acceptance policy explicit (`waiting` rejects moves, `active` accepts).

Impact:
- `RoomManager.setPlayerReady` drives state transitions.
- Router broadcasts `room_state` after readiness changes.
- Router emits `init_game` exactly on `waiting -> active` transition.
- `move` requests are rejected with typed errors until room is active.

---

## 3. Game-Core Contracts Before Engine Wiring

Decision:
Define game domain types and protocol payload contracts before implementing chess engine execution.

Why:
- Prevents websocket handlers from hardcoding ad-hoc move and game-state shapes.
- Makes outbound `init_game` and `game_over` payloads explicit and versionable.
- Lets engine and router evolve independently behind a stable contract boundary.

Impact:
- Added `server/src/game/types.ts` for `GameSnapshot`, move input, status, and result contracts.
- Added protocol payload types for `init_game`, move intent, move-applied, room-state, and `game_over`.
- Next commits can focus on behavior implementation instead of reshaping message schemas.

---

## 4. Session-Scoped Game Registry Ownership

Decision:
Store active game engines in a dedicated `GameManager` keyed by `sessionId`, and only create games from active room snapshots.

Why:
- Prevents transport handlers from owning engine lifecycle directly.
- Avoids recreating old `pendingUser` coupling and race-prone matchmaking state.
- Guarantees a single authoritative game instance per active room.

Impact:
- Added `server/src/game/GameManager.ts` with typed `createGameForRoom`, `requireGame`, and `closeGame`.
- Game creation enforces room preconditions (`active` state with both seated players).
- Room-close handling can now deterministically remove game instances to prevent stale engine reuse.
