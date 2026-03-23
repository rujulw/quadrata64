# quadrata64

A real-time multiplayer chess platform built with React, TypeScript, and a native WebSocket server.  
Server-authoritative state management with synchronized move validation using `chess.js`.

See:
- `docs/architecture.md` for system structure and synchronization model.
- `docs/roadmap.md` for planned feature expansion.

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
- Motion (`motion/react`)
- WebSocket client synchronization

## Project Structure
- `client/` React UI and board interaction logic
- `server/` WebSocket server and game state management
- `docs/` architecture notes and system planning

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

## Docker Workflow

### 1. Optional env setup
```bash
cp .env.example .env
```

Defaults:
- `SERVER_PORT=3000`
- `CLIENT_PORT=5173`
- `VITE_WS_URL=ws://localhost:3000`

### 2. Start the full system
```bash
make docker-up
```

### 3. Stop the full system
```bash
make docker-down
```

Useful extras:
```bash
make docker-build
make docker-logs
```

## Environment Variables

### Root (`.env`)
- `SERVER_PORT=3000`
- `CLIENT_PORT=5173`
- `VITE_WS_URL=ws://localhost:3000`

## Known Gaps
- No matchmaking system yet (manual room pairing).
- No persistent game storage.
- No end-to-end multiplayer test suite yet.

## Development Workflow
- Branch naming: `feat/<branch-name>`
- Architecture notes maintained under `docs/`
