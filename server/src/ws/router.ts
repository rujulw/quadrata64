import { WebSocket, WebSocketServer } from "ws";

import {
  ERROR_CODES,
  MESSAGE_TYPES,
  type ErrorCode,
} from "../protocol/messages";
import type {
  BaseMessage,
  GameOverPayload,
  InitGamePayload,
  MoveAppliedPayload,
  MoveIntentPayload,
} from "../protocol/types";
import {
  GAME_ENGINE_ERRORS,
  type GameEngineErrorCode,
} from "../game/GameEngine";
import {
  GameManager,
  type GameManagerErrorCode,
} from "../game/GameManager";
import {
  ROOM_MANAGER_ERRORS,
  RoomManager,
  type RoomManagerErrorCode,
} from "../session/RoomManager";
import type { PlayerId, SessionId } from "../session/types";
import {
  parseIncomingMessage,
  type IncomingMessage,
  validateJoinRoomPayload,
  validateLeaveRoomPayload,
  validateMovePayload,
  validateReadyPayload,
} from "./validators";

interface SocketMembership {
  roomId: SessionId;
  playerId: PlayerId;
}

interface ErrorPayload {
  code:
    | ErrorCode
    | RoomManagerErrorCode
    | GameManagerErrorCode
    | GameEngineErrorCode;
  message: string;
  details?: unknown;
}

export interface WsRouterDependencies {
  roomManager: RoomManager;
  gameManager: GameManager;
}

