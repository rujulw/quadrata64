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
- Next implementation phases can focus on behavior rather than reshaping message schemas.

---

## 4. Session-Scoped Game Registry Ownership

Decision:
Store active game engines in a dedicated `GameManager` keyed by `sessionId`, and only create games from active room snapshots.

Why:
- Prevents transport handlers from owning engine lifecycle directly.
- Avoids recreating old `pendingUser` coupling and race-prone matchmaking state.
- Guarantees a single authoritative game instance per active room.

Impact:
- Added `server/src/game/GameManager.ts` with typed `createGameForRoom`, `requireGame`, and `closeGameForRoom`.
- Game creation enforces room preconditions (`active` state with both seated players).
- Room-close handling can now deterministically remove game instances to prevent stale engine reuse.

---

## 5. Router as Transport Adapter Over Game Contracts

Decision:
Wire websocket `ready`/`move` handlers to `GameManager` + `GameEngine` and keep router logic as protocol translation only.

Why:
- Preserves clear ownership boundaries: room lifecycle in `RoomManager`, chess behavior in game-core, transport in router.
- Replaces ad-hoc `init_game` payloads with authoritative server snapshots.
- Keeps move failure modes explicit and typed (`room_not_active`, `game_not_found`, `wrong_turn_player`, `illegal_move`).

Impact:
- On activation edge, router creates/requires game and emits per-player `init_game` with `{ gameId, youAre, snapshot }`.
- On `move`, router validates payload boundary, applies move via engine, and broadcasts `move_applied` with updated snapshot.
- Room-close paths now tear down registry game state through `GameManager.closeGameForRoom`.

---

## 6. Terminal-State Broadcast and Move Freeze

Decision:
Treat terminal game state as an explicit protocol event (`game_over`) and reject all subsequent move intents for that game.

Why:
- Gives clients a deterministic lifecycle edge instead of inferring finish from move deltas.
- Prevents post-checkmate/stalemate drift from late or duplicated move messages.
- Keeps game-core authority in one place: engine computes result, router only broadcasts it.

Impact:
- Router emits `game_over` immediately after the terminal `move_applied` snapshot.
- Router maps engine `game_not_active` to protocol error `game_already_finished` for post-terminal move attempts.
- Game registry remains session-scoped, and room-close paths continue to tear down game instances (`closeGameForRoom`).

---

## 7. Websocket Refactor: Router + Validators Split

Decision:
Move websocket handlers and validation logic out of `index.ts` into `ws/router.ts` and `ws/validators.ts`.

Why:
- Prevents entrypoint bloat as gameplay features expand.
- Keeps transport orchestration separate from validation and domain services.
- Lowers regression risk when adding new message types by localizing parsing/validation rules.

Impact:
- `index.ts` now performs only bootstrap and dependency wiring.
- `ws/router.ts` owns connection, membership maps, and message-type handlers.
- `ws/validators.ts` owns envelope parse and payload validation boundaries.

---

## 8. Legacy Port Decomposition (Old `Game`/`GameManager`)

Decision:
Port old behavior by responsibility, not by class copy, to avoid transport/state coupling.

Why:
- Old `Game.ts` mixed websocket side effects with game-state mutation.
- Old `GameManager.ts` used pending-user matchmaking state that conflicts with room lifecycle ownership.
- The new architecture needs deterministic room-activation boundaries, not opportunistic socket pairing.

Impact:
- Chess behavior is isolated in `GameEngine`.
- Session game ownership is isolated in `GameManager` keyed by `sessionId`.
- Room readiness and seat ownership remain isolated in `RoomManager`.
- Router acts as an adapter layer only and no longer carries hidden matchmaking state.

---

## 9. Frontend Landing Direction (Minimal + Atmospheric)

Decision:
Use a full-bleed landing layout with a left-aligned hero message and a right-side board preview, backed by subtle spotlight and dotted-map effects.

Why:
- Keeps first impression focused on product identity without heavy UI chrome.
- Supports a premium look while preserving fast readability and low visual noise.
- Creates a clear narrative: live chess now, analyzer depth next, quantum mode as an experimental lane.

Impact:
- Reusable UI primitives live in `client/src/components/ui/*` (`button`, `hero-highlight`, `card-spotlight`, `dotted-map`).
- Landing page composes those primitives in `client/src/pages/LandingPage.tsx`.
- Visual tokens in `client/src/styles/index.css` drive lavender accenting and consistent contrast.

---

## 10. Client Feature Boundary Split (Room / Board / WS)

Decision:
Split client gameplay concerns into explicit feature modules for waiting-room state, board state, and websocket sync.

Why:
- Prevents route/page files from coupling transport details directly to board rendering.
- Creates clear ownership boundaries before implementing room sync and board interaction behavior.
- Enables commit-by-commit implementation without repeated folder churn.

Impact:
- Added `client/src/features/ws/*` for sync contracts and intent-dispatch adapter hooks.
- Added `client/src/features/room/*` for room snapshot contracts and waiting-room UI surface.
- Added `client/src/features/board/*` for game snapshot contracts and board surface component.
- Added `client/src/pages/PlayPage.tsx` as the composition boundary for these modules.
