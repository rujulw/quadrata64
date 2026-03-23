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

---

## 11. Client Waiting-Room Sync over Server Authority

Decision:
Drive `/play` waiting-room readiness UI from authoritative websocket `room_state` events, not local-only toggles.

Why:
- Keeps room seat/readiness state consistent across tabs and clients.
- Avoids UI drift where local "ready" appears set but server does not accept state.
- Preserves server-authoritative lifecycle (`waiting -> active`) as the single source of truth.

Impact:
- `client/src/features/ws/useWsSync.ts` now opens websocket, sends `join_room`, and hydrates room state from inbound `room_state`.
- Ready button dispatches real `ready` payloads (`roomId`, `playerId`, `ready`) instead of local-only state updates.
- Tab-scoped player identity is persisted via `sessionStorage` for multi-tab local testing.

---

## 12. Client Interaction Testing Baseline

Decision:
Introduce a lightweight client test harness focused on waiting-room rendering and action dispatch.

Why:
- Protects the most regression-prone surface introduced in commit 19: UI state mapping + ready intent dispatch.
- Enables fast confidence checks during rapid UI iteration.
- Establishes reusable tooling for upcoming board interaction tests.

Impact:
- Added Vitest + Testing Library setup (`client/vite.config.ts`, `client/src/test/setup.ts`, `client/package.json` scripts).
- Added `client/src/features/room/WaitingRoomPanel.test.tsx` covering:
- state rendering (`ready_up`, `queued`, `unready`, waiting/active phase)
- action dispatch (`onToggleReady`)
- disabled controls for non-seated users

---

## 13. Match Panel as Game Telemetry Surface

Decision:
Evolve the waiting-room card into a live gameplay panel that remains useful after match start.

Why:
- Keeps room controls, move history, and result status in one stable UI region.
- Reduces context switching during play by pairing board + telemetry side-by-side.
- Improves perceived responsiveness when authoritative updates arrive over websocket.

Impact:
- `WaitingRoomPanel` now renders:
- turn-status indicator (`white/black to move` / finished)
- rolling move feed grouped by move number
- terminal result label when game is finished
- time-control selector with animated dropdown UI

---

## 14. Client SAN Feed Derived from Authoritative Move Events

Decision:
Generate SAN notation client-side from authoritative `move_applied` events using a local `chess.js` instance seeded from `init_game`.

Why:
- Server payload currently provides move coordinates and snapshot, not SAN.
- SAN improves readability of move history without changing protocol shape immediately.
- Keeps UI move feed stable while preserving server-authoritative move legality.

Impact:
- Added move-feed state and parsing in `useWsSync`.
- Added duplicate-move guard and bounded feed retention for UI rendering.
- Added hook tests for init/reset, move append, and dedupe behavior.

---

## 15. Backend Test Baseline with `node:test`

Decision:
Introduce lightweight server tests with Node’s built-in test runner before adding a larger backend framework.

Why:
- Covers core game-result and snapshot contracts quickly with minimal tooling overhead.
- Ensures payload-critical fields (`moveCount`, `lastMove`, `result`) stay stable.
- Provides CI-friendly regression checks for game engine behavior.

Impact:
- Added `server/src/game/GameEngine.test.ts`.
- Added `server` `npm run test` script (`build` + `node --test`).

---

## 16. Server-Authoritative Time Control and Timer State

Decision:
Model time control presets and per-side remaining clock directly in server game snapshots.

Why:
- Keeps timeout and increment behavior authoritative instead of trusting client timers.
- Makes reconnect and partial snapshot recovery possible from a consistent timer contract.
- Lets client UI render clocks without inventing game-state rules locally.

Impact:
- `GameEngine` now owns `timeControl` and `timer` state and resolves timeout as a terminal result.
- Room readiness carries selected time-control choice into active game creation.
- Client sync and panel/board UI consume authoritative timer fields rather than static defaults alone.

---

## 17. Pointer-Captured Drag Interaction with Thresholded Lift

Decision:
Move board dragging onto pointer events with pointer capture, a drag threshold, and a ref-driven preview layer.

Why:
- Produces a more reliable drag model across devices than window-scoped mouse events.
- Separates press-and-hold piece lift from full drag activation so click-to-move and drag-to-move coexist cleanly.
- Reduces hot-path render churn by keeping live drag position in refs and syncing preview motion per animation frame.

Impact:
- `BoardSurface` now starts drag on `pointerdown`, captures the pointer, and finalizes drop from pointer-location hit testing.
- Drag preview keeps the original grab offset and piece bounds so pickup feels attached to the cursor.
- Board tests now cover threshold crossing, press-and-hold expansion, legal target styling, and drag-drop behavior.

---

## 18. Lightweight Play Surface over Atmospheric Landing Surface

Decision:
Keep the richer visual atmosphere on the landing page, but simplify `/play` so active gameplay prioritizes responsiveness.

Why:
- Background map effects, heavy glassmorphism, and long-lived 3D treatment make interaction regressions harder to read.
- Active gameplay benefits more from stable input latency than decorative motion.
- The match-found loader/flip is a meaningful transition, but ongoing play should settle into a simpler shell.

Impact:
- Removed the dotted-map background from `PlayPage` while preserving the landing-page atmosphere.
- Restored the waiting-state loader and match-found flip path in `WaitingRoomPanel`.
- Simplified active panel treatment while keeping clock, move feed, and action controls intact.
