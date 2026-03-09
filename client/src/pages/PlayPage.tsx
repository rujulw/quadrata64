import { useEffect } from "react";

import { DottedMap } from "../components/ui/dotted-map";
import { BoardSurface, type GameSnapshot } from "../features/board";
import { WaitingRoomPanel, type RoomSnapshot } from "../features/room";
import { useWsSync } from "../features/ws";

const DEFAULT_ROOM: RoomSnapshot = {
  roomId: "local-preview-room",
  phase: "waiting",
  white: { peerId: "peer-you", isReady: false },
  black: null,
  spectatorCount: 0,
};

const DEFAULT_GAME: GameSnapshot = {
  fen: "startpos",
  turn: "w",
  moveCount: 0,
  status: "active",
};

const CURRENT_PEER_ID = "peer-you";

export default function PlayPage() {
  const {
    room: syncedRoom,
    game: syncedGame,
    connect,
    disconnect,
    toggleReadyIntent,
  } = useWsSync();

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  const room = syncedRoom ?? DEFAULT_ROOM;
  const game = syncedGame ?? DEFAULT_GAME;

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
              onToggleReady={() => toggleReadyIntent(room.roomId, CURRENT_PEER_ID, true)}
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
