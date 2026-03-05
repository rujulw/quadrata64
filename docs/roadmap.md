# Roadmap

## Goal
Port the older websocket chess prototype into a typed, server-authoritative session architecture with clean commit discipline and staged PRs.

## Immediate Baseline
- [x] websocket server bootstrap and JSON boundary
- [x] protocol/message constants and typed payload contracts
- [x] session domain types (`SessionId`, `PlayerId`, `RoomState`, slot model)
- [x] room manager waiting-room lifecycle (create/join/leave/auto-close)
- [x] router wiring by message type with typed error responses
- [x] socket -> room membership mapping and disconnect cleanup
- [x] ready-check transition `waiting -> active`
- [x] `init_game` broadcast on session activation
- [x] move rejection while room is not active
- [x] game-core domain and payload contracts (`GameSnapshot`, move intent, game-over payload)
- [x] move application path behind active-session gate
- [x] authoritative `move_applied` snapshot broadcasts
- [x] terminal `game_over` broadcast and finished-game move freeze

## 1. Complete Current Branch (Final Impl + Docs)
- [x] Implement move application path behind active-session gate.
- [x] Integrate chess engine state with `init_game` and post-move state broadcasts.
- [x] Emit deterministic terminal-state `game_over` payload and freeze further moves.
- [x] Finalize consolidated docs commit (design + bug-log + roadmap + architecture).

## 2. Post-MVP Hardening
- Add reconnection strategy for transient disconnects.
- Add stale membership/heartbeat cleanup policy.
- Add room-manager unit tests for lifecycle and readiness transitions.
- Add protocol validation tests for malformed payload paths.

## 3. Gameplay Integration
- [x] Apply validated move intents using `chess.js`.
- [x] Broadcast authoritative game-state snapshots after each move.
- [x] Emit deterministic game-over outcomes from server state.

## 4. Product Layer
- Add optional matchmaking queue.
- Add persistence for completed games/history.
- Add time controls and clock synchronization.
