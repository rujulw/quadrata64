# Bug Log

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
