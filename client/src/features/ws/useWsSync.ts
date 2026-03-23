import { useCallback, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";

import type { GameSnapshot, MoveFeedEntry, MoveIntent } from "../board/types";
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
  timeControl?: "bullet" | "rapid" | "traditional";
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
  moveFeed: [],
  errorMessage: null,
};

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPromotionPiece(value: unknown): value is MoveIntent["promotion"] {
  return value === "q" || value === "r" || value === "b" || value === "n";
}

function isPlayerColor(value: unknown): value is "white" | "black" {
  return value === "white" || value === "black";
}

function isTimeControlId(value: unknown): value is GameSnapshot["timeControl"]["id"] {
  return value === "bullet" || value === "rapid" || value === "traditional";
}

function isResultReason(value: unknown): value is NonNullable<GameSnapshot["result"]>["reason"] {
  return (
    value === "checkmate" ||
    value === "stalemate" ||
    value === "insufficient_material" ||
    value === "threefold_repetition" ||
    value === "fifty_move_rule" ||
    value === "draw" ||
    value === "resign" ||
    value === "timeout" ||
    value === "unknown"
  );
}

function mapServerRoomToSnapshot(room: ServerRoomContract): RoomSnapshot {
  const whiteParticipant = room.participants.find((entry) => entry.slot === "white");
  const blackParticipant = room.participants.find((entry) => entry.slot === "black");

  return {
    roomId: room.sessionId,
    phase: room.state === "active" ? "active" : "waiting",
    timeControl: room.timeControl ?? "rapid",
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

function projectTimerFromPrevious(
  previous: GameSnapshot["timer"],
  nextRunningFor: GameSnapshot["turn"],
): GameSnapshot["timer"] {
  const now = Date.now();
  const elapsedMs = Math.max(0, now - previous.updatedAt);
  const whiteMs =
    previous.runningFor === "white" ? Math.max(0, previous.whiteMs - elapsedMs) : previous.whiteMs;
  const blackMs =
    previous.runningFor === "black" ? Math.max(0, previous.blackMs - elapsedMs) : previous.blackMs;

  return {
    whiteMs,
    blackMs,
    runningFor: nextRunningFor,
    updatedAt: now,
  };
}

function mapServerGameSnapshot(payload: unknown, previousGame: GameSnapshot | null): GameSnapshot | null {
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
  const lastMove =
    isRecord(snapshot.lastMove) &&
    typeof snapshot.lastMove.from === "string" &&
    typeof snapshot.lastMove.to === "string"
      ? {
          from: snapshot.lastMove.from,
          to: snapshot.lastMove.to,
          promotion: isPromotionPiece(snapshot.lastMove.promotion)
            ? snapshot.lastMove.promotion
            : undefined,
        }
      : null;
  const result =
    isRecord(snapshot.result) &&
    (isPlayerColor(snapshot.result.winnerColor) || snapshot.result.winnerColor === null) &&
    isResultReason(snapshot.result.reason)
      ? {
          winnerColor: snapshot.result.winnerColor,
          reason: snapshot.result.reason,
        }
      : null;
  const drawOfferBy =
    snapshot.drawOfferBy === null || isPlayerColor(snapshot.drawOfferBy) ? snapshot.drawOfferBy : null;

  const timeControl: GameSnapshot["timeControl"] =
    isRecord(snapshot.timeControl) && isTimeControlId(snapshot.timeControl.id)
      ? {
          id: snapshot.timeControl.id,
          initialMs:
            typeof snapshot.timeControl.initialMs === "number" &&
            Number.isFinite(snapshot.timeControl.initialMs)
              ? snapshot.timeControl.initialMs
              : 180_000,
          incrementMs:
            typeof snapshot.timeControl.incrementMs === "number" &&
            Number.isFinite(snapshot.timeControl.incrementMs)
              ? snapshot.timeControl.incrementMs
              : 0,
        }
      : previousGame?.timeControl ?? {
          id: "rapid" as const,
          initialMs: 180_000,
          incrementMs: 0,
        };

  const timer: GameSnapshot["timer"] =
    isRecord(snapshot.timer) &&
    (snapshot.timer.runningFor === null || isPlayerColor(snapshot.timer.runningFor))
      ? {
          whiteMs:
            typeof snapshot.timer.whiteMs === "number" && Number.isFinite(snapshot.timer.whiteMs)
              ? snapshot.timer.whiteMs
              : timeControl.initialMs,
          blackMs:
            typeof snapshot.timer.blackMs === "number" && Number.isFinite(snapshot.timer.blackMs)
              ? snapshot.timer.blackMs
              : timeControl.initialMs,
          runningFor: snapshot.timer.runningFor === null ? null : snapshot.timer.runningFor,
          updatedAt:
            typeof snapshot.timer.updatedAt === "number" && Number.isFinite(snapshot.timer.updatedAt)
              ? snapshot.timer.updatedAt
              : Date.now(),
        }
      : previousGame
        ? projectTimerFromPrevious(previousGame.timer, turn)
        : {
            whiteMs: timeControl.initialMs,
            blackMs: timeControl.initialMs,
            runningFor: turn,
            updatedAt: Date.now(),
          };

  return { fen, turn, status, moveCount, timeControl, timer, drawOfferBy, lastMove, result };
}

function mapMoveFeedEntry(payload: unknown, sanNotation?: string | null): MoveFeedEntry | null {
  if (!isRecord(payload)) return null;
  const move = isRecord(payload.move) ? payload.move : null;
  if (!move) return null;

  const from = typeof move.from === "string" ? move.from : null;
  const to = typeof move.to === "string" ? move.to : null;
  if (!from || !to) return null;

  const by = typeof payload.by === "string" ? payload.by : "unknown";
  const snapshot = isRecord(payload.snapshot) ? payload.snapshot : null;
  const ply =
    snapshot && typeof snapshot.moveCount === "number" && Number.isFinite(snapshot.moveCount)
      ? snapshot.moveCount
      : 0;
  const promotion =
    move.promotion === "q" || move.promotion === "r" || move.promotion === "b" || move.promotion === "n";
  const notation = sanNotation ?? `${to}${promotion ? `=${move.promotion}` : ""}`;
  return {
    id: `${ply}:${by}:${from}${to}${promotion ? `=${move.promotion}` : ""}`,
    ply,
    by,
    notation,
  };
}

export function useWsSync(config: SyncConfig): SyncState & SyncActions {
  const [state, setState] = useState<SyncState>(initialState);
  const socketRef = useRef<WebSocket | null>(null);
  const feedChessRef = useRef<Chess | null>(null);

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

      if (
        parsed.type === "init_game" ||
        parsed.type === "move_applied" ||
        parsed.type === "game_over" ||
        parsed.type === "draw_offered" ||
        parsed.type === "draw_declined"
      ) {
        setState((prev) => {
          const mappedGame = mapServerGameSnapshot(parsed.payload, prev.game);
          if (!mappedGame) {
            return prev;
          }

          if (parsed.type === "init_game") {
            const feedChess = new Chess();
            try {
              feedChess.load(mappedGame.fen);
              feedChessRef.current = feedChess;
            } catch {
              feedChessRef.current = null;
            }
          }

          return {
            ...prev,
            game: mappedGame,
            moveFeed: parsed.type === "init_game" ? [] : prev.moveFeed,
            errorMessage: null,
          };
        });

        if (parsed.type === "move_applied") {
          let sanNotation: string | null = null;
          const payload = isRecord(parsed.payload) ? parsed.payload : null;
          const move = payload && isRecord(payload.move) ? payload.move : null;
          if (feedChessRef.current && move) {
            try {
              const appliedMove = feedChessRef.current.move({
                from: move.from as string,
                to: move.to as string,
                promotion: isPromotionPiece(move.promotion) ? move.promotion : undefined,
              });
              sanNotation = typeof appliedMove?.san === "string" ? appliedMove.san : null;
            } catch {
              sanNotation = null;
            }
          }

          const nextMove = mapMoveFeedEntry(parsed.payload, sanNotation);
          if (nextMove) {
            setState((prev) => {
              if (prev.moveFeed.some((entry) => entry.id === nextMove.id)) {
                return prev;
              }

              const nextFeed = [...prev.moveFeed, nextMove].slice(-16);
              return { ...prev, moveFeed: nextFeed };
            });
          }
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
      feedChessRef.current = null;
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
      feedChessRef.current = null;
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
    feedChessRef.current = null;
    setState((prev) => ({ ...prev, status: "closed" }));
  }, [config.playerId, config.roomId]);

  const toggleReadyIntent = useCallback(
    (
      roomId: string,
      playerId: string,
      ready: boolean,
      timeControl?: "bullet" | "rapid" | "traditional",
    ) => {
      sendIntent({
        type: "ready",
        roomId,
        payload: {
          roomId,
          playerId,
          ready,
          ...(timeControl ? { timeControl } : {}),
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

  const dispatchResignIntent = useCallback(
    (roomId: string, playerId: string) => {
      sendIntent({
        type: "resign",
        roomId,
        payload: {
          roomId,
          playerId,
        },
      });
    },
    [sendIntent],
  );

  const dispatchDrawOfferIntent = useCallback(
    (roomId: string, playerId: string) => {
      sendIntent({
        type: "draw_offer",
        roomId,
        payload: {
          roomId,
          playerId,
        },
      });
    },
    [sendIntent],
  );

  const dispatchDrawAcceptIntent = useCallback(
    (roomId: string, playerId: string) => {
      sendIntent({
        type: "draw_accept",
        roomId,
        payload: {
          roomId,
          playerId,
        },
      });
    },
    [sendIntent],
  );

  const dispatchDrawDeclineIntent = useCallback(
    (roomId: string, playerId: string) => {
      sendIntent({
        type: "draw_decline",
        roomId,
        payload: {
          roomId,
          playerId,
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
      dispatchResignIntent,
      dispatchDrawOfferIntent,
      dispatchDrawAcceptIntent,
      dispatchDrawDeclineIntent,
    }),
    [
      state,
      connect,
      disconnect,
      sendIntent,
      toggleReadyIntent,
      dispatchMoveIntent,
      dispatchResignIntent,
      dispatchDrawOfferIntent,
      dispatchDrawAcceptIntent,
      dispatchDrawDeclineIntent,
    ],
  );
}
