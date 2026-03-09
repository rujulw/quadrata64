import { useRef, type ReactNode } from "react";

import { cn } from "../../lib/utils";

type GlareCardProps = {
  children: ReactNode;
  className?: string;
};

export function GlareCard({ children, className }: GlareCardProps) {
  const isInside = useRef(false);
  const elementRef = useRef<HTMLDivElement>(null);

  const setVars = (rx: number, ry: number, mx: number, my: number, opacity: number) => {
    if (!elementRef.current) return;

    elementRef.current.style.setProperty("--r-x", `${rx}deg`);
    elementRef.current.style.setProperty("--r-y", `${ry}deg`);
    elementRef.current.style.setProperty("--m-x", `${mx}%`);
    elementRef.current.style.setProperty("--m-y", `${my}%`);
    elementRef.current.style.setProperty("--glare-opacity", `${opacity}`);
  };

  return (
    <div
      ref={elementRef}
      className="relative isolate w-full [perspective:800px]"
      style={{
        ["--r-x" as string]: "0deg",
        ["--r-y" as string]: "0deg",
        ["--m-x" as string]: "50%",
        ["--m-y" as string]: "50%",
        ["--glare-opacity" as string]: "0",
      }}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const px = ((event.clientX - rect.left) / rect.width) * 100;
        const py = ((event.clientY - rect.top) / rect.height) * 100;
        const dx = px - 50;
        const dy = py - 50;

        setVars(dy * 0.04, -dx * 0.04, px, py, 0.12);
      }}
      onPointerEnter={() => {
        isInside.current = true;
      }}
      onPointerLeave={() => {
        isInside.current = false;
        setVars(0, 0, 50, 50, 0);
      }}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border border-white/12 bg-[#24272d] transition-transform duration-200 ease-out [transform:rotateX(var(--r-x))_rotateY(var(--r-y))]",
          className,
        )}
      >
        <div className="relative z-10">{children}</div>
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-[var(--glare-opacity)] transition-opacity duration-200"
          style={{
            background:
              "radial-gradient(circle at var(--m-x) var(--m-y), rgba(255,255,255,0.22), rgba(255,255,255,0) 42%)",
          }}
        />
      </div>
    </div>
  );
}
