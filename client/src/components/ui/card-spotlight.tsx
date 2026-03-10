import type { HTMLAttributes, PropsWithChildren } from "react";
import { useState } from "react";

import { cn } from "../../lib/utils";

export function CardSpotlight({
  className,
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  const [position, setPosition] = useState({ x: 0, y: 0, opacity: 0 });

  return (
    <div
      className={cn("relative overflow-hidden rounded-2xl", className)}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPosition({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          opacity: 1,
        });
      }}
      onMouseLeave={() => setPosition((prev) => ({ ...prev, opacity: 0 }))}
      {...props}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: position.opacity,
          background: `radial-gradient(500px circle at ${position.x}px ${position.y}px, rgba(122, 92, 255, 0.22), transparent 46%)`,
        }}
      />
      {children}
    </div>
  );
}
