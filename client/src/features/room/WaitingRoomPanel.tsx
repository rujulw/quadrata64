import { useMemo, useState } from "react";

import { GlareCard } from "../../components/ui/glare-card";
import { LoaderOne } from "../../components/ui/loader";

type WaitingRoomPanelProps = {
  onToggleReady: () => void;
};

export function WaitingRoomPanel({ onToggleReady }: WaitingRoomPanelProps) {
  const [timeControl, setTimeControl] = useState("rapid");
  const [isMatching, setIsMatching] = useState(false);
  const [isTimeMenuOpen, setIsTimeMenuOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    if (timeControl === "bullet") return "bullet - 1 min";
    if (timeControl === "traditional") return "traditional - 10 min";
    return "rapid - 3 min";
  }, [timeControl]);

  return (
    <GlareCard className="p-5 lg:min-h-90">
      <div className="space-y-5">
        <div>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight text-white">matchmaking</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">queue up for a match!</p>
        </div>

        <div>
          <div className="relative mt-2">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-[#2b2f37] px-3 py-2.5 text-sm text-white transition-colors hover:border-white/20"
              onClick={() => setIsTimeMenuOpen((prev) => !prev)}
              disabled={isMatching}
            >
              <span>{selectedLabel}</span>
              <span className="text-white/55">{isTimeMenuOpen ? "▲" : "▼"}</span>
            </button>

            {isTimeMenuOpen ? (
              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 rounded-xl border border-white/10 bg-[#2b2f37] py-1">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-white/85 hover:bg-white/8"
                  onClick={() => {
                    setTimeControl("bullet");
                    setIsTimeMenuOpen(false);
                  }}
                >
                  bullet - 1 min
                </button>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-white/85 hover:bg-white/8"
                  onClick={() => {
                    setTimeControl("traditional");
                    setIsTimeMenuOpen(false);
                  }}
                >
                  traditional - 10 min
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="min-h-7">
          {isMatching ? (
            <div className="flex items-center gap-3 text-sm text-white/75">
              <LoaderOne />
              <span>matching...</span>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className="mx-auto w-fit min-w-40 rounded-xl bg-app-purple-strong px-7 py-2.5 text-lg font-semibold text-white transition-opacity hover:opacity-90"
          onClick={() => {
            setIsMatching(true);
            onToggleReady();
          }}
          disabled={isMatching}
        >
          {isMatching ? "queued" : "ready up"}
        </button>
      </div>
    </GlareCard>
  );
}
