import { WebSocketServer, WebSocket } from "ws";

import {
  ERROR_CODES,
  MESSAGE_TYPES,
  type ErrorCode,
} from "./protocol/messages";
import type {
  BaseMessage,
  JoinRoomPayload,
  LeaveRoomPayload,
  ReadyPayload,
} from "./protocol/types";
import {
  ROOM_MANAGER_ERRORS,
  RoomManager,
  type RoomManagerErrorCode,
} from "./session/RoomManager";
import type { PlayerId, SessionId } from "./session/types";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const wss = new WebSocketServer({ port: PORT });
const roomManager = new RoomManager({ maxPlayers: 2, maxSpectators: 0 });

interface SocketMembership {
  roomId: SessionId;
  playerId: PlayerId;
}

type IncomingMessage = BaseMessage<unknown>;

interface ErrorPayload {
  code: ErrorCode | RoomManagerErrorCode;
  message: string;
  details?: unknown;
}

const socketMembershipBySocket = new Map<WebSocket, SocketMembership>();
const socketsByRoom = new Map<SessionId, Set<WebSocket>>();

console.log(`WebSocket server listening on ws://localhost:${PORT}`);

wss.on("connection", (socket: WebSocket) => {
  console.log("Client connected");

  socket.on("message", (data) => {
    const parseResult = parseIncomingMessage(data.toString());
    if (!parseResult.ok) {
      sendError(socket, parseResult.error, parseResult.message);
      return;
    }

    const message = parseResult.message;
    switch (message.type) {
      case MESSAGE_TYPES.JOIN_ROOM:
        handleJoinRoom(socket, message);
        return;
      case MESSAGE_TYPES.LEAVE_ROOM:
        handleLeaveRoom(socket, message);
        return;
      case MESSAGE_TYPES.READY:
        handleReady(socket, message);
        return;
      default:
        sendError(
          socket,
          ERROR_CODES.UNSUPPORTED_MESSAGE_TYPE,
          `Unsupported message type '${message.type}'`,
        );
        return;
    }
  });

  socket.on("close", () => {
    const membership = socketMembershipBySocket.get(socket);
    if (membership) {
      handleSocketDisconnect(socket, membership);
    }
    console.log("Client disconnected");
  });
});

function handleJoinRoom(socket: WebSocket, message: IncomingMessage): void {
  const payloadResult = validateJoinRoomPayload(message);
  if (!payloadResult.ok) {
    sendError(socket, ERROR_CODES.INVALID_PAYLOAD, payloadResult.message);
    return;
  }

  const payload = payloadResult.payload;
  const existingMembership = socketMembershipBySocket.get(socket);
  if (existingMembership) {
    if (
      existingMembership.roomId === payload.roomId &&
      existingMembership.playerId === payload.playerId
    ) {
      const room = roomManager.getRoom(payload.roomId);
      if (!room) {
        sendError(
          socket,
          ROOM_MANAGER_ERRORS.ROOM_NOT_FOUND,
          `Room '${payload.roomId}' does not exist`,
          payload.roomId,
        );
        return;
      }

      broadcastRoomState(payload.roomId);
      return;
    }

    sendError(
      socket,
      ERROR_CODES.SOCKET_ALREADY_ASSIGNED,
      "Socket is already assigned to a room/player mapping",
      payload.roomId,
      existingMembership,
    );
    return;
  }

  const existingRoom = roomManager.getRoom(payload.roomId);
  if (!existingRoom) {
    const createResult = roomManager.createRoom(payload.roomId);
    if (!createResult.ok) {
      sendError(socket, createResult.error, createResult.message, payload.roomId);
      return;
    }
  }

  const joinResult = roomManager.joinRoom({
    sessionId: payload.roomId,
    playerId: payload.playerId,
    requestedSeat: payload.requestedSeat,
  });
  if (!joinResult.ok) {
    sendError(socket, joinResult.error, joinResult.message, payload.roomId);
    return;
  }

  bindSocketMembership(socket, payload.roomId, payload.playerId);
  broadcastRoomState(payload.roomId);
}

