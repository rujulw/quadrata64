import { motion } from "motion/react";
import { useLocation, useNavigate } from "react-router-dom";

import { CardSpotlight } from "../components/ui/card-spotlight";
import { Button } from "../components/ui/button";
import { DottedMap } from "../components/ui/dotted-map";
import { HeroHighlight, Highlight } from "../components/ui/hero-highlight";

const BOARD_SIZE = 64;
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.05,
    },
  },
};
const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
    },
  },
};

export default function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isWaitingView = location.pathname === "/play";

  const cells = Array.from({ length: BOARD_SIZE }, (_, index) => {
    const row = Math.floor(index / 8);
    const col = index % 8;
    const isLight = (row + col) % 2 === 0;

    return (
      <div
        key={index}
        className={`aspect-square ${
          isLight ? "bg-neutral-200" : "bg-board-dark"
        }`}
      />
    );
  });

  return (
    <CardSpotlight className="min-h-screen rounded-none">
      <DottedMap
        className="pointer-events-none absolute inset-0 text-[#d5d8df] opacity-55 blur-[1px] mask-[radial-gradient(circle_at_50%_40%,white_30%,transparent_82%)]"
        markers={[]}
        dotRadius={0.18}
      />
      <motion.main
        className="relative min-h-screen text-white"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <section className="mx-auto grid max-w-7xl grid-cols-1 gap-3 px-4 py-6 sm:px-6 lg:grid-cols-[0.98fr_0.92fr] lg:items-center">
          <motion.div variants={staggerItem}>
            <HeroHighlight className="p-0">
              <motion.h1
                initial={{
                  opacity: 0,
                  y: 20,
                }}
                animate={{
                  opacity: 1,
                  y: [20, -5, 0],
                }}
                transition={{
                  duration: 0.5,
                  ease: [0.4, 0.0, 0.2, 1],
                }}
                className="max-w-3xl text-left text-2xl font-bold text-app-text md:text-4xl lg:text-[3.15rem] lg:leading-[1.12]"
              >
                <span className="block">
                  <Highlight>live chess</Highlight>
                  <span className="ml-3">in real time.</span>
                </span>
                <span className="mt-3 block">
                  <Highlight>analysis</Highlight>
                  <span className="ml-3">without limits.</span>
                </span>
                <span className="mt-3 block">
                  <Highlight>quantum chess</Highlight>
                  <span className="ml-3">for what comes next.</span>
                </span>
              </motion.h1>
              <p className="mt-6 max-w-2xl text-sm leading-7 text-app-text-muted md:text-base">
                play live games. study every move. experiment beyond classical chess.
              </p>
              <div className="mt-8 flex items-center justify-center lg:-ml-25">
                <Button
                  size="lg"
                  className="h-auto! py-4! px-8! rounded-xl bg-app-purple-strong text-4xl! font-bold! leading-none shadow-[0_10px_28px_rgba(124,95,255,0.45)] hover:cursor-pointer"
                  onClick={() => navigate("/play")}
                  disabled={isWaitingView}
                >
                  {isWaitingView ? "searching..." : "play now!"}
                </Button>
              </div>
            </HeroHighlight>
          </motion.div>

          <motion.div variants={staggerItem} className="w-full">
            <div className="mx-auto w-full max-w-140">
              <div className="grid grid-cols-8 overflow-hidden rounded-xl border border-panel-border">
                {cells}
              </div>
            </div>
          </motion.div>
        </section>
      </motion.main>
    </CardSpotlight>
  );
}
