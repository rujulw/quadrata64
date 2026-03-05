import { WebSocketServer } from "ws";

import { GameManager } from "./game/GameManager";
import { RoomManager } from "./session/RoomManager";
import { registerWsRouter } from "./ws/router";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const wss = new WebSocketServer({ port: PORT });
const roomManager = new RoomManager({ maxPlayers: 2, maxSpectators: 0 });
const gameManager = new GameManager();

console.log(`WebSocket server listening on ws://localhost:${PORT}`);
registerWsRouter(wss, { roomManager, gameManager });
