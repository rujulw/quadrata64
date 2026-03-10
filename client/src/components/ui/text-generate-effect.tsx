import { motion } from "motion/react";

import { cn } from "../../lib/utils";

interface TextGenerateEffectProps {
  words: string;
  className?: string;
}

export function TextGenerateEffect({ words, className }: TextGenerateEffectProps) {
  return (
    <h1 className={cn("text-4xl font-semibold leading-tight tracking-tight sm:text-6xl", className)}>
      {words.split(" ").map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          initial={{ opacity: 0, filter: "blur(8px)", y: 8 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          transition={{ delay: index * 0.055, duration: 0.32, ease: "easeOut" }}
          className="mr-2 inline-block"
        >
          {word}
        </motion.span>
      ))}
    </h1>
  );
}
