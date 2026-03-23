import { useEffect, useMemo, useRef, useState } from "react";
import { Flag, Handshake } from "lucide-react";

import { Component as FluidDropdown } from "../../components/ui/fluid-dropdown";
import { LoaderOne, MatchFoundBurst, MatchWaveText } from "../../components/ui/loader";
import type { MoveFeedEntry, PlayerColor } from "../board";

type WaitingRoomPanelProps = {
  onToggleReady: (timeControl: "bullet" | "rapid" | "traditional") => void;
  onTimeControlChange: (timeControl: "bullet" | "rapid" | "traditional") => void;
  onResign: () => void;
  onOfferDraw: () => void;
  onAcceptDraw: () => void;
  onDeclineDraw: () => void;
  isMatching: boolean;
  isReady: boolean;
  canReady: boolean;
  canResign: boolean;
  canOfferDraw: boolean;
  canAcceptDraw: boolean;
  canDeclineDraw: boolean;
  selectedTimeControl: "bullet" | "rapid" | "traditional";
  whiteClockMs: number;
  blackClockMs: number;
  runningClock: PlayerColor | null;
  timeoutColor: PlayerColor | null;
  roomPhase: "waiting" | "active";
  gameTurn: PlayerColor;
  gameStatus: "active" | "finished";
  terminalResultLabel: string | null;
  drawOfferLabel: string | null;
  moveFeed: MoveFeedEntry[];
};

const TIME_CONTROL_OPTIONS = [
  { value: "bullet", label: "bullet", icon: "⚡", description: "1 min" },
  { value: "rapid", label: "rapid", icon: "⚡", description: "3 min" },
  { value: "traditional", label: "traditional", icon: "⚡", description: "10 min" },
] as const;

function getStatusLabel(
  gameStatus: "active" | "finished",
  gameTurn: PlayerColor,
  terminalResultLabel: string | null,
  timeoutColor: PlayerColor | null,
) {
  if (timeoutColor) return `${timeoutColor} out of time`;
  if (gameStatus === "finished") return terminalResultLabel ?? "game over";
  return `${gameTurn} to move`;
}