function handleLeaveRoom(socket: WebSocket, message: IncomingMessage): void {
  const payloadResult = validateLeaveRoomPayload(message);
  if (!payloadResult.ok) {
    sendError(socket, ERROR_CODES.INVALID_PAYLOAD, payloadResult.message);
    return;
  }

  const payload = payloadResult.payload;
  const existingMembership = socketMembershipBySocket.get(socket);
  if (!existingMembership) {
    sendError(
      socket,
      ERROR_CODES.SOCKET_NOT_ASSIGNED,
      "Socket is not assigned to a room",
      payload.roomId,
    );
    return;
  }

  if (
    existingMembership.roomId !== payload.roomId ||
    existingMembership.playerId !== payload.playerId
  ) {
    sendError(
      socket,
      ERROR_CODES.SOCKET_ALREADY_ASSIGNED,
      "Socket membership does not match leave request",
      payload.roomId,
      existingMembership,
    );
    return;
  }

  const leaveResult = roomManager.leaveRoom({
    sessionId: payload.roomId,
    playerId: payload.playerId,
  });
  if (!leaveResult.ok) {
    sendError(socket, leaveResult.error, leaveResult.message, payload.roomId);
    return;
  }

  unbindSocketMembership(socket);

  if (leaveResult.data.roomClosed) {
    const roomSockets = socketsByRoom.get(payload.roomId);
    if (roomSockets) {
      for (const roomSocket of roomSockets) {
        sendRoomState(roomSocket, payload.roomId, null);
      }
      socketsByRoom.delete(payload.roomId);
    }
    return;
  }

  broadcastRoomState(payload.roomId);
}

function handleReady(socket: WebSocket, message: IncomingMessage): void {
  const payloadResult = validateReadyPayload(message);
  if (!payloadResult.ok) {
    sendError(socket, ERROR_CODES.INVALID_PAYLOAD, payloadResult.message);
    return;
  }

  const payload = payloadResult.payload;
  const membership = socketMembershipBySocket.get(socket);
  if (
    !membership ||
    membership.roomId !== payload.roomId ||
    membership.playerId !== payload.playerId
  ) {
    sendError(
      socket,
      ERROR_CODES.SOCKET_NOT_ASSIGNED,
      "Ready request requires socket membership in the target room",
      payload.roomId,
    );
    return;
  }

  sendError(
    socket,
    ERROR_CODES.NOT_IMPLEMENTED,
    "Ready handling will be implemented in the next milestone",
    payload.roomId,
  );
}

function handleSocketDisconnect(
  socket: WebSocket,
  membership: SocketMembership,
): void {
  const leaveResult = roomManager.leaveRoom({
    sessionId: membership.roomId,
    playerId: membership.playerId,
  });

  unbindSocketMembership(socket);

  if (!leaveResult.ok) {
    return;
  }

  if (leaveResult.data.roomClosed) {
    const roomSockets = socketsByRoom.get(membership.roomId);
    if (roomSockets) {
      for (const roomSocket of roomSockets) {
        sendRoomState(roomSocket, membership.roomId, null);
      }
      socketsByRoom.delete(membership.roomId);
    }
    return;
  }

  broadcastRoomState(membership.roomId);
}

function bindSocketMembership(
  socket: WebSocket,
  roomId: SessionId,
  playerId: PlayerId,
): void {
  socketMembershipBySocket.set(socket, { roomId, playerId });
  let roomSockets = socketsByRoom.get(roomId);
  if (!roomSockets) {
    roomSockets = new Set<WebSocket>();
    socketsByRoom.set(roomId, roomSockets);
  }
  roomSockets.add(socket);
}

function unbindSocketMembership(socket: WebSocket): void {
  const membership = socketMembershipBySocket.get(socket);
  if (!membership) {
    return;
  }

  socketMembershipBySocket.delete(socket);
  const roomSockets = socketsByRoom.get(membership.roomId);
  if (!roomSockets) {
    return;
  }

  roomSockets.delete(socket);
  if (roomSockets.size === 0) {
    socketsByRoom.delete(membership.roomId);
  }
}

function parseIncomingMessage(
  rawData: string,
):
  | { ok: true; message: IncomingMessage }
  | { ok: false; error: ErrorCode; message: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    return {
      ok: false,
      error: ERROR_CODES.INVALID_JSON,
      message: "Message body must be valid JSON",
    };
  }

  if (!isMessageEnvelope(parsed)) {
    return {
      ok: false,
      error: ERROR_CODES.INVALID_ENVELOPE,
      message: "Message must include a string 'type' and optional string 'roomId'",
    };
  }

  return { ok: true, message: parsed };
}

