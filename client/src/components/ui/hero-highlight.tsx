import type { HTMLAttributes, PropsWithChildren } from "react";

import { cn } from "../../lib/utils";

export function HeroHighlight({
  className,
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden",
        className,
      )}
      {...props}
    >
      <div className="relative">{children}</div>
    </div>
  );
}

export function Highlight({
  className,
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLSpanElement>>) {
  return (
    <span
      className={cn(
        "border-l-4 border-violet-500 pl-3 text-app-purple-soft",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
