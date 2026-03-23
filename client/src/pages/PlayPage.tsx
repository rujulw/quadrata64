import { useEffect, useRef, useState } from "react";

import { DottedMap } from "../components/ui/dotted-map";
import { BoardSurface, type GameSnapshot } from "../features/board";
import { WaitingRoomPanel, type RoomSnapshot } from "../features/room";
import { useWsSync } from "../features/ws";

const DEFAULT_ROOM: RoomSnapshot = {
  roomId: "lobby-main",
  phase: "waiting",
  timeControl: "rapid",
  white: null,
  black: null,
  spectatorCount: 0,
};

const DEFAULT_GAME: GameSnapshot = {
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  turn: "white",
  moveCount: 0,
  timeControl: {
    id: "rapid",
    initialMs: 180_000,
    incrementMs: 0,
  },
  timer: {
    whiteMs: 180_000,
    blackMs: 180_000,
    runningFor: "white",
    updatedAt: 0,
  },
  status: "active",
  drawOfferBy: null,
  lastMove: null,
  result: null,
};

const MATCH_WARMUP_MS = 1400;
const CLOCK_TICK_MS = 100;

function initialMsForControl(control: RoomSnapshot["timeControl"]): number {
  if (control === "bullet") return 60_000;
  if (control === "traditional") return 10 * 60_000;
  return 3 * 60_000;
}

function formatResultLabel(game: GameSnapshot): string | null {
  if (game.status !== "finished" || !game.result) {
    return null;
  }

  const winner = game.result.winnerColor ? `${game.result.winnerColor} wins` : "draw";
  return `${winner} - ${game.result.reason.replace(/_/g, " ")}`;
}

function getTabPlayerId(): string {
  if (typeof window === "undefined") {
    return "peer-server";
  }

  const existing = window.sessionStorage.getItem("quadrata64:peerId");
  if (existing) return existing;

  const created = `peer-${Math.random().toString(36).slice(2, 8)}`;
  window.sessionStorage.setItem("quadrata64:peerId", created);
  return created;
}

