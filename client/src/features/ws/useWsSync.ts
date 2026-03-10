import { useCallback, useMemo, useRef, useState } from "react";

import type { GameSnapshot, MoveIntent } from "../board/types";
import type { RoomSnapshot } from "../room/types";
import type {
  SyncActions,
  SyncConfig,
  SyncState,
  ClientIntentEnvelope,
} from "./types";

type ServerParticipant = {
  playerId: string;
  slot: "white" | "black" | "spectator";
  ready: boolean;
};

type ServerRoomContract = {
  sessionId: string;
  state: "waiting" | "active" | "closed";
  seats: {
    white: string | null;
    black: string | null;
  };
  spectators: string[];
  participants: ServerParticipant[];
};

type ServerMessage = {
  type: string;
  roomId?: string;
  payload?: unknown;
};

const initialState: SyncState = {
  status: "idle",
  room: null,
  game: null,
  errorMessage: null,
};

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function mapServerRoomToSnapshot(room: ServerRoomContract): RoomSnapshot {
  const whiteParticipant = room.participants.find((entry) => entry.slot === "white");
  const blackParticipant = room.participants.find((entry) => entry.slot === "black");

  return {
    roomId: room.sessionId,
    phase: room.state === "active" ? "active" : "waiting",
    white: room.seats.white
      ? {
          peerId: room.seats.white,
          isReady: Boolean(whiteParticipant?.ready),
        }
      : null,
    black: room.seats.black
      ? {
          peerId: room.seats.black,
          isReady: Boolean(blackParticipant?.ready),
        }
      : null,
    spectatorCount: room.spectators.length,
  };
}

function mapServerGameSnapshot(payload: unknown): GameSnapshot | null {
  if (!isRecord(payload)) return null;

  const snapshot = isRecord(payload.snapshot) ? payload.snapshot : null;
  if (!snapshot) return null;

  const fen = typeof snapshot.fen === "string" ? snapshot.fen : START_FEN;
  const turn = snapshot.turn === "black" ? "black" : "white";
  const status = snapshot.status === "finished" ? "finished" : "active";
  const moveCount =
    typeof snapshot.moveCount === "number" && Number.isFinite(snapshot.moveCount)
      ? snapshot.moveCount
      : 0;

  return { fen, turn, status, moveCount };
}

export function useWsSync(config: SyncConfig): SyncState & SyncActions {
  const [state, setState] = useState<SyncState>(initialState);
  const socketRef = useRef<WebSocket | null>(null);

  const sendIntent = useCallback((intent: ClientIntentEnvelope) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setState((prev) => ({
        ...prev,
        errorMessage: "Socket not connected.",
      }));
      return;
    }

    socket.send(JSON.stringify(intent));
  }, []);

  const connect = useCallback(() => {
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    setState((prev) => ({ ...prev, status: "connecting", errorMessage: null }));

    const wsUrl = import.meta.env.VITE_WS_URL ?? "ws://localhost:3000";
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      if (socketRef.current !== socket) {
        socket.close();
        return;
      }

      setState((prev) => ({ ...prev, status: "open", errorMessage: null }));

      const joinIntent: ClientIntentEnvelope = {
        type: "join_room",
        roomId: config.roomId,
        payload: {
          roomId: config.roomId,
          playerId: config.playerId,
        },
      };
      socket.send(JSON.stringify(joinIntent));
    });

    socket.addEventListener("message", (event) => {
      if (socketRef.current !== socket) {
        return;
      }

      let parsed: ServerMessage;
      try {
        parsed = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }

      if (parsed.type === "room_state") {
        const payload = parsed.payload;
        if (isRecord(payload) && "sessionId" in payload) {
          const mappedRoom = mapServerRoomToSnapshot(payload as unknown as ServerRoomContract);
          setState((prev) => ({ ...prev, room: mappedRoom, errorMessage: null }));
          return;
        }

        if (isRecord(payload) && isRecord(payload.room) && "sessionId" in payload.room) {
          const mappedRoom = mapServerRoomToSnapshot(payload.room as unknown as ServerRoomContract);
          setState((prev) => ({ ...prev, room: mappedRoom, errorMessage: null }));
          return;
        }

        if (payload === null) {
          setState((prev) => ({ ...prev, room: null }));
          return;
        }
      }

      if (parsed.type === "init_game" || parsed.type === "move_applied" || parsed.type === "game_over") {
        const mappedGame = mapServerGameSnapshot(parsed.payload);
        if (mappedGame) {
          setState((prev) => ({ ...prev, game: mappedGame, errorMessage: null }));
        }
        return;
      }

      if (parsed.type === "error") {
        const message =
          isRecord(parsed.payload) && typeof parsed.payload.message === "string"
            ? parsed.payload.message
            : "Unknown websocket error";
        setState((prev) => ({ ...prev, errorMessage: message }));
      }
    });

    socket.addEventListener("close", () => {
      if (socketRef.current === socket) {
        socketRef.current = null;
        setState((prev) => ({ ...prev, status: "closed" }));
      }
    });

    socket.addEventListener("error", () => {
      if (socketRef.current === socket) {
        setState((prev) => ({
          ...prev,
          status: "closed",
          errorMessage: "Could not connect to websocket server.",
        }));
      }
    });
  }, [config.playerId, config.roomId]);

  const disconnect = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) {
      setState((prev) => ({ ...prev, status: "closed" }));
      return;
    }

    if (socket.readyState === WebSocket.OPEN) {
      const leaveIntent: ClientIntentEnvelope = {
        type: "leave_room",
        roomId: config.roomId,
        payload: {
          roomId: config.roomId,
          playerId: config.playerId,
        },
      };
      socket.send(JSON.stringify(leaveIntent));
      socket.close();
      socketRef.current = null;
      setState((prev) => ({ ...prev, status: "closed" }));
      return;
    }

    if (socket.readyState === WebSocket.CONNECTING) {
      // In React StrictMode dev cleanup, avoid closing pre-open sockets immediately.
      socket.addEventListener(
        "open",
        () => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.close();
          }
        },
        { once: true },
      );
    } else {
      socket.close();
    }

    socketRef.current = null;
    setState((prev) => ({ ...prev, status: "closed" }));
  }, [config.playerId, config.roomId]);

  const toggleReadyIntent = useCallback(
    (roomId: string, playerId: string, ready: boolean) => {
      sendIntent({
        type: "ready",
        roomId,
        payload: {
          roomId,
          playerId,
          ready,
        },
      });
    },
    [sendIntent],
  );

  const dispatchMoveIntent = useCallback(
    (roomId: string, playerId: string, move: MoveIntent) => {
      sendIntent({
        type: "move",
        roomId,
        payload: {
          roomId,
          playerId,
          move,
        },
      });
    },
    [sendIntent],
  );

  return useMemo(
    () => ({
      ...state,
      connect,
      disconnect,
      sendIntent,
      toggleReadyIntent,
      dispatchMoveIntent,
    }),
    [state, connect, disconnect, sendIntent, toggleReadyIntent, dispatchMoveIntent],
  );
}
