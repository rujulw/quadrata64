# Bug Log

## 2026-03-23 — Play screen atmosphere and dev-mode overhead masked board interaction performance
- Symptom: Piece dragging, panel motion, and general UI responsiveness felt broadly choppy on `/play`, especially while connected to a live game.
- Root cause: The play route was carrying expensive atmosphere/render work (full-screen dotted map, clock-driven rerenders, heavier panel treatment) while local development was also running under React StrictMode.
- Fix: Simplified `/play` presentation, removed the play-page dotted map, memoized board composition boundaries, and disabled StrictMode locally so gameplay interactions are not penalized by decorative work.
- Files: `client/src/main.tsx`, `client/src/pages/PlayPage.tsx`, `client/src/features/board/BoardSurface.tsx`, `client/src/features/room/WaitingRoomPanel.tsx`

---

## 2026-03-23 — Pointer-captured drag preview regressed pickup and drop feel
- Symptom: Dragging initially felt detached from the cursor, previewed with a square-ish dark halo, and legal drops could snap back instead of applying the move.
- Root cause: Preview positioning ignored the original grab offset, drag shadow darkened transparent SVG bounds, and pointer-captured `pointerup` events could resolve back to the source square if hit testing trusted the event target first.
- Fix: Stored grab offset and preview size from pointer-down, removed preview shadow, prioritized `elementFromPoint` for drop targeting, and tuned legal-target visuals plus press-and-hold lift behavior.
- Files: `client/src/features/board/BoardSurface.tsx`, `client/src/features/board/BoardSurface.test.tsx`

---

## 2026-03-23 — Waiting-room simplification accidentally bypassed match-found animation path
- Symptom: The bouncing "finding match" loader and the flip into the active panel stopped appearing during room activation.
- Root cause: A conditional split between a flip shell and a static active shell made the waiting/match-found transition path easy to skip, and the 3D perspective wrapper was removed.
- Fix: Restored the always-mounted flip shell, brought back `perspective-distant`, and preserved the waiting-state loader + match-found burst path while keeping the play screen otherwise lighter.
- Files: `client/src/features/room/WaitingRoomPanel.tsx`

---

## 2026-03-23 — Client and server timer paths needed authoritative time-control coverage
- Symptom: Clocks, timeout status, and reconnect/partial-snapshot timer continuity were not represented end-to-end in the gameplay stack.
- Root cause: Earlier gameplay milestones shipped move authority and result handling before time control and timer state existed as a first-class contract.
- Fix: Added authoritative server time-control config and timer state, client clock/timeout UI, partial-snapshot timer projection, and regression tests for timeout, increment, drift, reconnect, and turn-change behavior.
- Files: `server/src/game/GameEngine.ts`, `server/src/game/GameEngine.test.ts`, `client/src/features/ws/useWsSync.ts`, `client/src/features/ws/useWsSync.test.tsx`, `client/src/pages/PlayPage.tsx`, `client/src/features/room/WaitingRoomPanel.tsx`, `client/src/features/room/WaitingRoomPanel.test.tsx`

---

## 2026-03-11 — Gameplay side panel lacked synchronized move/result visibility
- Symptom: `/play` showed room controls but did not surface move history, turn state, or terminal result context in the side panel.
- Root cause: Client state adapter tracked only room/game snapshots without explicit move-feed projection.
- Fix: Added move-feed derivation in websocket sync layer, terminal result formatting, and integrated panel UI for turn indicator + move feed + result label.
- Files: `client/src/features/ws/useWsSync.ts`, `client/src/pages/PlayPage.tsx`, `client/src/features/room/WaitingRoomPanel.tsx`

---

## 2026-03-11 — New websocket sync logic had no targeted regression tests
- Symptom: Move-feed parsing and result mapping paths were unverified by tests, increasing risk of silent UI drift.
- Root cause: Existing client tests covered room panel and board interactions but not websocket state adaptation internals.
- Fix: Added `useWsSync` hook tests with mocked websocket events for init-game reset, SAN move append, dedupe behavior, and game-over result mapping.
- Files: `client/src/features/ws/useWsSync.test.tsx`

---

