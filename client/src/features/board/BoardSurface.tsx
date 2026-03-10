import type { BoardOrientation, GameSnapshot } from "./types";

type BoardSurfaceProps = {
  snapshot: GameSnapshot;
  orientation: BoardOrientation;
};

const BOARD_SIZE = 64;

export function BoardSurface({ orientation }: BoardSurfaceProps) {
  const cells = Array.from({ length: BOARD_SIZE }, (_, index) => {
    const boardIndex = orientation === "white" ? index : BOARD_SIZE - 1 - index;
    const row = Math.floor(boardIndex / 8);
    const col = boardIndex % 8;
    const isLight = (row + col) % 2 === 0;

    return (
      <div
        key={index}
        className={isLight ? "aspect-square bg-neutral-200" : "aspect-square bg-board-dark"}
      />
    );
  });

  return (
    <section className="w-fit">
      <div
        className="aspect-square"
        style={{
          width: "min(clamp(320px, calc(100vw - 500px), 1020px), calc(100vh - 165px))",
        }}
      >
        <div className="grid h-full w-full grid-cols-8 overflow-hidden rounded-lg border border-white/10">
          {cells}
        </div>
      </div>
    </section>
  );
}
