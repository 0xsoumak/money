import { animate, motion, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";

/**
 * One motion language for the whole app: short, eased, no overshoot.
 * Same curve as the mobile app.
 */
export const ease = [0.2, 0, 0, 1] as const;
export const tween = {
  fast: { duration: 0.12, ease },
  base: { duration: 0.2, ease },
  slow: { duration: 0.32, ease },
} as const;

/** Press feedback for anything tappable. */
export const tap = { scale: 0.97 } as const;

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
      duration: 0.6,
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

/** A quick fade when a page's content first appears. No lift, no stagger. */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={tween.base}
    >
      {children}
    </motion.div>
  );
}
