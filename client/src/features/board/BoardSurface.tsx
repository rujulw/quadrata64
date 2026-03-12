import { useEffect, useMemo, useRef, useState } from "react";
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

function isLightSquare(square: string): boolean {
  const file = square[0];
  const rankChar = square[1];
  const fileIndex = FILES.indexOf(file as (typeof FILES)[number]);
  const rank = Number(rankChar);
  if (fileIndex < 0 || Number.isNaN(rank)) {
    return false;
  }

  const fileNumber = fileIndex + 1;
  return (fileNumber + rank) % 2 === 1;
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

  const moves = chess.moves({ square: fromSquare as any, verbose: true }) as Array<{ to: string }>;
  return new Set(moves.map((move) => move.to));
}

export function BoardSurface({ snapshot, orientation, playerColor, onMoveIntent }: BoardSurfaceProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [draggedSquare, setDraggedSquare] = useState<string | null>(null);
  const [hoveredDropSquare, setHoveredDropSquare] = useState<string | null>(null);
  const [dragPointer, setDragPointer] = useState<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const dropHandledRef = useRef(false);
  const draggedSquareRef = useRef<string | null>(null);
  const hoveredDropSquareRef = useRef<string | null>(null);
  const legalTargetsRef = useRef<Set<string>>(new Set());
  const optimisticResetTimeoutRef = useRef<number | null>(null);
  const [optimisticMove, setOptimisticMove] = useState<{ from: string; to: string; piece: BoardPiece } | null>(null);

  useEffect(() => {
    setSelectedSquare(null);
    setDraggedSquare(null);
    setHoveredDropSquare(null);
    setDragPointer(null);
    setOptimisticMove(null);
    if (optimisticResetTimeoutRef.current !== null) {
      window.clearTimeout(optimisticResetTimeoutRef.current);
      optimisticResetTimeoutRef.current = null;
    }
    suppressClickRef.current = false;
    dropHandledRef.current = false;
  }, [snapshot.fen]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (draggedSquare) {
      document.body.classList.add("is-piece-dragging");
    } else {
      document.body.classList.remove("is-piece-dragging");
    }

    return () => {
      document.body.classList.remove("is-piece-dragging");
    };
  }, [draggedSquare]);

  useEffect(() => {
    return () => {
      if (optimisticResetTimeoutRef.current !== null) {
        window.clearTimeout(optimisticResetTimeoutRef.current);
      }
    };
  }, []);

  const snapshotPieces = useMemo(() => parseBoardPieces(snapshot.fen), [snapshot.fen]);
  const pieces = useMemo(() => {
    if (!optimisticMove) {
      return snapshotPieces;
    }

    const projected = { ...snapshotPieces };
    delete projected[optimisticMove.from];
    projected[optimisticMove.to] = optimisticMove.piece;
    return projected;
  }, [optimisticMove, snapshotPieces]);
  const moveSourceSquare = draggedSquare ?? selectedSquare;
  const legalTargets = useMemo(
    () => deriveLegalTargets(snapshot.fen, moveSourceSquare),
    [snapshot.fen, moveSourceSquare],
  );
  const canInteract = snapshot.status === "active" && Boolean(playerColor) && snapshot.turn === playerColor;
  const ownedColor = playerColor === "white" ? "w" : "b";
  const draggedPiece = draggedSquare ? pieces[draggedSquare] : null;

  useEffect(() => {
    draggedSquareRef.current = draggedSquare;
  }, [draggedSquare]);

  useEffect(() => {
    hoveredDropSquareRef.current = hoveredDropSquare;
  }, [hoveredDropSquare]);

  useEffect(() => {
    legalTargetsRef.current = legalTargets;
  }, [legalTargets]);

  const dispatchMove = (from: string, to: string) => {
    const selectedPiece = snapshotPieces[from];
    if (!selectedPiece) {
      return;
    }
    const reachesBackRank = selectedPiece.type === "p" && (to.endsWith("1") || to.endsWith("8"));
    const projectedPiece = reachesBackRank ? { ...selectedPiece, type: "q" as const } : selectedPiece;
    setOptimisticMove({ from, to, piece: projectedPiece });
    if (optimisticResetTimeoutRef.current !== null) {
      window.clearTimeout(optimisticResetTimeoutRef.current);
    }
    optimisticResetTimeoutRef.current = window.setTimeout(() => {
      setOptimisticMove(null);
      optimisticResetTimeoutRef.current = null;
    }, 1200);
    onMoveIntent({ from, to, promotion: reachesBackRank ? "q" : undefined });
  };

  const finalizeDrag = (dropSquare: string | null) => {
    const sourceSquare = draggedSquareRef.current;
    const currentLegalTargets = legalTargetsRef.current;
    if (sourceSquare && dropSquare && currentLegalTargets.has(dropSquare) && !dropHandledRef.current) {
      dropHandledRef.current = true;
      dispatchMove(sourceSquare, dropSquare);
      setSelectedSquare(null);
    }

    setDraggedSquare(null);
    setHoveredDropSquare(null);
    setDragPointer(null);
    draggedSquareRef.current = null;
    hoveredDropSquareRef.current = null;
    window.setTimeout(() => {
      suppressClickRef.current = false;
      dropHandledRef.current = false;
    }, 0);
  };

  const getSquareAtPoint = (event: MouseEvent): string | null => {
    const target = event.target;
    if (target instanceof Element) {
      const fromTarget = target.closest("[data-square]") as HTMLElement | null;
      if (fromTarget?.dataset.square) {
        return fromTarget.dataset.square;
      }
    }

    if (
      typeof document === "undefined" ||
      typeof document.elementFromPoint !== "function"
    ) {
      return null;
    }

    const squareElement = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-square]") as
      | HTMLElement
      | null;
    return squareElement?.dataset.square ?? null;
  };

  useEffect(() => {
    if (!draggedSquare || typeof window === "undefined") {
      return;
    }

    const handleWindowMouseMove = (event: MouseEvent) => {
      setDragPointer({ x: event.clientX, y: event.clientY });
      const hoveredSquare = getSquareAtPoint(event);
      if (hoveredSquare && legalTargets.has(hoveredSquare)) {
        hoveredDropSquareRef.current = hoveredSquare;
        setHoveredDropSquare(hoveredSquare);
      } else {
        hoveredDropSquareRef.current = null;
        setHoveredDropSquare(null);
      }
    };

    const handleWindowMouseUp = (event: MouseEvent) => {
      const dropSquare = getSquareAtPoint(event) ?? hoveredDropSquareRef.current;
      finalizeDrag(dropSquare);
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [draggedSquare, legalTargets, hoveredDropSquare]);

  const cells = Array.from({ length: BOARD_SIZE }, (_, index) => {
    const square = squareFromDisplayIndex(index, orientation);
    const isLight = isLightSquare(square);
    const piece = pieces[square];
    const isSelected = selectedSquare === square;
    const isLegalTarget = legalTargets.has(square);
    const isHoveredLegalTarget = hoveredDropSquare === square && Boolean(draggedSquare) && isLegalTarget;
    const isOwnedPiece = Boolean(piece && piece.color === ownedColor);

    const handleClick = () => {
      if (suppressClickRef.current) {
        return;
      }

      if (!canInteract || !playerColor) {
        setSelectedSquare(null);
        return;
      }

      if (selectedSquare && isLegalTarget) {
        dispatchMove(selectedSquare, square);
        setSelectedSquare(null);
        return;
      }

      if (isOwnedPiece) {
        setSelectedSquare(square);
        return;
      }

      setSelectedSquare(null);
    };

    const handlePieceMouseDown = (event: React.MouseEvent<HTMLImageElement>) => {
      if (!canInteract || !isOwnedPiece) {
        return;
      }

      setDragPointer({ x: event.clientX, y: event.clientY });
      suppressClickRef.current = true;
      dropHandledRef.current = false;
      draggedSquareRef.current = square;
      setDraggedSquare(square);
      setSelectedSquare(square);
      hoveredDropSquareRef.current = null;
      setHoveredDropSquare(null);
    };

    const handleSquareMouseEnter = () => {
      if (!draggedSquareRef.current) {
        return;
      }

      if (legalTargetsRef.current.has(square)) {
        hoveredDropSquareRef.current = square;
        setHoveredDropSquare(square);
      } else {
        hoveredDropSquareRef.current = null;
        setHoveredDropSquare(null);
      }
    };

    const handleSquareMouseUp = () => {
      if (!draggedSquareRef.current) {
        return;
      }
      finalizeDrag(square);
    };

    return (
      <button
        key={square}
        type="button"
        data-square={square}
        aria-label={square}
        onClick={handleClick}
        onMouseEnter={handleSquareMouseEnter}
        onMouseUp={handleSquareMouseUp}
        draggable={false}
        className={[
          "relative aspect-square",
          isLight ? "bg-neutral-200" : "bg-board-dark",
          isSelected ? "outline-2 outline-offset-[-2px] outline-app-purple-strong" : "",
          "cursor-default",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {draggedSquare && isLegalTarget ? <span className="pointer-events-none absolute inset-0 bg-[#8fcea2]/8" /> : null}
        {isHoveredLegalTarget ? (
          <span className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-[#8fcea2]/85" />
        ) : null}

        {piece ? (
          <span className="absolute inset-0 grid place-items-center p-[6%]">
            <img
              src={PIECE_SYMBOLS[`${piece.color}${piece.type}`]}
              alt={`${piece.color === "w" ? "white" : "black"} ${piece.type}`}
              className={[
                "h-full w-full select-none object-contain",
                canInteract && isOwnedPiece ? "cursor-grab active:cursor-grabbing" : "cursor-default",
                draggedSquare === square ? "cursor-grabbing" : "",
                draggedSquare === square ? "opacity-0" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              draggable={false}
              onMouseDown={handlePieceMouseDown}
            />
          </span>
        ) : null}

        {!piece && isLegalTarget ? (
          <span className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="h-3.5 w-3.5 rounded-full bg-[#8fcea2]/80" />
          </span>
        ) : null}
      </button>
    );
  });

  return (
    <section
      className="w-full"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setSelectedSquare(null);
          setDraggedSquare(null);
          setHoveredDropSquare(null);
          suppressClickRef.current = false;
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        // Right-click acts as a quick interaction cancel in this phase.
        setSelectedSquare(null);
        setDraggedSquare(null);
        setHoveredDropSquare(null);
        suppressClickRef.current = false;
      }}
    >
      <div
        className="mx-auto aspect-square"
        style={{
          width: "min(100%, calc(100vh - 165px))",
        }}
      >
        <div className="grid h-full w-full grid-cols-8 overflow-hidden rounded-lg border border-white/10">{cells}</div>
      </div>
      {draggedPiece && dragPointer ? (
        <div
          className="pointer-events-none fixed z-50 h-[clamp(34px,4vw,56px)] w-[clamp(34px,4vw,56px)] -translate-x-1/2 -translate-y-1/2"
          style={{ left: dragPointer.x, top: dragPointer.y }}
        >
          <img
            src={PIECE_SYMBOLS[`${draggedPiece.color}${draggedPiece.type}`]}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.45)]"
            draggable={false}
          />
        </div>
      ) : null}
    </section>
  );
}
