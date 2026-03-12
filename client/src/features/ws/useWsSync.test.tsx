import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useWsSync } from "./useWsSync";

type Listener = (event?: any) => void;

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readonly url: string;
  readyState = MockWebSocket.CONNECTING;
  sentMessages: string[] = [];
  private listeners = new Map<string, Set<Listener>>();

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: Listener): void {
    const set = this.listeners.get(type);
    if (!set) return;
    set.delete(listener);
  }

  send(payload: string): void {
    this.sentMessages.push(payload);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit("close");
  }

  emit(type: string, event?: any): void {
    if (type === "open") {
      this.readyState = MockWebSocket.OPEN;
    }
    if (type === "close") {
      this.readyState = MockWebSocket.CLOSED;
    }
    const set = this.listeners.get(type);
    if (!set) return;
    for (const listener of set) {
      listener(event);
    }
  }
}

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

describe("useWsSync", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    (globalThis as any).WebSocket = MockWebSocket;
  });

  afterEach(() => {
    delete (globalThis as any).WebSocket;
  });

  it("maps init_game and appends deduped move feed with SAN notation", async () => {
    const { result } = renderHook(() => useWsSync({ roomId: "room-1", playerId: "player-1" }));

    act(() => {
      result.current.connect();
    });

    const socket = MockWebSocket.instances[0];
    expect(socket).toBeDefined();

    act(() => {
      socket.emit("open");
    });

    const joinMessage = JSON.parse(socket.sentMessages[0] ?? "{}");
    expect(joinMessage.type).toBe("join_room");
    expect(joinMessage.roomId).toBe("room-1");

    act(() => {
      socket.emit("message", {
        data: JSON.stringify({
          type: "init_game",
          payload: {
            snapshot: {
              fen: START_FEN,
              turn: "white",
              status: "active",
              moveCount: 0,
              drawOfferBy: null,
              lastMove: null,
              result: null,
            },
          },
        }),
      });
    });

    await waitFor(() => {
      expect(result.current.game?.fen).toBe(START_FEN);
      expect(result.current.moveFeed).toHaveLength(0);
    });

    const moveAppliedEvent = {
      type: "move_applied",
      payload: {
        by: "player-1",
        move: { from: "e2", to: "e4" },
        snapshot: {
          fen: AFTER_E4_FEN,
          turn: "black",
          status: "active",
          moveCount: 1,
          drawOfferBy: null,
          lastMove: { from: "e2", to: "e4" },
          result: null,
        },
      },
    };

    act(() => {
      socket.emit("message", { data: JSON.stringify(moveAppliedEvent) });
      socket.emit("message", { data: JSON.stringify(moveAppliedEvent) });
    });

    await waitFor(() => {
      expect(result.current.moveFeed).toHaveLength(1);
      expect(result.current.moveFeed[0]?.notation).toBe("e4");
      expect(result.current.moveFeed[0]?.ply).toBe(1);
    });
  });

  it("maps finished game result payload", async () => {
    const { result } = renderHook(() => useWsSync({ roomId: "room-1", playerId: "player-1" }));

    act(() => {
      result.current.connect();
    });
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.emit("open");
      socket.emit("message", {
        data: JSON.stringify({
          type: "game_over",
          payload: {
            snapshot: {
              fen: "rnb1kbnr/pppp1ppp/8/4p3/6q1/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3",
              turn: "white",
              status: "finished",
              moveCount: 4,
              drawOfferBy: null,
              lastMove: { from: "d8", to: "h4" },
              result: { winnerColor: "black", reason: "checkmate" },
            },
          },
        }),
      });
    });

    await waitFor(() => {
      expect(result.current.game?.status).toBe("finished");
      expect(result.current.game?.result).toEqual({
        winnerColor: "black",
        reason: "checkmate",
      });
      expect(result.current.game?.lastMove).toEqual({ from: "d8", to: "h4", promotion: undefined });
    });
  });

  it("maps draw offer status events into game snapshot", async () => {
    const { result } = renderHook(() => useWsSync({ roomId: "room-1", playerId: "player-1" }));
    act(() => {
      result.current.connect();
    });
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.emit("open");
      socket.emit("message", {
        data: JSON.stringify({
          type: "draw_offered",
          payload: {
            snapshot: {
              fen: AFTER_E4_FEN,
              turn: "black",
              status: "active",
              moveCount: 1,
              drawOfferBy: "white",
              lastMove: { from: "e2", to: "e4" },
              result: null,
            },
          },
        }),
      });
    });

    await waitFor(() => {
      expect(result.current.game?.drawOfferBy).toBe("white");
    });
  });

  it("clears draw offer after draw_declined event", async () => {
    const { result } = renderHook(() => useWsSync({ roomId: "room-1", playerId: "player-1" }));
    act(() => {
      result.current.connect();
    });
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.emit("open");
      socket.emit("message", {
        data: JSON.stringify({
          type: "draw_offered",
          payload: {
            snapshot: {
              fen: AFTER_E4_FEN,
              turn: "black",
              status: "active",
              moveCount: 1,
              drawOfferBy: "white",
              lastMove: { from: "e2", to: "e4" },
              result: null,
            },
          },
        }),
      });
      socket.emit("message", {
        data: JSON.stringify({
          type: "draw_declined",
          payload: {
            snapshot: {
              fen: AFTER_E4_FEN,
              turn: "black",
              status: "active",
              moveCount: 1,
              drawOfferBy: null,
              lastMove: { from: "e2", to: "e4" },
              result: null,
            },
          },
        }),
      });
    });

    await waitFor(() => {
      expect(result.current.game?.drawOfferBy).toBe(null);
      expect(result.current.game?.status).toBe("active");
    });
  });

  it("maps draw result from game_over payload", async () => {
    const { result } = renderHook(() => useWsSync({ roomId: "room-1", playerId: "player-1" }));
    act(() => {
      result.current.connect();
    });
    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.emit("open");
      socket.emit("message", {
        data: JSON.stringify({
          type: "game_over",
          payload: {
            snapshot: {
              fen: AFTER_E4_FEN,
              turn: "black",
              status: "finished",
              moveCount: 8,
              drawOfferBy: null,
              lastMove: { from: "d8", to: "h4" },
              result: { winnerColor: null, reason: "draw" },
            },
          },
        }),
      });
    });

    await waitFor(() => {
      expect(result.current.game?.status).toBe("finished");
      expect(result.current.game?.result).toEqual({ winnerColor: null, reason: "draw" });
    });
  });

  it("dispatches resign and draw intents", async () => {
    const { result } = renderHook(() => useWsSync({ roomId: "room-1", playerId: "player-1" }));
    act(() => {
      result.current.connect();
    });
    const socket = MockWebSocket.instances[0];
    act(() => {
      socket.emit("open");
    });

    act(() => {
      result.current.dispatchResignIntent("room-1", "player-1");
      result.current.dispatchDrawOfferIntent("room-1", "player-1");
      result.current.dispatchDrawAcceptIntent("room-1", "player-1");
      result.current.dispatchDrawDeclineIntent("room-1", "player-1");
    });

    const sentTypes = socket.sentMessages.map((payload) => JSON.parse(payload).type);
    expect(sentTypes).toContain("resign");
    expect(sentTypes).toContain("draw_offer");
    expect(sentTypes).toContain("draw_accept");
    expect(sentTypes).toContain("draw_decline");
  });
});
