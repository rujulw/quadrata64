import { useEffect, useState } from "react";

import { DottedMap } from "../components/ui/dotted-map";
import { BoardSurface, type GameSnapshot } from "../features/board";
import { WaitingRoomPanel, type RoomSnapshot } from "../features/room";
import { useWsSync } from "../features/ws";

const DEFAULT_ROOM: RoomSnapshot = {
  roomId: "lobby-main",
  phase: "waiting",
  white: null,
  black: null,
  spectatorCount: 0,
};

const DEFAULT_GAME: GameSnapshot = {
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  turn: "white",
  moveCount: 0,
  status: "active",
  drawOfferBy: null,
  lastMove: null,
  result: null,
};

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
  const isMatching = isReady && room.phase === "waiting";
  const terminalResultLabel = formatResultLabel(game);
  const canGameActions = Boolean(currentSeat) && room.phase === "active" && game.status === "active";
  const canOfferDraw = canGameActions && !game.drawOfferBy;
  const canRespondToDraw =
    canGameActions && Boolean(game.drawOfferBy) && game.drawOfferBy !== currentPlayerColor;
  const drawOfferLabel = game.drawOfferBy ? `${game.drawOfferBy} offered draw` : null;

  return (
    <section className="relative min-h-screen overflow-hidden">
      <DottedMap
        className="pointer-events-none absolute inset-0 text-[#d5d8df] opacity-45 blur-[1px] mask-[radial-gradient(circle_at_50%_40%,white_30%,transparent_82%)]"
        markers={[]}
        dotRadius={0.18}
      />

      <div className="relative mx-auto w-full max-w-365 px-6 py-6 sm:px-8 lg:px-12">
        <div className="grid min-h-[78vh] gap-4 lg:grid-cols-[minmax(320px,40%)_minmax(0,60%)] lg:items-stretch lg:gap-4">
          <div className="lg:h-full">
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
              onToggleReady={() => toggleReadyIntent(room.roomId, playerId, !isReady)}
              onResign={() => dispatchResignIntent(room.roomId, playerId)}
              onOfferDraw={() => dispatchDrawOfferIntent(room.roomId, playerId)}
              onAcceptDraw={() => dispatchDrawAcceptIntent(room.roomId, playerId)}
              onDeclineDraw={() => dispatchDrawDeclineIntent(room.roomId, playerId)}
            />
          </div>

          <div className="flex w-full items-start justify-center">
            <BoardSurface
              snapshot={game}
              orientation={orientation}
              playerColor={currentPlayerColor}
              onMoveIntent={(move) => dispatchMoveIntent(room.roomId, playerId, move)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
