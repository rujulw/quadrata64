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

type PlanningArrow = {
  from: string;
  to: string;
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

function displayCoordsFromSquare(square: string, orientation: BoardOrientation): { row: number; col: number } {
  const file = square[0];
  const rank = Number(square[1]);
  const fileIndex = FILES.indexOf(file as (typeof FILES)[number]);
  if (fileIndex < 0 || Number.isNaN(rank)) {
    return { row: 0, col: 0 };
  }

  const col = orientation === "white" ? fileIndex : 7 - fileIndex;
  const row = orientation === "white" ? 8 - rank : rank - 1;
  return { row, col };
}

function squareCenterPercent(square: string, orientation: BoardOrientation): { x: number; y: number } {
  const { row, col } = displayCoordsFromSquare(square, orientation);
  return {
    x: ((col + 0.5) / 8) * 100,
    y: ((row + 0.5) / 8) * 100,
  };
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
  const placeAnimationTimeoutRef = useRef<number | null>(null);
  const dragCleanupFrameRef = useRef<number | null>(null);
  const dragStartPointerRef = useRef<{ x: number; y: number } | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const activePointerTargetRef = useRef<HTMLElement | null>(null);
  const [optimisticFen, setOptimisticFen] = useState<string | null>(null);
  const [placedSquare, setPlacedSquare] = useState<string | null>(null);
  const [draggedPiecePreview, setDraggedPiecePreview] = useState<BoardPiece | null>(null);
  const [isDraggingVisual, setIsDraggingVisual] = useState(false);
  const [planningArrows, setPlanningArrows] = useState<PlanningArrow[]>([]);
  const [planningHighlights, setPlanningHighlights] = useState<string[]>([]);
  const [planningStartSquare, setPlanningStartSquare] = useState<string | null>(null);
  const [planningHoverSquare, setPlanningHoverSquare] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSquare(null);
    setDraggedSquare(null);
    setHoveredDropSquare(null);
    setDragPointer(null);
    setOptimisticFen(null);
    setPlacedSquare(null);
    setDraggedPiecePreview(null);
    setIsDraggingVisual(false);
    setPlanningArrows([]);
    setPlanningHighlights([]);
    setPlanningStartSquare(null);
    setPlanningHoverSquare(null);
    dragStartPointerRef.current = null;
    if (placeAnimationTimeoutRef.current !== null) {
      window.clearTimeout(placeAnimationTimeoutRef.current);
      placeAnimationTimeoutRef.current = null;
    }
    if (dragCleanupFrameRef.current !== null) {
      window.cancelAnimationFrame(dragCleanupFrameRef.current);
      dragCleanupFrameRef.current = null;
    }
    suppressClickRef.current = false;
    dropHandledRef.current = false;
  }, [snapshot.fen]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (isDraggingVisual) {
      document.body.classList.add("is-piece-dragging");
    } else {
      document.body.classList.remove("is-piece-dragging");
    }

    return () => {
      document.body.classList.remove("is-piece-dragging");
    };
  }, [isDraggingVisual]);

  useEffect(() => {
    return () => {
      if (placeAnimationTimeoutRef.current !== null) {
        window.clearTimeout(placeAnimationTimeoutRef.current);
      }
      if (dragCleanupFrameRef.current !== null) {
        window.cancelAnimationFrame(dragCleanupFrameRef.current);
      }
      dragStartPointerRef.current = null;
      releaseActivePointerCapture();
    };
  }, []);

  const displayFen = optimisticFen ?? snapshot.fen;
  const snapshotPieces = useMemo(() => parseBoardPieces(snapshot.fen), [snapshot.fen]);
  const pieces = useMemo(() => parseBoardPieces(displayFen), [displayFen]);
  const moveSourceSquare = draggedSquare ?? selectedSquare;
  const legalTargets = useMemo(
    () => deriveLegalTargets(snapshot.fen, moveSourceSquare),
    [snapshot.fen, moveSourceSquare],
  );
  const canInteract =
    snapshot.status === "active" &&
    Boolean(playerColor) &&
    snapshot.turn === playerColor &&
    optimisticFen === null;
  const ownedColor = playerColor === "white" ? "w" : "b";
  const draggedPiece = draggedPiecePreview;
  const planningHighlightSet = useMemo(() => new Set(planningHighlights), [planningHighlights]);

  const releaseActivePointerCapture = () => {
    const pointerTarget = activePointerTargetRef.current;
    const pointerId = activePointerIdRef.current;
    if (!pointerTarget || pointerId === null) {
      activePointerTargetRef.current = null;
      activePointerIdRef.current = null;
      return;
    }

    if (typeof pointerTarget.releasePointerCapture === "function") {
      try {
        pointerTarget.releasePointerCapture(pointerId);
      } catch {
        // Ignore cases where capture is already gone.
      }
    }

    activePointerTargetRef.current = null;
    activePointerIdRef.current = null;
  };

  const clearPlanningMarks = () => {
    setPlanningArrows([]);
    setPlanningHighlights([]);
  };

  const resetPlanningInteractionState = () => {
    setPlanningStartSquare(null);
    setPlanningHoverSquare(null);
  };

  const resetMoveInteractionState = () => {
    setSelectedSquare(null);
    setDraggedSquare(null);
    setHoveredDropSquare(null);
    setDragPointer(null);
    setDraggedPiecePreview(null);
    setIsDraggingVisual(false);
    draggedSquareRef.current = null;
    hoveredDropSquareRef.current = null;
    dragStartPointerRef.current = null;
    releaseActivePointerCapture();
    suppressClickRef.current = false;
    dropHandledRef.current = false;
  };

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
    const chess = new Chess();
    try {
      chess.load(snapshot.fen);
      const moved = chess.move({ from, to, promotion: reachesBackRank ? "q" : undefined });
      if (moved) {
        setOptimisticFen(chess.fen());
      }
    } catch {
      // If local simulation fails, still emit intent and rely on server snapshot.
    }
    setPlacedSquare(to);
    if (placeAnimationTimeoutRef.current !== null) {
      window.clearTimeout(placeAnimationTimeoutRef.current);
    }
    placeAnimationTimeoutRef.current = window.setTimeout(() => {
      setPlacedSquare(null);
      placeAnimationTimeoutRef.current = null;
    }, 180);
    onMoveIntent({ from, to, promotion: reachesBackRank ? "q" : undefined });
  };

  const finalizeDrag = (dropSquare: string | null) => {
    const sourceSquare = draggedSquareRef.current;
    const currentLegalTargets = legalTargetsRef.current;
    const isValidDrop = Boolean(sourceSquare && dropSquare && currentLegalTargets.has(dropSquare));
    if (sourceSquare && dropSquare && currentLegalTargets.has(dropSquare) && !dropHandledRef.current) {
      dropHandledRef.current = true;
      dispatchMove(sourceSquare, dropSquare);
      setSelectedSquare(null);
    }

    const cleanupDragState = () => {
      setDraggedSquare(null);
      setHoveredDropSquare(null);
      setDragPointer(null);
      setDraggedPiecePreview(null);
      setIsDraggingVisual(false);
      dragStartPointerRef.current = null;
      draggedSquareRef.current = null;
      hoveredDropSquareRef.current = null;
      releaseActivePointerCapture();
    };
    if (isValidDrop && typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      if (dragCleanupFrameRef.current !== null) {
        window.cancelAnimationFrame(dragCleanupFrameRef.current);
      }
      dragCleanupFrameRef.current = window.requestAnimationFrame(() => {
        cleanupDragState();
        dragCleanupFrameRef.current = null;
      });
    } else {
      cleanupDragState();
    }
    window.setTimeout(() => {
      suppressClickRef.current = false;
      dropHandledRef.current = false;
    }, 0);
  };

  const getSquareAtPoint = ({
    clientX,
    clientY,
    target,
  }: {
    clientX: number;
    clientY: number;
    target: EventTarget | null;
  }): string | null => {
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

    const squareElement = document.elementFromPoint(clientX, clientY)?.closest("[data-square]") as
      | HTMLElement
      | null;
    return squareElement?.dataset.square ?? null;
  };

  useEffect(() => {
    if (!draggedSquare || typeof window === "undefined") {
      return;
    }

    const handleWindowPointerMove = (event: PointerEvent) => {
      if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) {
        return;
      }

      const start = dragStartPointerRef.current;
      if (start && !isDraggingVisual) {
        const deltaX = event.clientX - start.x;
        const deltaY = event.clientY - start.y;
        if (Math.hypot(deltaX, deltaY) >= 4) {
          setIsDraggingVisual(true);
        }
      }
      setDragPointer({ x: event.clientX, y: event.clientY });
      const hoveredSquare = getSquareAtPoint({
        clientX: event.clientX,
        clientY: event.clientY,
        target: event.target,
      });
      if (hoveredSquare && legalTargets.has(hoveredSquare)) {
        hoveredDropSquareRef.current = hoveredSquare;
        setHoveredDropSquare(hoveredSquare);
      } else {
        hoveredDropSquareRef.current = null;
        setHoveredDropSquare(null);
      }
    };

    const handleWindowPointerEnd = (event: PointerEvent) => {
      if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) {
        return;
      }

      const dropSquare = getSquareAtPoint({
        clientX: event.clientX,
        clientY: event.clientY,
        target: event.target,
      }) ?? hoveredDropSquareRef.current;
      finalizeDrag(dropSquare);
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerEnd);
    window.addEventListener("pointercancel", handleWindowPointerEnd);

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerEnd);
      window.removeEventListener("pointercancel", handleWindowPointerEnd);
    };
  }, [draggedSquare, isDraggingVisual, legalTargets]);

  useEffect(() => {
    if (!planningStartSquare || typeof window === "undefined") {
      return;
    }

    const handlePlanningMouseUp = (event: MouseEvent) => {
      if (event.button !== 2) {
        return;
      }

      const dropSquare =
        getSquareAtPoint({
          clientX: event.clientX,
          clientY: event.clientY,
          target: event.target,
        }) ?? planningHoverSquare ?? planningStartSquare;
      if (!dropSquare) {
        resetPlanningInteractionState();
        return;
      }

      if (dropSquare === planningStartSquare) {
        setPlanningHighlights((prev) =>
          prev.includes(dropSquare) ? prev.filter((sq) => sq !== dropSquare) : [...prev, dropSquare],
        );
      } else {
        setPlanningArrows((prev) => {
          const exists = prev.some((arrow) => arrow.from === planningStartSquare && arrow.to === dropSquare);
          if (exists) {
            return prev.filter((arrow) => !(arrow.from === planningStartSquare && arrow.to === dropSquare));
          }
          return [...prev, { from: planningStartSquare, to: dropSquare }];
        });
      }

      resetPlanningInteractionState();
    };

    window.addEventListener("mouseup", handlePlanningMouseUp);
    return () => {
      window.removeEventListener("mouseup", handlePlanningMouseUp);
    };
  }, [planningHoverSquare, planningStartSquare]);

  const cells = Array.from({ length: BOARD_SIZE }, (_, index) => {
    const square = squareFromDisplayIndex(index, orientation);
    const isLight = isLightSquare(square);
    const piece = pieces[square];
    const isSelected = selectedSquare === square;
    const isLegalTarget = legalTargets.has(square);
    const isHoveredLegalTarget = hoveredDropSquare === square && Boolean(draggedSquare) && isLegalTarget;
    const isPlaceTarget = Boolean(selectedSquare) && isLegalTarget && !draggedSquare;
    const isOwnedPiece = Boolean(piece && piece.color === ownedColor);
    const isPlannedHighlight = planningHighlightSet.has(square);

    const handleClick = () => {
      if (planningStartSquare) {
        return;
      }
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

    const handlePiecePointerDown = (event: React.PointerEvent<HTMLImageElement>) => {
      if (event.button !== 0 || !event.isPrimary) {
        return;
      }
      if (planningStartSquare) {
        return;
      }
      if (!canInteract || !isOwnedPiece) {
        return;
      }

      event.preventDefault();
      if (typeof event.currentTarget.setPointerCapture === "function") {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Ignore environments that do not support capture.
        }
      }

      activePointerIdRef.current = event.pointerId;
      activePointerTargetRef.current = event.currentTarget;
      setDragPointer({ x: event.clientX, y: event.clientY });
      dragStartPointerRef.current = { x: event.clientX, y: event.clientY };
      suppressClickRef.current = true;
      dropHandledRef.current = false;
      draggedSquareRef.current = square;
      setDraggedSquare(square);
      setDraggedPiecePreview(piece);
      setIsDraggingVisual(false);
      setSelectedSquare(square);
      hoveredDropSquareRef.current = null;
      setHoveredDropSquare(null);
    };

    const handleSquareMouseEnter = () => {
      if (planningStartSquare) {
        setPlanningHoverSquare(square);
      }

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

    const handleSquareMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (event.button !== 2) {
        return;
      }
      event.preventDefault();
      resetMoveInteractionState();
      setPlanningStartSquare(square);
      setPlanningHoverSquare(square);
    };

    return (
      <button
        key={square}
        type="button"
        data-square={square}
        aria-label={square}
        onClick={handleClick}
        onMouseDown={handleSquareMouseDown}
        onMouseEnter={handleSquareMouseEnter}
        draggable={false}
        className={[
          "relative aspect-square",
          isLight ? "bg-neutral-200" : "bg-board-dark",
          isSelected ? "outline-2 -outline-offset-2 outline-app-purple-strong" : "",
          isPlaceTarget ? "cursor-grab" : "cursor-default",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {draggedSquare && isDraggingVisual && isLegalTarget ? (
          <span className="pointer-events-none absolute inset-0 bg-[#8fcea2]/8" />
        ) : null}
        {isPlannedHighlight ? (
          <span
            data-plan-highlight={square}
            className="pointer-events-none absolute inset-0 bg-app-purple-soft/12 ring-2 ring-inset ring-app-purple-soft/70"
          />
        ) : null}
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
                draggedSquare === square && isDraggingVisual ? "opacity-0" : "",
                placedSquare === square ? "piece-place-animate" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              draggable={false}
              onPointerDown={handlePiecePointerDown}
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
      data-testid="board-root"
      className="w-full"
      onMouseDownCapture={(event) => {
        if (event.button !== 0) {
          return;
        }
        const target = event.target;
        const inSquare =
          target instanceof Element ? Boolean(target.closest("[data-square]")) : false;
        if (inSquare) {
          clearPlanningMarks();
          resetPlanningInteractionState();
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        const target = event.target;
        const inSquare =
          target instanceof Element ? Boolean(target.closest("[data-square]")) : false;
        if (!inSquare) {
          resetPlanningInteractionState();
          clearPlanningMarks();
        }
      }}
    >
      <div
        className="relative mx-auto aspect-square"
        style={{
          width: "min(100%, calc(100vh - 165px))",
        }}
      >
        <svg
          className="pointer-events-none absolute inset-0 z-20"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <marker
              id="board-plan-arrow-head"
              markerWidth="4"
              markerHeight="4"
              refX="0"
              refY="2"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M0,0 L4,2 L0,4 Z" fill="rgba(143,206,162,0.95)" />
            </marker>
          </defs>
          {planningArrows.map((arrow) => {
            const from = squareCenterPercent(arrow.from, orientation);
            const to = squareCenterPercent(arrow.to, orientation);
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.hypot(dx, dy) || 1;
            const pullBack = 1;
            const endX = to.x - (dx / len) * pullBack;
            const endY = to.y - (dy / len) * pullBack;
            return (
              <line
                key={`${arrow.from}-${arrow.to}`}
                data-plan-arrow={`${arrow.from}-${arrow.to}`}
                x1={from.x}
                y1={from.y}
                x2={endX}
                y2={endY}
                stroke="rgba(143,206,162,0.95)"
                strokeWidth="1.6"
                strokeLinecap="butt"
                markerEnd="url(#board-plan-arrow-head)"
              />
            );
          })}
          {planningStartSquare && planningHoverSquare && planningStartSquare !== planningHoverSquare ? (
            (() => {
              const from = squareCenterPercent(planningStartSquare, orientation);
              const to = squareCenterPercent(planningHoverSquare, orientation);
              const dx = to.x - from.x;
              const dy = to.y - from.y;
              const len = Math.hypot(dx, dy) || 1;
              const pullBack = 1;
              const endX = to.x - (dx / len) * pullBack;
              const endY = to.y - (dy / len) * pullBack;
              return (
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={endX}
                  y2={endY}
                  stroke="rgba(143,206,162,0.72)"
                  strokeWidth="1.4"
                  strokeDasharray="3 2"
                  strokeLinecap="butt"
                  markerEnd="url(#board-plan-arrow-head)"
                />
              );
            })()
          ) : null}
        </svg>
        <div className="relative z-10 grid h-full w-full grid-cols-8 overflow-hidden rounded-lg border border-white/10">
          {cells}
        </div>
      </div>
      {draggedPiece && dragPointer && isDraggingVisual ? (
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
