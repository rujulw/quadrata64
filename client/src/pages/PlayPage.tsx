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
  fen: "startpos",
  turn: "w",
  moveCount: 0,
  status: "active",
};

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
    connect,
    disconnect,
    toggleReadyIntent,
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

  const isReady = Boolean(currentSeat?.isReady);
  const canReady = Boolean(currentSeat);
  const isMatching = isReady && room.phase === "waiting";

  return (
    <section className="relative min-h-screen overflow-hidden">
      <DottedMap
        className="pointer-events-none absolute inset-0 text-[#d5d8df] opacity-45 blur-[1px] mask-[radial-gradient(circle_at_50%_40%,white_30%,transparent_82%)]"
        markers={[]}
        dotRadius={0.18}
      />

      <div className="relative mx-auto w-full max-w-365 px-6 py-6 sm:px-8 lg:px-12">
        <div className="grid min-h-[78vh] gap-4 lg:mx-auto lg:w-fit lg:grid-cols-[410px_1fr] lg:items-start lg:gap-3">
          <div className="lg:self-stretch">
            <WaitingRoomPanel
              isMatching={isMatching}
              isReady={isReady}
              canReady={canReady}
              roomPhase={room.phase}
              onToggleReady={() => toggleReadyIntent(room.roomId, playerId, !isReady)}
            />
          </div>

          <div className="flex w-full justify-start">
            <BoardSurface snapshot={game} orientation="white" />
          </div>
        </div>
      </div>
    </section>
  );
}
