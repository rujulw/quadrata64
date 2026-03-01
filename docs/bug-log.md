# Bug Log

## 2026-03-01 — Room/session module exists but lifecycle is unimplemented
- Symptom: Session files exist, but no room lifecycle logic is available to create/join/leave rooms.
- Root cause: `RoomManager` was scaffolded as a placeholder before implementation.
- Fix: Implement waiting-room lifecycle manager with create/join/leave/close behavior and participant guards.
- Files: `server/src/session/RoomManager.ts`, `server/src/session/types.ts`

---

## 2026-03-01 — WebSocket server accepts JSON but has no typed room routing yet
- Symptom: Server logs incoming messages but does not enforce room/session semantics.
- Root cause: Message protocol types were added before message routing and handlers.
- Fix: Add typed message router in `index.ts` and delegate room lifecycle operations to `RoomManager`.
- Files: `server/src/index.ts`, `server/src/protocol/types.ts`, `server/src/protocol/messages.ts`

---

## 2026-03-01 — Docs and implementation drift risk in early port phase
- Symptom: Architecture intent exists, but roadmap/design/bug tracking were previously sparse.
- Root cause: Early bootstrap commits prioritized scaffolding and protocol types over operational docs.
- Fix: Maintain commit-scoped doc updates and keep bug log entries tied to concrete implementation milestones.
- Files: `docs/architecture.md`, `docs/roadmap.md`, `docs/design.md`, `docs/bug-log.md`