function formatClock(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms));
  const totalSeconds = Math.ceil(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function WaitingRoomPanel({
  onToggleReady,
  onTimeControlChange,
  onResign,
  onOfferDraw,
  onAcceptDraw,
  onDeclineDraw,
  isMatching,
  isReady,
  canReady,
  canResign,
  canOfferDraw,
  canAcceptDraw,
  canDeclineDraw,
  selectedTimeControl,
  whiteClockMs,
  blackClockMs,
  runningClock,
  timeoutColor,
  roomPhase,
  gameTurn,
  gameStatus,
  terminalResultLabel,
  drawOfferLabel,
  moveFeed,
}: WaitingRoomPanelProps) {
  const [isMatchFoundAnimating, setIsMatchFoundAnimating] = useState(false);
  const [allowFlipToMatchFace, setAllowFlipToMatchFace] = useState(roomPhase === "active");
  const phaseRef = useRef(roomPhase);
  const matchFoundTimeoutRef = useRef<number | null>(null);
  const showMatchFace = roomPhase === "active" && allowFlipToMatchFace;

  useEffect(() => {
    const previous = phaseRef.current;
    phaseRef.current = roomPhase;

    if (roomPhase === "waiting") {
      if (matchFoundTimeoutRef.current !== null) {
        window.clearTimeout(matchFoundTimeoutRef.current);
        matchFoundTimeoutRef.current = null;
      }
      setIsMatchFoundAnimating(false);
      setAllowFlipToMatchFace(false);
      return;
    }

    if (roomPhase === "active" && previous === "waiting") {
      setAllowFlipToMatchFace(false);
      setIsMatchFoundAnimating(true);
      if (matchFoundTimeoutRef.current !== null) {
        window.clearTimeout(matchFoundTimeoutRef.current);
      }
      matchFoundTimeoutRef.current = window.setTimeout(() => {
        setIsMatchFoundAnimating(false);
        setAllowFlipToMatchFace(true);
        matchFoundTimeoutRef.current = null;
      }, 950);
      return;
    }

    if (roomPhase === "active") {
      setAllowFlipToMatchFace(true);
    }
  }, [roomPhase]);

  useEffect(() => {
    return () => {
      if (matchFoundTimeoutRef.current !== null) {
        window.clearTimeout(matchFoundTimeoutRef.current);
      }
    };
  }, []);

  const moveRows = useMemo(() => {
    const sorted = [...moveFeed].sort((a, b) => a.ply - b.ply);
    const rows = new Map<number, { moveNumber: number; white: string | null; black: string | null }>();

    for (const entry of sorted) {
      const moveNumber = Math.max(1, Math.ceil(entry.ply / 2));
      const current = rows.get(moveNumber) ?? { moveNumber, white: null, black: null };
      const isWhitePly = entry.ply % 2 === 1;

      if (isWhitePly) {
        current.white = entry.notation;
      } else {
        current.black = entry.notation;
      }

      rows.set(moveNumber, current);
    }

    return Array.from(rows.values()).slice(-8);
  }, [moveFeed]);

  return (
    <section className="h-full w-full overflow-hidden rounded-[28px] border border-white/10 bg-[#121418]">
      <div className="relative flex h-full flex-col p-6">
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div
            className={[
              "rounded-xl border bg-black/30 px-3 py-2.5 text-center",
              runningClock === "white" && !timeoutColor
                ? "border-white/35"
                : "border-white/10",
              timeoutColor === "white" ? "border-red-300/40 text-red-100" : "text-white/90",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <p className="font-mono text-2xl leading-none tabular-nums">{formatClock(whiteClockMs)}</p>
          </div>
          <div
            className={[
              "rounded-xl border bg-black/30 px-3 py-2.5 text-center",
              runningClock === "black" && !timeoutColor
                ? "border-white/35"
                : "border-white/10",
              timeoutColor === "black" ? "border-red-300/40 text-red-100" : "text-white/72",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <p className="font-mono text-2xl leading-none tabular-nums">{formatClock(blackClockMs)}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 shadow-inner shadow-black/10">
          <div>
            <FluidDropdown
              ariaLabel="time control"
              value={selectedTimeControl}
              onValueChange={(value) => onTimeControlChange(value as typeof selectedTimeControl)}
              options={TIME_CONTROL_OPTIONS}
              disabled={isMatching || !canReady}
              className="mx-auto w-full max-w-80"
            />
          </div>
        </div>

        <div className="mt-auto h-92 perspective-distant">
          <div
            className={[
              "relative h-full w-full rounded-2xl border border-white/10 bg-[#111318] transition-transform duration-700 transform-3d",
              showMatchFace ? "transform-[rotateY(180deg)]" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div
              aria-hidden={showMatchFace}
              className="absolute inset-0 flex flex-col justify-between p-5 backface-hidden"
            >
              <div />

              <div className="flex min-h-12 items-center justify-center">
                {isMatchFoundAnimating ? (
                  <MatchFoundBurst />
                ) : isMatching ? (
                  <div className="flex flex-col items-center gap-1.5">
                    <MatchWaveText text="finding match" />
                    <LoaderOne />
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                aria-label={isMatching ? "queued" : isReady ? "unready" : "ready up"}
                className="mx-auto block h-auto! rounded-xl bg-app-purple-strong px-8! py-4! text-4xl! font-bold! leading-none text-white hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-55"
                onClick={() => onToggleReady(selectedTimeControl)}
                disabled={!canReady}
              >
                {isMatching ? "queued" : isReady ? "unready" : "play!"}
              </button>
            </div>

            <div
              aria-hidden={!showMatchFace}
              className="absolute inset-0 transform-[rotateY(180deg)] backface-hidden"
            >
              <div className="flex h-full flex-col overflow-hidden">
                <div className="flex items-center justify-center border-b border-white/10 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-medium tracking-[0.12em] text-white/80 lowercase">
                    <span
                      className={[
                        "h-2.5 w-2.5 rounded-full",
                        gameStatus === "finished"
                          ? "bg-app-purple-soft/80"
                          : gameTurn === "white"
                            ? "bg-white/90"
                            : "bg-zinc-900 ring-1 ring-white/20",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    />
                    <span>{getStatusLabel(gameStatus, gameTurn, terminalResultLabel, timeoutColor)}</span>
                  </div>
                </div>

                {gameStatus !== "finished" && drawOfferLabel ? (
                  <div className="px-4 py-2">
                    <p className="text-xs font-medium text-[#b8d7c2]">{drawOfferLabel}</p>
                  </div>
                ) : null}

                <div className="min-h-0 flex-1 overflow-y-auto">
                  {moveRows.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm text-white/40">No moves yet</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-[42px_1fr_1fr] border-b border-white/10 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/35">
                        <span>#</span>
                        <span>White</span>
                        <span>Black</span>
                      </div>

                      {moveRows.map((row, index) => (
                        <div
                          key={row.moveNumber}
                          className={[
                            "grid grid-cols-[42px_1fr_1fr] items-center gap-3 px-4 py-3 text-sm",
                            index % 2 === 0 ? "bg-white/2.5" : "bg-transparent",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <span className="font-medium text-white/35">{row.moveNumber}.</span>

                          <span className="truncate font-semibold tracking-tight text-white/90">
                            {row.white ?? <span className="text-white/20">-</span>}
                          </span>

                          <span className="truncate font-semibold tracking-tight text-white/72">
                            {row.black ?? <span className="text-white/20">-</span>}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 px-4 py-2">
                  <button
                    type="button"
                    aria-label="resign"
                    onClick={onResign}
                    disabled={!canResign}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-300/20 bg-red-300/8 text-red-100 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Flag className="h-4 w-4" />
                  </button>

                  {canAcceptDraw || canDeclineDraw ? (
                    <>
                      <button
                        type="button"
                        aria-label="accept draw"
                        onClick={onAcceptDraw}
                        disabled={!canAcceptDraw}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-emerald-300/20 bg-emerald-300/8 text-emerald-100 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Handshake className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="decline draw"
                        onClick={onDeclineDraw}
                        disabled={!canDeclineDraw}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-white/8 text-lg leading-none text-white/85 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      aria-label="offer draw"
                      onClick={onOfferDraw}
                      disabled={!canOfferDraw}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#b8d7c2]/25 bg-[#b8d7c2]/10 text-[#d8f0df] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <Handshake className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
