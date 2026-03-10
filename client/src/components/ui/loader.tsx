import { motion } from "motion/react";

export const LoaderOne = () => {
  const transition = (x: number) => ({
    duration: 1,
    repeat: Infinity,
    repeatType: "loop" as const,
    delay: x * 0.2,
    ease: "easeInOut" as const,
  });

  return (
    <div className="flex items-center gap-2">
      <motion.div
        initial={{ y: 0 }}
        animate={{ y: [0, 10, 0] }}
        transition={transition(0)}
        className="h-3 w-3 rounded-full border border-neutral-500 bg-neutral-300"
      />
      <motion.div
        initial={{ y: 0 }}
        animate={{ y: [0, 10, 0] }}
        transition={transition(1)}
        className="h-3 w-3 rounded-full border border-neutral-500 bg-neutral-300"
      />
      <motion.div
        initial={{ y: 0 }}
        animate={{ y: [0, 10, 0] }}
        transition={transition(2)}
        className="h-3 w-3 rounded-full border border-neutral-500 bg-neutral-300"
      />
    </div>
  );
};
