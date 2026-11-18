"use client";

import { animate, useMotionValue, useReducedMotion, useTransform, motion } from "motion/react";
import { useEffect } from "react";

/** Número monetário que "conta" até o novo valor quando os dados mudam. */
export function AnimatedMoney({ cents, className }: { cents: number; className?: string }) {
  const reduce = useReducedMotion();
  const value = useMotionValue(reduce ? cents : 0);
  const text = useTransform(value, (v) =>
    (Math.round(v) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
  );

  useEffect(() => {
    if (reduce) {
      value.set(cents);
      return;
    }
    const controls = animate(value, cents, { duration: 1.1, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [cents, reduce, value]);

  return <motion.span className={className}>{text}</motion.span>;
}