export function registerWsRouter(
  wss: WebSocketServer,
  deps: WsRouterDependencies,
): void {
  const socketMembershipBySocket = new Map<WebSocket, SocketMembership>();
  const socketsByRoom = new Map<SessionId, Set<WebSocket>>();

  const { roomManager, gameManager } = deps;

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
        case MESSAGE_TYPES.MOVE:
          handleMove(socket, message);
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
      gameManager.closeGameForRoom(payload.roomId);
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

    const readyResult = roomManager.setPlayerReady({
      sessionId: payload.roomId,
      playerId: payload.playerId,
      ready: payload.ready,
    });
    if (!readyResult.ok) {
      sendError(socket, readyResult.error, readyResult.message, payload.roomId);
      return;
    }

    broadcastRoomState(payload.roomId);

    if (readyResult.data.activated) {
      createAndBroadcastInitGame(payload.roomId);
    }
  }

  function handleMove(socket: WebSocket, message: IncomingMessage): void {
    const payloadResult = validateMovePayload(message);
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
        "Move request requires socket membership in the target room",
        payload.roomId,
      );
      return;
    }

    const activeResult = roomManager.canAcceptMoves(payload.roomId);
    if (!activeResult.ok) {
      sendError(socket, activeResult.error, activeResult.message, payload.roomId);
      return;
    }

    const gameResult = gameManager.requireGame(payload.roomId);
    if (!gameResult.ok) {
      sendError(
        socket,
        ERROR_CODES.GAME_NOT_FOUND,
        gameResult.message,
        payload.roomId,
      );
      return;
    }

    const applyResult = gameResult.data.applyMove({
      playerId: payload.playerId,
      move: payload.move,
    });
    if (!applyResult.ok) {
      switch (applyResult.error) {
        case GAME_ENGINE_ERRORS.NOT_PLAYER_TURN:
          sendError(
            socket,
            ERROR_CODES.WRONG_TURN_PLAYER,
            applyResult.message,
            payload.roomId,
          );
          return;
        case GAME_ENGINE_ERRORS.INVALID_MOVE:
        case GAME_ENGINE_ERRORS.INVALID_MOVE_INPUT:
          sendError(
            socket,
            ERROR_CODES.ILLEGAL_MOVE,
            applyResult.message,
            payload.roomId,
            payload.move,
          );
          return;
        case GAME_ENGINE_ERRORS.PLAYER_NOT_IN_GAME:
          sendError(
            socket,
            ERROR_CODES.SOCKET_NOT_ASSIGNED,
            applyResult.message,
            payload.roomId,
          );
          return;
        case GAME_ENGINE_ERRORS.GAME_NOT_ACTIVE:
          sendError(
            socket,
            ERROR_CODES.GAME_ALREADY_FINISHED,
            "Game has already finished",
            payload.roomId,
          );
          return;
        default:
          sendError(socket, applyResult.error, applyResult.message, payload.roomId);
          return;
      }
    }

    broadcastMoveApplied(
      payload.roomId,
      applyResult.data.by,
      applyResult.data.move,
      applyResult.data.snapshot,
    );

    if (applyResult.data.gameOver && applyResult.data.result) {
      broadcastGameOver(
        payload.roomId,
        applyResult.data.snapshot.gameId,
        applyResult.data.result,
        applyResult.data.snapshot,
      );
    }
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
      gameManager.closeGameForRoom(membership.roomId);
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

  function sendError(
    socket: WebSocket,
    code:
      | ErrorCode
      | RoomManagerErrorCode
      | GameManagerErrorCode
      | GameEngineErrorCode,
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

  function createAndBroadcastInitGame(roomId: SessionId): void {
    const roomSockets = socketsByRoom.get(roomId);
    if (!roomSockets || roomSockets.size === 0) {
      return;
    }

    const room = roomManager.getRoom(roomId);
    if (!room) {
      for (const roomSocket of roomSockets) {
        sendError(
          roomSocket,
          ROOM_MANAGER_ERRORS.ROOM_NOT_FOUND,
          `Room '${roomId}' does not exist`,
          roomId,
        );
      }
      return;
    }

    const createResult = gameManager.createGameForRoom(room);
    if (!createResult.ok) {
      const requireResult = gameManager.requireGame(roomId);
      if (!requireResult.ok) {
        for (const roomSocket of roomSockets) {
          sendError(roomSocket, createResult.error, createResult.message, roomId);
        }
        return;
      }
    }

    const requireResult = gameManager.requireGame(roomId);
    if (!requireResult.ok) {
      for (const roomSocket of roomSockets) {
        sendError(roomSocket, requireResult.error, requireResult.message, roomId);
      }
      return;
    }

    const snapshot = requireResult.data.snapshot();
    for (const roomSocket of roomSockets) {
      const membership = socketMembershipBySocket.get(roomSocket);
      if (!membership) {
        continue;
      }

      const youAre =
        membership.playerId === snapshot.players.white
          ? "white"
          : membership.playerId === snapshot.players.black
            ? "black"
            : null;
      if (!youAre) {
        continue;
      }

      const payload: InitGamePayload = {
        roomId,
        gameId: snapshot.gameId,
        youAre,
        snapshot,
      };
      send(roomSocket, {
        type: MESSAGE_TYPES.INIT_GAME,
        roomId,
        payload,
      });
    }
  }

  function broadcastMoveApplied(
    roomId: SessionId,
    by: PlayerId,
    move: MoveIntentPayload["move"],
    snapshot: InitGamePayload["snapshot"],
  ): void {
    const roomSockets = socketsByRoom.get(roomId);
    if (!roomSockets || roomSockets.size === 0) {
      return;
    }

    const payload: MoveAppliedPayload = {
      roomId,
      gameId: snapshot.gameId,
      by,
      move,
      snapshot,
    };
    for (const roomSocket of roomSockets) {
      send(roomSocket, {
        type: MESSAGE_TYPES.MOVE_APPLIED,
        roomId,
        payload,
      });
    }
  }

  function broadcastGameOver(
    roomId: SessionId,
    gameId: string,
    result: GameOverPayload["result"],
    snapshot: GameOverPayload["snapshot"],
  ): void {
    const roomSockets = socketsByRoom.get(roomId);
    if (!roomSockets || roomSockets.size === 0) {
      return;
    }

    const payload: GameOverPayload = {
      roomId,
      gameId,
      result,
      snapshot,
    };
    for (const roomSocket of roomSockets) {
      send(roomSocket, {
        type: MESSAGE_TYPES.GAME_OVER,
        roomId,
        payload,
      });
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
}
