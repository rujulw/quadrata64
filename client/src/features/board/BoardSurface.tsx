import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";

import type { BoardOrientation, GameSnapshot, MoveIntent, PlayerColor } from "./types";

type BoardSurfaceProps = {
  snapshot: GameSnapshot;
  orientation: BoardOrientation;
  playerColor: PlayerColor | null;
  onMoveIntent: (move: MoveIntent) => void;
};

const BOARD_SIZE = 64;
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

type BoardPiece = {
  color: "w" | "b";
  type: "p" | "n" | "b" | "r" | "q" | "k";
};

const PIECE_SYMBOLS: Record<`${BoardPiece["color"]}${BoardPiece["type"]}`, string> = {
  wp: "/piece/cburnett/wP.svg",
  wn: "/piece/cburnett/wN.svg",
  wb: "/piece/cburnett/wB.svg",
  wr: "/piece/cburnett/wR.svg",
  wq: "/piece/cburnett/wQ.svg",
  wk: "/piece/cburnett/wK.svg",
  bp: "/piece/cburnett/bP.svg",
  bn: "/piece/cburnett/bN.svg",
  bb: "/piece/cburnett/bB.svg",
  br: "/piece/cburnett/bR.svg",
  bq: "/piece/cburnett/bQ.svg",
  bk: "/piece/cburnett/bK.svg",
};

function squareFromDisplayIndex(index: number, orientation: BoardOrientation): string {
  const row = Math.floor(index / 8);
  const col = index % 8;

  const fileIndex = orientation === "white" ? col : 7 - col;
  const rank = orientation === "white" ? 8 - row : row + 1;
  return `${FILES[fileIndex]}${rank}`;
}

function parseBoardPieces(fen: string): Record<string, BoardPiece> {
  const chess = new Chess();
  try {
    chess.load(fen);
  } catch {
    return {};
  }

  const board = chess.board();
  const pieceBySquare: Record<string, BoardPiece> = {};
  for (let row = 0; row < board.length; row += 1) {
    const rank = 8 - row;
    for (let col = 0; col < board[row].length; col += 1) {
      const piece = board[row][col];
      if (!piece) continue;

      const square = `${FILES[col]}${rank}`;
      pieceBySquare[square] = {
        color: piece.color,
        type: piece.type,
      };
    }
  }

  return pieceBySquare;
}

function deriveLegalTargets(fen: string, fromSquare: string | null): Set<string> {
  if (!fromSquare) return new Set();

  const chess = new Chess();
  try {
    chess.load(fen);
  } catch {
    return new Set();
  }

  const moves = chess.moves({ square: fromSquare as any, verbose: true }) as Array<{
    to: string;
  }>;
  return new Set(moves.map((move) => move.to));
}

export function BoardSurface({ snapshot, orientation, playerColor, onMoveIntent }: BoardSurfaceProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSquare(null);
  }, [snapshot.fen]);

  const pieces = useMemo(() => parseBoardPieces(snapshot.fen), [snapshot.fen]);
  const legalTargets = useMemo(
    () => deriveLegalTargets(snapshot.fen, selectedSquare),
    [snapshot.fen, selectedSquare],
  );
  const canInteract =
    snapshot.status === "active" && Boolean(playerColor) && snapshot.turn === playerColor;

  const cells = Array.from({ length: BOARD_SIZE }, (_, index) => {
    const row = Math.floor(index / 8);
    const col = index % 8;
    const isLight = (row + col) % 2 === 1;
    const square = squareFromDisplayIndex(index, orientation);
    const piece = pieces[square];
    const isSelected = selectedSquare === square;
    const isLegalTarget = legalTargets.has(square);

    const handleClick = () => {
      if (!canInteract || !playerColor) {
        setSelectedSquare(null);
        return;
      }

      if (selectedSquare && isLegalTarget) {
        const selectedPiece = pieces[selectedSquare];
        const reachesBackRank =
          selectedPiece?.type === "p" && (square.endsWith("1") || square.endsWith("8"));
        onMoveIntent({
          from: selectedSquare,
          to: square,
          promotion: reachesBackRank ? "q" : undefined,
        });
        setSelectedSquare(null);
        return;
      }

      const ownedColor = playerColor === "white" ? "w" : "b";
      if (piece && piece.color === ownedColor) {
        setSelectedSquare(square);
        return;
      }

      setSelectedSquare(null);
    };

    return (
      <button
        key={square}
        type="button"
        data-square={square}
        aria-label={square}
        onClick={handleClick}
        className={[
          "relative aspect-square",
          isLight ? "bg-neutral-200" : "bg-board-dark",
          isSelected ? "outline-2 outline-offset-[-2px] outline-app-purple-strong" : "",
          canInteract ? "cursor-pointer" : "cursor-default",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {piece ? (
          <span className="pointer-events-none absolute inset-0 grid place-items-center p-[6%]">
            <img
              src={PIECE_SYMBOLS[`${piece.color}${piece.type}`]}
              alt={`${piece.color === "w" ? "white" : "black"} ${piece.type}`}
              className="h-full w-full select-none object-contain"
              draggable={false}
            />
          </span>
        ) : null}

        {!piece && isLegalTarget ? (
          <span className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="h-3.5 w-3.5 rounded-full bg-app-purple-soft/70" />
          </span>
        ) : null}
      </button>
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
