# Roadmap

## Goal
Port the older chess websocket project into a clean, documented, server-authoritative architecture with predictable room/session behavior and commit discipline.

## Immediate Baseline
- [x] repo scaffolding (`client`, `server`, `docs`, `Makefile`)
- [x] websocket server bootstrap
- [x] protocol/message constants foundation
- [x] session domain and room contract types
- [ ] room manager waiting-room lifecycle
- [ ] websocket message routing for session actions
- [ ] ready-check + transition from waiting to active session

## 1. Session Core Sprint
- Implement `RoomManager` lifecycle:
  - create room
  - join room
  - leave room
  - close room when empty
  - guard waiting-room capacity
- Wire session actions into server message router.
- Add structured error responses for invalid room actions.

## 2. Game Activation Sprint
- Start game only after valid readiness conditions.
- Initialize authoritative chess state per active session.
- Broadcast initial game snapshot to room participants.
- Reject move intents while room state is still `waiting`.

## 3. Synchronization + Resilience Sprint
- Add disconnect handling and stale participant cleanup.
- Add reconnection policy for in-progress sessions.
- Add minimal state snapshot replay path for reconnecting clients.

## 4. Quality + Documentation Sprint
- Add unit tests for room lifecycle transitions.
- Add protocol validation tests for join/leave/ready payloads.
- Keep architecture/design/bug-log updated per implementation PR.
