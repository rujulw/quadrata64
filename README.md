# quadrata64

A real-time multiplayer chess platform built with React, TypeScript, and a native WebSocket server.  
Server-authoritative state management with synchronized move validation using `chess.js`.

See:
- `docs/architecture.md` for system structure and synchronization model.
- `roadmap.md` for planned refactors and feature expansion.

## Tech Stack

### Backend
- Node.js
- TypeScript
- Native WebSocket server (`ws`)
- `chess.js` for rule enforcement and move validation

### Frontend
- React 18 (Vite)
- TypeScript
- TailwindCSS
- React Router
- WebSocket client synchronization

## Project Structure
- `client/` React UI and board interaction logic
- `server/` WebSocket server and game state management
- `docs/` architecture notes and system planning
- `roadmap.md` execution roadmap

## Quick Start

### 1. Start backend
```bash
cd server
npm install
npx ts-node src/index.ts
```

### 2. Start frontend
```bash
cd client
npm install
npm run dev
```

Frontend default: `http://localhost:5173`  
WebSocket server default: `ws://localhost:3000`

## Environment Variables

### Server (`server/.env`)
- `PORT=3000`
- `CLIENT_URL=http://localhost:5173`

### Client (`client/.env`)
- `VITE_WS_URL=ws://localhost:3000`

## Known Gaps
- No matchmaking system yet (manual room pairing).
- No persistent game storage.
- No clock / time control implementation.
- No comprehensive test suite yet.

## Development Workflow
- Branch naming: `feat/<branch-name>`
- Commit convention: `[impl] brief message` and `[refactor] brief message`
- Architecture notes maintained under `docs/`