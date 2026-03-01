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
