import { useMemo, useState } from "react";

import { Component as FluidDropdown } from "../../components/ui/fluid-dropdown";
import { LoaderOne } from "../../components/ui/loader";
import type { MoveFeedEntry, PlayerColor } from "../board";

type WaitingRoomPanelProps = {
  onToggleReady: () => void;
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

function getStatusLabel(gameStatus: "active" | "finished", gameTurn: PlayerColor) {
  if (gameStatus === "finished") return "Finished";
  return `${gameTurn} to move`;
}

export function WaitingRoomPanel({
  onToggleReady,
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
  roomPhase,
  gameTurn,
  gameStatus,
  terminalResultLabel,
  drawOfferLabel,
  moveFeed,
}: WaitingRoomPanelProps) {
  const [timeControl, setTimeControl] = useState<(typeof TIME_CONTROL_OPTIONS)[number]["value"]>(
    "rapid",
  );

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
    <section className="relative w-full overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:min-h-144">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.05),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />

      <div className="relative flex h-full flex-col p-6">
        <div className="mb-6">
          <h2 className="text-[2rem] font-semibold tracking-[-0.04em] text-white">matchmaking</h2>
        </div>

        <div className="mb-5 rounded-2xl border border-white/10 bg-black/20 p-4 shadow-inner shadow-black/10">
          <div>
            <FluidDropdown
              ariaLabel="time control"
              value={timeControl}
              onValueChange={(value) => setTimeControl(value as typeof timeControl)}
              options={TIME_CONTROL_OPTIONS}
              disabled={isMatching || !canReady}
              className="mx-auto w-full max-w-80"
            />
          </div>

          <div className="mt-3 flex min-h-8 items-center">
            {isMatching ? (
              <div className="inline-flex items-center gap-3 rounded-full border border-app-purple-soft/20 bg-app-purple-soft/10 px-3 py-1.5 text-sm text-white/80">
                <LoaderOne />
                <span>matching...</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-[#111318]/70">
          <div className="flex items-center justify-center border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium tracking-[0.12em] text-white/80 lowercase">
              <span
                className={[
                  "h-2.5 w-2.5 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.35)]",
                  gameStatus === "finished"
                    ? "bg-app-purple-soft/80"
                    : gameTurn === "white"
                      ? "bg-white/90"
                      : "bg-zinc-900 ring-1 ring-white/20",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
              <span>{getStatusLabel(gameStatus, gameTurn)}</span>
            </div>
          </div>

          <div className="border-b border-white/10 px-4 py-3">
            {terminalResultLabel ? (
              <p className="text-sm font-medium text-app-purple-soft/95">{terminalResultLabel}</p>
            ) : drawOfferLabel ? (
              <p className="text-sm font-medium text-[#b8d7c2]">{drawOfferLabel}</p>
            ) : null}
          </div>

          <div className="max-h-56 overflow-y-auto">
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
                      "grid grid-cols-[42px_1fr_1fr] items-center gap-3 px-4 py-3 text-sm transition-colors",
                      index % 2 === 0 ? "bg-white/2.5" : "bg-transparent",
                      "hover:bg-white/4",
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
        </div>

        <div className="mt-auto space-y-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={onResign}
              disabled={!canResign}
              className="rounded-lg border border-red-300/20 bg-red-300/8 px-3 py-1.5 text-xs font-medium tracking-wide text-red-100 transition hover:bg-red-300/15 disabled:cursor-not-allowed disabled:opacity-45"
            >
              resign
            </button>

            {canAcceptDraw || canDeclineDraw ? (
              <>
                <button
                  type="button"
                  onClick={onAcceptDraw}
                  disabled={!canAcceptDraw}
                  className="rounded-lg border border-emerald-300/20 bg-emerald-300/8 px-3 py-1.5 text-xs font-medium tracking-wide text-emerald-100 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  accept draw
                </button>
                <button
                  type="button"
                  onClick={onDeclineDraw}
                  disabled={!canDeclineDraw}
                  className="rounded-lg border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-medium tracking-wide text-white/85 transition hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  decline draw
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onOfferDraw}
                disabled={!canOfferDraw}
                className="rounded-lg border border-[#b8d7c2]/25 bg-[#b8d7c2]/10 px-3 py-1.5 text-xs font-medium tracking-wide text-[#d8f0df] transition hover:bg-[#b8d7c2]/18 disabled:cursor-not-allowed disabled:opacity-45"
              >
                offer draw
              </button>
            )}
          </div>

          <p className="text-center text-[11px] uppercase tracking-[0.16em] text-white/35">
            phase: {roomPhase}
          </p>

          <button
            type="button"
            aria-label={isMatching ? "queued" : isReady ? "unready" : "ready up"}
            className="mx-auto block h-auto! rounded-xl bg-app-purple-strong px-8! py-4! text-4xl! font-bold! leading-none text-white shadow-[0_10px_28px_rgba(124,95,255,0.45)] hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-55"
            onClick={onToggleReady}
            disabled={!canReady}
          >
            ready up
          </button>
        </div>
      </div>
    </section>
  );
}
