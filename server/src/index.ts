import { WebSocketServer, WebSocket } from "ws";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const wss = new WebSocketServer({ port: PORT });

console.log(`WebSocket server listening on ws://localhost:${PORT}`);

wss.on("connection", (socket: WebSocket) => {
  console.log("Client connected");

  socket.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log("Received:", message);
    } catch (err) {
      console.error("Invalid message format");
    }
  });

  socket.on("close", () => {
    console.log("Client disconnected");
  });
});