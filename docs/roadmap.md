# Roadmap

## Goal
Port the older websocket chess prototype into a typed, server-authoritative session architecture with staged feature rollout.

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
- [x] websocket handler/validator extraction (`ws/router.ts`, `ws/validators.ts`)
- [x] consolidated architecture docs sync for legacy-port decomposition and risk log
- [x] Tailwind v4 CSS-first migration (`tailwindcss` + `@tailwindcss/postcss`)
- [x] frontend visual-system baseline (AMOLED shell, purple/white board palette, typography + motion primitives)
- [x] landing experience refactor with reusable UI primitives (`button`, `hero-highlight`, `card-spotlight`, `dotted-map`)
- [x] client feature-module boundary split (`features/ws`, `features/room`, `features/board`)
- [x] `/play` waiting-room websocket sync (`join_room`, `room_state` hydration, ready dispatch)
- [x] client-side ready-state synchronization in UI (waiting/active mapped from server room state)
- [x] initial client interaction tests for waiting-room rendering + action dispatch (Vitest + Testing Library)
- [x] board move intent UX with legal target handling
- [x] side-panel game telemetry (turn indicator, move feed, terminal result label)
- [x] websocket move-feed synchronization with SAN notation fallback
- [x] backend engine regression tests (`node:test`) for move payload/result contracts
- [x] draw/resign workflow (protocol + server handling + client controls)
- [x] client-side planning arrows via right-click interactions
- [x] authoritative time controls and synchronized clock UI
- [x] pointer-driven drag-and-drop interaction with captured preview and thresholded lift
- [x] timer drift / timeout / increment regression coverage across reconnect and turn changes

## 1. Complete Current Branch (Final Impl + Docs)
- [x] Implement move application path behind active-session gate.
- [x] Integrate chess engine state with `init_game` and post-move state broadcasts.
- [x] Emit deterministic terminal-state `game_over` payload and freeze further moves.
- [x] Extract websocket handlers/validators to keep index thin without behavior drift.
- [x] Finalize consolidated docs sync (design + bug-log + roadmap + architecture).

## Next Milestones (Immediate)
- Merge completed time-control branch into `development`.
- Continue gameplay-feel work on pointer drag polish and render-cost reduction for `/play`.
- Expand server test coverage for router/session integration paths.
- Decide on persistence scope for completed game history and move archives.

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
- Continue gameplay UX polish until production release quality is reached.
