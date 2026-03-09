import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

import { cn } from "../../lib/utils";

type ButtonVariant = "default" | "secondary";
type ButtonSize = "default" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClassName: Record<ButtonVariant, string> = {
  default:
    "bg-[var(--color-app-purple-strong)] text-white hover:brightness-110 border border-[var(--color-app-purple-strong)]",
  secondary:
    "bg-transparent text-[var(--color-app-text)] border border-[var(--color-panel-border)] hover:bg-white/5",
};

const sizeClassName: Record<ButtonSize, string> = {
  default: "h-10 px-5 text-sm",
  lg: "h-11 px-7 text-sm",
};

export function Button({
  variant = "default",
  size = "default",
  className,
  children,
  ...props
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold lowercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-60",
        variantClassName[variant],
        sizeClassName[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
