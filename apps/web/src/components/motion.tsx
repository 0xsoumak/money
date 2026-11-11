import { animate, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";

/** Shared springs so everything moves with the same personality: quick, a little bouncy. */
export const spring = {
  snappy: { type: "spring", stiffness: 520, damping: 32, mass: 0.7 },
  soft: { type: "spring", stiffness: 260, damping: 26 },
  bouncy: { type: "spring", stiffness: 600, damping: 18 },
} as const;

/** Press feedback for anything tappable. */
export const tap = { scale: 0.95 } as const;

/**
 * Counts from the previous value to the new one, so a total "rolls" when it
 * changes. First render shows the final value; only changes animate.
 */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (reduce || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const controls = animate(from.current, value, {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1],
      // Whole currency units while rolling, so paise don't flicker; exact at the end.
      onUpdate: (v) => setShown(Math.round(v / 100) * 100),
      onComplete: () => setShown(value),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, reduce]);

  return <>{format(shown)}</>;
}

/** Fades and lifts children in when they mount. `i` staggers siblings. */
export function Reveal({
  children,
  i = 0,
  className,
}: {
  children: ReactNode;
  i?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring.soft, delay: i * 0.06 }}
    >
      {children}
    </motion.div>
  );
}