export default function PlayPage() {
  const [playerId] = useState<string>(getTabPlayerId);
  const [selectedTimeControl, setSelectedTimeControl] = useState<RoomSnapshot["timeControl"]>(
    DEFAULT_ROOM.timeControl,
  );
  const [isMatchWarmup, setIsMatchWarmup] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const warmupTimeoutRef = useRef<number | null>(null);
  const roomId = DEFAULT_ROOM.roomId;

  const {
    room: syncedRoom,
    game: syncedGame,
    moveFeed,
    connect,
    disconnect,
    toggleReadyIntent,
    dispatchMoveIntent,
    dispatchResignIntent,
    dispatchDrawOfferIntent,
    dispatchDrawAcceptIntent,
    dispatchDrawDeclineIntent,
  } = useWsSync({ roomId, playerId });

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  const room = syncedRoom ?? DEFAULT_ROOM;
  const game = syncedGame ?? DEFAULT_GAME;

  useEffect(() => {
    setSelectedTimeControl(room.timeControl);
  }, [room.timeControl]);

  const currentSeat =
    room.white?.peerId === playerId
      ? room.white
      : room.black?.peerId === playerId
        ? room.black
        : null;
  const currentPlayerColor =
    room.white?.peerId === playerId
      ? "white"
      : room.black?.peerId === playerId
        ? "black"
        : null;
  const orientation = currentPlayerColor === "black" ? "black" : "white";

  const isReady = Boolean(currentSeat?.isReady);
  const canReady = Boolean(currentSeat);
  const isMatching = (isReady && room.phase === "waiting") || isMatchWarmup;
  const terminalResultLabel = formatResultLabel(game);
  const isLiveGame = room.phase === "active" && syncedGame !== null;

  useEffect(() => {
    if (!isLiveGame || game.status !== "active" || game.timer.runningFor === null) {
      return;
    }
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, CLOCK_TICK_MS);
    return () => {
      window.clearInterval(interval);
    };
  }, [isLiveGame, game.status, game.timer.runningFor]);

  const clockState = (() => {
    if (!isLiveGame) {
      const initialMs = initialMsForControl(selectedTimeControl);
      return {
        whiteMs: initialMs,
        blackMs: initialMs,
        runningFor: null as GameSnapshot["timer"]["runningFor"],
      };
    }

    const timer = game.timer;
    if (game.status !== "active" || timer.runningFor === null) {
      return {
        whiteMs: timer.whiteMs,
        blackMs: timer.blackMs,
        runningFor: timer.runningFor,
      };
    }

    const elapsedMs = Math.max(0, nowMs - timer.updatedAt);
    if (timer.runningFor === "white") {
      return {
        whiteMs: Math.max(0, timer.whiteMs - elapsedMs),
        blackMs: timer.blackMs,
        runningFor: timer.runningFor,
      };
    }
    return {
      whiteMs: timer.whiteMs,
      blackMs: Math.max(0, timer.blackMs - elapsedMs),
      runningFor: timer.runningFor,
    };
  })();

  const timeoutColor =
    room.phase === "active" && game.status === "active"
      ? clockState.whiteMs <= 0
        ? "white"
        : clockState.blackMs <= 0
          ? "black"
          : null
      : null;
  const canGameActions =
    Boolean(currentSeat) && room.phase === "active" && game.status === "active" && !timeoutColor;
  const canOfferDraw = canGameActions && !game.drawOfferBy;
  const canRespondToDraw =
    canGameActions && Boolean(game.drawOfferBy) && game.drawOfferBy !== currentPlayerColor;
  const drawOfferLabel = game.drawOfferBy ? `${game.drawOfferBy} offered draw` : null;

  useEffect(() => {
    return () => {
      if (warmupTimeoutRef.current !== null) {
        window.clearTimeout(warmupTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if ((isReady && room.phase === "waiting") || room.phase === "active") {
      if (warmupTimeoutRef.current !== null) {
        window.clearTimeout(warmupTimeoutRef.current);
        warmupTimeoutRef.current = null;
      }
      setIsMatchWarmup(false);
    }
  }, [isReady, room.phase]);

  const handleToggleReady = (timeControl: RoomSnapshot["timeControl"]) => {
    if (!canReady) {
      return;
    }

    if (isReady) {
      if (warmupTimeoutRef.current !== null) {
        window.clearTimeout(warmupTimeoutRef.current);
        warmupTimeoutRef.current = null;
      }
      setIsMatchWarmup(false);
      toggleReadyIntent(room.roomId, playerId, false);
      return;
    }

    if (isMatchWarmup) {
      if (warmupTimeoutRef.current !== null) {
        window.clearTimeout(warmupTimeoutRef.current);
        warmupTimeoutRef.current = null;
      } else {
        // Warmup finished and ready intent already sent; allow user to cancel queue immediately.
        toggleReadyIntent(room.roomId, playerId, false);
      }
      setIsMatchWarmup(false);
      return;
    }

    setIsMatchWarmup(true);
    warmupTimeoutRef.current = window.setTimeout(() => {
      toggleReadyIntent(room.roomId, playerId, true, timeControl);
      warmupTimeoutRef.current = null;
    }, MATCH_WARMUP_MS);
  };

  return (
    <section className="relative min-h-screen overflow-hidden">
      <DottedMap
        className="pointer-events-none absolute inset-0 text-[#d5d8df] opacity-45 blur-[1px] mask-[radial-gradient(circle_at_50%_40%,white_30%,transparent_82%)]"
        markers={[]}
        dotRadius={0.18}
      />

      <div className="relative mx-auto w-full max-w-365 px-6 py-6 sm:px-8 lg:px-12">
        <div className="grid min-h-[78vh] gap-4 lg:h-[calc(100vh-165px)] lg:grid-cols-[minmax(320px,40%)_minmax(0,60%)] lg:items-stretch lg:gap-4">
          <div className="h-full">
            <WaitingRoomPanel
              isMatching={isMatching}
              isReady={isReady}
              canReady={canReady}
              roomPhase={room.phase}
              gameTurn={game.turn}
              gameStatus={game.status}
              terminalResultLabel={terminalResultLabel}
              moveFeed={moveFeed}
              drawOfferLabel={drawOfferLabel}
              canResign={canGameActions}
              canOfferDraw={canOfferDraw}
              canAcceptDraw={canRespondToDraw}
              canDeclineDraw={canRespondToDraw}
              selectedTimeControl={selectedTimeControl}
              whiteClockMs={clockState.whiteMs}
              blackClockMs={clockState.blackMs}
              runningClock={clockState.runningFor}
              timeoutColor={timeoutColor}
              onTimeControlChange={setSelectedTimeControl}
              onToggleReady={handleToggleReady}
              onResign={() => dispatchResignIntent(room.roomId, playerId)}
              onOfferDraw={() => dispatchDrawOfferIntent(room.roomId, playerId)}
              onAcceptDraw={() => dispatchDrawAcceptIntent(room.roomId, playerId)}
              onDeclineDraw={() => dispatchDrawDeclineIntent(room.roomId, playerId)}
            />
          </div>

          <div className="flex h-full w-full items-start justify-center">
            <BoardSurface
              snapshot={game}
              orientation={orientation}
              playerColor={timeoutColor ? null : currentPlayerColor}
              onMoveIntent={(move) => dispatchMoveIntent(room.roomId, playerId, move)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