## 2026-03-11 — Server game payload contract lacked automated verification
- Symptom: Critical snapshot/result fields (`moveCount`, `lastMove`, checkmate result) relied on manual validation only.
- Root cause: Backend had build/typecheck gates but no executable regression tests.
- Fix: Added `node:test` coverage for `GameEngine` and introduced `server` `npm run test` script.
- Files: `server/src/game/GameEngine.test.ts`, `server/package.json`

---

## 2026-03-09 — React StrictMode cleanup closed websocket before handshake completion
- Symptom: Browser surfaced `WebSocket is closed before the connection is established` during `/play` mount/unmount cycles in dev.
- Root cause: Client cleanup path called `close()` on a `CONNECTING` socket during StrictMode double-invoke lifecycle.
- Fix: Updated websocket adapter to guard `CONNECTING`/`OPEN` socket reuse, defer close for pre-open sockets, and ignore stale socket events.
- Files: `client/src/features/ws/useWsSync.ts`

---

## 2026-03-09 — Waiting-room regressions lacked interaction-level client test coverage
- Symptom: UI-ready states and action dispatch behavior could regress silently during rapid panel/layout iteration.
- Root cause: No client test harness was configured for component interaction testing.
- Fix: Added Vitest + Testing Library setup and waiting-room panel tests for rendering states and ready-action dispatch.
- Files: `client/package.json`, `client/vite.config.ts`, `client/src/test/setup.ts`, `client/src/features/room/WaitingRoomPanel.test.tsx`

---

## 2026-03-05 — Monolithic websocket entrypoint increased regression surface
- Symptom: `index.ts` mixed parse, validation, room lifecycle routing, game lifecycle, and socket fanout in one file.
- Root cause: Initial implementation optimized for delivery speed rather than long-term handler isolation.
- Fix: Extracted transport orchestration to `ws/router.ts` and payload/envelope guards to `ws/validators.ts`, leaving `index.ts` as bootstrap wiring only.
- Files: `server/src/index.ts`, `server/src/ws/router.ts`, `server/src/ws/validators.ts`

---

## 2026-03-05 — Legacy pending-user matchmaking race risk during port
- Symptom: Old prototype approach could pair sockets opportunistically (`pendingUser`), bypassing room readiness guarantees.
- Root cause: Matchmaking ownership was embedded inside transport manager instead of room/session lifecycle.
- Fix: Kept room activation in `RoomManager`, game ownership in session-scoped `GameManager`, and avoided reintroducing pending-user state in router refactor.
- Files: `server/src/session/RoomManager.ts`, `server/src/game/GameManager.ts`, `server/src/ws/router.ts`

---

## 2026-03-05 — Terminal moves lacked explicit `game_over` lifecycle event
- Symptom: Clients could receive final move state but had no dedicated authoritative terminal event to lock UI flow.
- Root cause: Router broadcasted `move_applied` snapshots only, without terminal-state signal.
- Fix: Added terminal `game_over` broadcast with structured `{ gameId, result, snapshot }` payload.
- Files: `server/src/index.ts`

---

## 2026-03-05 — Finished games accepted extra move intents at protocol boundary
- Symptom: After game completion, move requests could still be attempted without a stable protocol-level terminal error code.
- Root cause: Engine surfaced terminal inactivity, but router did not map it to explicit external contract semantics.
- Fix: Added `game_already_finished` protocol error and mapped engine `game_not_active` to that error in move handling.
- Files: `server/src/index.ts`, `server/src/protocol/messages.ts`

---

## 2026-03-05 — Ambiguous room-close cleanup intent in game registry lifecycle
- Symptom: Game cleanup API name was generic, which made room-lifecycle teardown intent less explicit in router paths.
- Root cause: Registry only exposed `closeGame`, while callsites were strictly room-bound lifecycle exits.
- Fix: Added `closeGameForRoom(sessionId)` and switched router room-close/disconnect flows to use it.
- Files: `server/src/game/GameManager.ts`, `server/src/index.ts`

---

## 2026-03-05 — `init_game` payload drift between clients and server authority
- Symptom: Activation emitted an ad-hoc payload (`room`, `startedAt`) that did not match typed game contracts.
- Root cause: Router init broadcast predated game snapshot wiring.
- Fix: On activation edge, router now creates/requires game and sends typed per-player `init_game` with `gameId`, `youAre`, and authoritative `snapshot`.
- Files: `server/src/index.ts`

