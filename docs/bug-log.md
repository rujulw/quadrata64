# Bug Log

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
- Fix: Added `closeGame(sessionId)` and room-scoped registry ownership to support deterministic cleanup.
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
- Files: `server/src/index.ts`

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

## 2026-03-01 — Doc drift during incremental backend commits
- Symptom: Architecture and plan docs lagged behind implementation checkpoints.
- Root cause: Early implementation milestones landed before doc updates were consolidated.
- Fix: Consolidated roadmap, design, architecture, and bug-log updates into branch-end doc pass.
- Files: `docs/architecture.md`, `docs/roadmap.md`, `docs/design.md`, `docs/bug-log.md`