function isMessageEnvelope(value: unknown): value is IncomingMessage {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.type !== "string") {
    return false;
  }
  if ("roomId" in value && value.roomId !== undefined && typeof value.roomId !== "string") {
    return false;
  }
  return true;
}

function validateJoinRoomPayload(
  message: IncomingMessage,
): { ok: true; payload: JoinRoomPayload } | { ok: false; message: string } {
  if (!isRecord(message.payload)) {
    return { ok: false, message: "join_room requires an object payload" };
  }

  const roomId = message.payload.roomId;
  const playerId = message.payload.playerId;
  const requestedSeat = message.payload.requestedSeat;

  if (typeof roomId !== "string" || roomId.length === 0) {
    return { ok: false, message: "join_room payload.roomId must be a non-empty string" };
  }
  if (typeof playerId !== "string" || playerId.length === 0) {
    return { ok: false, message: "join_room payload.playerId must be a non-empty string" };
  }
  if (message.roomId && message.roomId !== roomId) {
    return { ok: false, message: "join_room roomId and payload.roomId must match" };
  }
  if (
    requestedSeat !== undefined &&
    requestedSeat !== "white" &&
    requestedSeat !== "black"
  ) {
    return { ok: false, message: "join_room payload.requestedSeat must be 'white' or 'black'" };
  }

  return {
    ok: true,
    payload: {
      roomId,
      playerId,
      requestedSeat,
    },
  };
}

function validateLeaveRoomPayload(
  message: IncomingMessage,
): { ok: true; payload: LeaveRoomPayload } | { ok: false; message: string } {
  if (!isRecord(message.payload)) {
    return { ok: false, message: "leave_room requires an object payload" };
  }

  const roomId = message.payload.roomId;
  const playerId = message.payload.playerId;
  if (typeof roomId !== "string" || roomId.length === 0) {
    return { ok: false, message: "leave_room payload.roomId must be a non-empty string" };
  }
  if (typeof playerId !== "string" || playerId.length === 0) {
    return { ok: false, message: "leave_room payload.playerId must be a non-empty string" };
  }
  if (message.roomId && message.roomId !== roomId) {
    return { ok: false, message: "leave_room roomId and payload.roomId must match" };
  }

  return {
    ok: true,
    payload: { roomId, playerId },
  };
}

function validateReadyPayload(
  message: IncomingMessage,
): { ok: true; payload: ReadyPayload } | { ok: false; message: string } {
  if (!isRecord(message.payload)) {
    return { ok: false, message: "ready requires an object payload" };
  }

  const roomId = message.payload.roomId;
  const playerId = message.payload.playerId;
  const ready = message.payload.ready;
  if (typeof roomId !== "string" || roomId.length === 0) {
    return { ok: false, message: "ready payload.roomId must be a non-empty string" };
  }
  if (typeof playerId !== "string" || playerId.length === 0) {
    return { ok: false, message: "ready payload.playerId must be a non-empty string" };
  }
  if (typeof ready !== "boolean") {
    return { ok: false, message: "ready payload.ready must be boolean" };
  }
  if (message.roomId && message.roomId !== roomId) {
    return { ok: false, message: "ready roomId and payload.roomId must match" };
  }

  return {
    ok: true,
    payload: { roomId, playerId, ready },
  };
}

function sendError(
  socket: WebSocket,
  code: ErrorCode | RoomManagerErrorCode,
  message: string,
  roomId?: SessionId,
  details?: unknown,
): void {
  const payload: ErrorPayload = { code, message };
  if (details !== undefined) {
    payload.details = details;
  }
  send(socket, {
    type: MESSAGE_TYPES.ERROR,
    roomId,
    payload,
  });
}

function broadcastRoomState(roomId: SessionId): void {
  const roomSockets = socketsByRoom.get(roomId);
  if (!roomSockets || roomSockets.size === 0) {
    return;
  }

  const room = roomManager.getRoom(roomId);
  for (const roomSocket of roomSockets) {
    sendRoomState(roomSocket, roomId, room);
  }
}

function sendRoomState(
  socket: WebSocket,
  roomId: SessionId,
  roomState: ReturnType<RoomManager["getRoom"]>,
): void {
  send(socket, {
    type: MESSAGE_TYPES.ROOM_STATE,
    roomId,
    payload: roomState,
  });
}

function send(socket: WebSocket, message: BaseMessage<unknown>): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }
  socket.send(JSON.stringify(message));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