---

## 2026-03-05 — Move route acknowledged active rooms but never applied moves
- Symptom: `move` requests passed room-state gate but always returned `not_implemented`.
- Root cause: Game registry and engine were not wired into websocket handlers.
- Fix: Move handler now resolves session game, applies via `GameEngine`, and broadcasts typed `move_applied` snapshots.
- Files: `server/src/index.ts`, `server/src/protocol/messages.ts`

---

## 2026-03-05 — Missing typed move failure semantics in router responses
- Symptom: Wrong-turn and illegal moves were not represented as stable protocol error codes.
- Root cause: Router had no mapping from engine failures to protocol-layer errors.
- Fix: Added typed error codes (`game_not_found`, `wrong_turn_player`, `illegal_move`) and mapped engine/game-manager failures at the router boundary.
- Files: `server/src/index.ts`, `server/src/protocol/messages.ts`

---

## 2026-03-05 — Duplicate game creation risk on repeated activation edges
- Symptom: Without a registry guard, repeated activation handling could create multiple engine instances for the same room.
- Root cause: No single owner mapping from `sessionId` to active game instance.
- Fix: Added `GameManager` registry keyed by `sessionId` and explicit `GAME_ALREADY_EXISTS` rejection.
- Files: `server/src/game/GameManager.ts`

---

## 2026-03-05 — Orphaned game state risk after room lifecycle closure
- Symptom: Game engines could remain in memory after a room is closed, risking stale state reuse and leaks.
- Root cause: No explicit lifecycle endpoint for per-room game teardown.
- Fix: Added `closeGameForRoom(sessionId)` and room-scoped registry ownership to support deterministic cleanup.
- Files: `server/src/game/GameManager.ts`

---

## 2026-03-01 — Ambiguous game payload contracts blocked safe engine port
- Symptom: Existing `init_game`/`move` flow lacked explicit authoritative snapshot and result payload schemas.
- Root cause: Early websocket milestones focused on routing and room lifecycle before game-core contract modeling.
- Fix: Introduced `game/types` and protocol payload contracts for move intent, snapshot broadcasts, and terminal outcomes before engine wiring.
- Files: `server/src/game/types.ts`, `server/src/protocol/types.ts`

---

## 2026-03-01 — Envelope accepted malformed payload shape
- Symptom: Valid JSON with missing/invalid payload fields could pass parse and reach business logic.
- Root cause: Initial websocket skeleton only parsed JSON without payload-level guards.
- Fix: Added per-message validators for `join_room`, `leave_room`, `ready`, and `move` payload boundaries.
- Files: `server/src/ws/validators.ts`

---

## 2026-03-01 — Socket identity mismatch risk across room actions
- Symptom: A socket could attempt actions for a different `peerId`/room combination.
- Root cause: No socket-to-membership binding in early handler flow.
- Fix: Added socket membership mapping and strict match checks before `leave`, `ready`, and `move`.
- Files: `server/src/index.ts`

---

## 2026-03-01 — Ready flow missing activation transition and start signal
- Symptom: `ready` messages were parsed but did not transition room state or notify clients.
- Root cause: `ready` path returned `not_implemented` placeholder.
- Fix: Added `setPlayerReady` in `RoomManager`, `waiting -> active` transition logic, and `init_game` broadcast on activation.
- Files: `server/src/session/RoomManager.ts`, `server/src/index.ts`

---

## 2026-03-01 — Move intent accepted without room-state gating
- Symptom: Move message type existed but no enforcement of active-session precondition.
- Root cause: No room-state check before processing move requests.
- Fix: Added move handler gate via `RoomManager.canAcceptMoves`; rejects moves when room is not active.
- Files: `server/src/session/RoomManager.ts`, `server/src/index.ts`

---

## 2026-03-01 — Doc drift during incremental backend milestones
- Symptom: Architecture and plan docs lagged behind implementation checkpoints.
- Root cause: Early implementation milestones landed before doc updates were consolidated.
- Fix: Consolidated roadmap, design, architecture, and bug-log updates into a single documentation sync pass.
- Files: `docs/architecture.md`, `docs/roadmap.md`, `docs/design.md`, `docs/bug-log.md`
