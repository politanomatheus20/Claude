"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import type { GoalProgress as Progress } from "@/lib/calc";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AnimatedMoney } from "./animated-number";
import { TentaclesCanvas } from "./tentacles-canvas";

const pct = (r: number) => `${(r * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export function GoalProgress({ progress, monthName }: { progress: Progress; monthName: string }) {
  const reduce = useReducedMotion();
  const p = progress;
  const width = `${p.ratio * 100}%`;
  const transition = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 60, damping: 18, mass: 1 };

  const headline = p.reached
    ? p.exceededCents > 0
      ? `Meta de ${monthName} batida, com ${money(p.exceededCents)} acima.`
      : `Meta de ${monthName} batida.`
    : `Faltam ${money(p.remainingCents)} para bater a meta de ${monthName}.`;

  return (
    <div className="relative isolate overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-full opacity-70 sm:w-3/4" aria-hidden="true">
        <TentaclesCanvas strands={6} from="right" band={[0.05, 0.75]} reach={0.62} seed={5} intensity={p.ratio} />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-mist/45 uppercase">Atingido no mês</p>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-3">
            <AnimatedMoney cents={p.achievedCents} className="tabular text-4xl font-semibold tracking-tight sm:text-5xl" />
            <span className="tabular text-base text-mist/45">de {money(p.targetCents)}</span>
          </p>
        </div>
        <p
          className={cn(
            "tabular font-display text-5xl leading-none sm:text-6xl",
            p.reached ? "text-jelly-teal" : "text-brand-gradient",
          )}
          aria-label={`${pct(p.rawRatio)} da meta`}
        >
          {pct(p.rawRatio)}
        </p>
      </div>

      <p className="mt-5 text-[15px] text-mist/75" role="status" aria-live="polite">
        {headline}
      </p>

      {/* Barra */}
      <div className="relative mt-10 sm:pb-14">
        <div
          className="relative h-3.5 rounded-full bg-white/[0.06] shadow-[inset_0_1px_2px_rgb(0_0_0/0.5)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={p.targetCents / 100}
          aria-valuenow={p.achievedCents / 100}
          aria-valuetext={`${money(p.achievedCents)} de ${money(p.targetCents)}`}
        >
          <motion.div
            className="bg-brand-gradient absolute inset-y-0 left-0 rounded-full"
            initial={{ width: 0 }}
            animate={{ width }}
            transition={transition}
          >
            {!reduce && p.ratio > 0 ? (
              <span className="absolute inset-0 overflow-hidden rounded-full" aria-hidden="true">
                <span className="absolute inset-y-0 -left-1/3 w-1/3 animate-[shimmer_2.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/35 to-transparent" />
              </span>
            ) : null}
          </motion.div>

          {/* Cabeça da barra: brilho + valor atual */}
          <motion.div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            initial={{ left: "0%" }}
            animate={{ left: width }}
            transition={transition}
            aria-hidden="true"
          >
            <span className="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-jelly-teal/40 blur-md" />
            <span className="relative block size-4 rounded-full border-2 border-abyss-deep bg-[#c8fff5] shadow-[0_0_12px_rgb(53_232_200/0.9)]" />
          </motion.div>

          {/* Marcador da metade */}
          <span className="absolute top-1/2 left-1/2 h-6 w-px -translate-y-1/2 bg-mist/30" aria-hidden="true" />
          {/* Marcador do fim */}
          <span className="absolute top-1/2 right-0 h-6 w-px -translate-y-1/2 bg-mist/30" aria-hidden="true" />
        </div>

        <Marker
          className="hidden sm:block left-1/2 -translate-x-1/2 text-center"
          label="Metade da meta"
          done={p.halfReached}
          value={p.halfReached ? "Atingida" : `Faltam ${money(p.remainingToHalfCents)}`}
        />
        <Marker
          className="hidden sm:block right-0 text-right"
          label="Meta"
          done={p.reached}
          value={p.reached ? (p.exceededCents > 0 ? `+${money(p.exceededCents)}` : "Batida") : `Faltam ${money(p.remainingCents)}`}
        />
        <div className="absolute top-7 left-0 hidden text-left sm:block">
          <p className="text-[11px] tracking-[0.14em] text-mist/40 uppercase">Início</p>
          <p className="tabular mt-1 text-[13px] text-mist/60">R$ 0</p>
        </div>
      </div>

      {/* Mobile: marcadores empilhados para não sobrepor */}
      <div className="mt-5 grid grid-cols-2 gap-4 sm:hidden">
        <Marker
          className="static"
          label="Metade da meta"
          done={p.halfReached}
          value={p.halfReached ? "Atingida" : `Faltam ${money(p.remainingToHalfCents)}`}
        />
        <Marker
          className="static text-right"
          label="Meta"
          done={p.reached}
          value={p.reached ? (p.exceededCents > 0 ? `+${money(p.exceededCents)}` : "Batida") : `Faltam ${money(p.remainingCents)}`}
        />
      </div>

      <style>{`@keyframes shimmer{0%{transform:translateX(0)}60%,100%{transform:translateX(400%)}}`}</style>
    </div>
  );
}

function Marker({ label, value, done, className }: { label: string; value: string; done: boolean; className?: string }) {
  return (
    <div className={cn("absolute top-7", className)}>
      <p className="text-[11px] tracking-[0.14em] text-mist/40 uppercase">{label}</p>
      <p
        className={cn(
          "tabular mt-1 inline-flex items-center gap-1 text-[13px] font-medium",
          done ? "text-jelly-teal" : "text-mist",
        )}
      >
        {done ? <Check className="size-3.5" /> : null}
        {value}
      </p>
    </div>
  );
}
