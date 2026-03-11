import * as React from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";

import { cn } from "../../lib/utils";

type Option = {
  value: string;
  label: string;
  icon?: string;
  description?: string;
};

type FluidDropdownProps = {
  value: string;
  options: readonly Option[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
};

function useClickAway(
  ref: React.RefObject<HTMLElement>,
  handler: (event: MouseEvent | TouchEvent) => void,
) {
  React.useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler(event);
    };

    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="4" fill="currentColor" />
    </svg>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { when: "beforeChildren", staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

const ROW_HEIGHT = 52;

export function Component({
  value,
  options,
  onValueChange,
  disabled = false,
  ariaLabel = "dropdown",
  className,
}: FluidDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [hoveredValue, setHoveredValue] = React.useState<string | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useClickAway(dropdownRef, () => setIsOpen(false));

  const selectedOption = React.useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [options, value],
  );

  const activeValue = hoveredValue ?? selectedOption?.value;
  const activeIndex = Math.max(0, options.findIndex((option) => option.value === activeValue));

  const handleClose = React.useCallback(() => {
    setIsOpen(false);
    setHoveredValue(null);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("relative w-full", className)} ref={dropdownRef}>
        <button
          type="button"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          disabled={disabled}
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            "flex h-11 w-full items-center justify-between rounded-xl border px-3 text-sm outline-none transition-all",
            "border-white/10 bg-[#2b2f37] text-white hover:border-white/20",
            "focus-visible:border-[var(--color-app-purple-strong)] focus-visible:ring-2 focus-visible:ring-[var(--color-app-purple-strong)]/30",
            "disabled:cursor-not-allowed disabled:opacity-55",
            isOpen && "border-white/25 bg-[#313641]",
          )}
        >
          <span className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center text-base">
              {selectedOption?.icon ?? "•"}
            </span>
            <span className="flex items-center gap-2">
              <span>{selectedOption?.label ?? "select"}</span>
              {selectedOption?.description ? (
                <span className="text-[11px] text-white/60">
                  {selectedOption.description}
                </span>
              ) : null}
            </span>
          </span>
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex h-5 w-5 items-center justify-center text-white/70"
          >
            <ChevronDownIcon className="h-4 w-4" />
          </motion.span>
        </button>

        <AnimatePresence>
          {isOpen ? (
            <motion.div
              initial={{ opacity: 1, y: 0, height: 0 }}
              animate={{
                opacity: 1,
                y: 0,
                height: "auto",
                transition: { type: "spring", stiffness: 500, damping: 30, mass: 1 },
              }}
              exit={{
                opacity: 0,
                y: 0,
                height: 0,
                transition: { type: "spring", stiffness: 500, damping: 30, mass: 1 },
              }}
              className="absolute top-full right-0 left-0 z-50 mt-2"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  handleClose();
                }
              }}
            >
              <motion.div
                className="w-full rounded-xl border border-white/10 bg-[#2b2f37] p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.24)]"
                initial={{ borderRadius: 10 }}
                animate={{ borderRadius: 12, transition: { duration: 0.2 } }}
                style={{ transformOrigin: "top" }}
              >
                <motion.div
                  className="relative py-1"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <motion.div
                    layoutId="hover-highlight"
                    className="absolute inset-x-1 rounded-lg bg-white/10"
                    animate={{ y: activeIndex * ROW_HEIGHT, height: ROW_HEIGHT }}
                    transition={{ type: "spring", bounce: 0.15, duration: 0.45 }}
                  />
                  {options.map((option) => (
                    <motion.button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={value === option.value}
                      onClick={() => {
                        onValueChange(option.value);
                        handleClose();
                      }}
                      onHoverStart={() => setHoveredValue(option.value)}
                      onHoverEnd={() => setHoveredValue(null)}
                      whileTap={{ scale: 0.98 }}
                      variants={itemVariants}
                      className={cn(
                        "relative flex h-[52px] w-full items-center justify-between rounded-lg px-3 text-left text-sm transition-colors",
                        value === option.value || hoveredValue === option.value
                          ? "text-white"
                          : "text-white/70",
                      )}
                    >
                      <span className="flex items-center gap-2.5">
                        <span
                          className={cn("inline-flex h-7 w-7 items-center justify-center text-base")}
                        >
                          {option.icon ?? <DotIcon className="h-3.5 w-3.5 text-white/60" />}
                        </span>
                        <span>{option.label}</span>
                      </span>
                      {option.description ? (
                        <span
                          className={cn(
                            "text-[11px]",
                            value === option.value ? "text-app-purple-soft/95" : "text-white/60",
                          )}
                        >
                          {option.description}
                        </span>
                      ) : null}
                    </motion.button>
                  ))}
                </motion.div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
