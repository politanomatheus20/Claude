"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Tentáculos bioluminescentes — porte do efeito de canvas usado nas seções
 * de datagroup.global (gradiente jelly-blue → jelly-teal com nós de luz).
 */

const BLUE = [2, 79, 250];
const TEAL = [53, 232, 200];
const TAU = Math.PI * 2;
const SEGMENTS = 70;
const PERIOD = 9;

const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function makeGlow() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(160,255,240,1)");
  g.addColorStop(0.25, "rgba(53,232,200,0.55)");
  g.addColorStop(1, "rgba(2,79,250,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return c;
}

export interface TentaclesProps {
  strands?: number;
  from?: "left" | "right";
  band?: [number, number];
  reach?: number;
  seed?: number;
  /** 0..1 — acende os nós proporcionalmente (usado para refletir o progresso da meta). */
  intensity?: number;
  className?: string;
}

export function TentaclesCanvas({
  strands = 6,
  from = "right",
  band = [0.15, 0.85],
  reach = 0.6,
  seed = 3,
  intensity = 1,
  className,
}: TentaclesProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const intensityRef = useRef(intensity);
  const [b0, b1] = band;

  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const glow = makeGlow();
    const rand = rng(seed * 7919 + 13);
    const mid = (b0 + b1) / 2;
    const fromRight = from === "right";

    const lines = Array.from({ length: strands }, (_, i) => {
      const nodes: number[] = [];
      for (let k = 0; nodes.length < 6 && k < 60; k++) {
        const n = 0.18 + rand() * 0.79;
        if (nodes.every((m) => Math.abs(m - n) > 0.08)) nodes.push(n);
      }
      nodes.sort((a, b) => a - b);
      return {
        y0: mid + (rand() - 0.5) * 0.06,
        y1: b0 + ((i + 0.2 + rand() * 0.6) / strands) * (b1 - b0),
        len: reach * (0.75 + rand() * 0.3),
        amp: 16 + rand() * 30,
        k1: 0.7 + rand() * 0.6,
        k2: 1.8 + rand() * 1.2,
        w1: 0.5 + rand() * 0.35,
        w2: 0.8 + rand() * 0.5,
        ph1: rand() * TAU,
        ph2: rand() * TAU,
        width: 1.2 + rand() * 1.4,
        nodes,
        seed: rand(),
      };
    });

    let w = 0;
    let h = 0;
    let dpr = 1;
    const pts = new Float32Array((SEGMENTS + 1) * 2);

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
    };

    const draw = (t: number) => {
      const lit = intensityRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";
      const scale = Math.min(1, Math.max(0.4, w / 1200));
      const sway = Math.min(36, 0.04 * h);

      for (const l of lines) {
        for (let s = 0; s <= SEGMENTS; s++) {
          const u = s / SEGMENTS;
          const phase = ((t - u * 1.6 - l.seed * 0.4) * TAU) / PERIOD;
          const along = -0.06 + u * (l.len + 0.06);
          const x = (fromRight ? 1 - along : along) * w;
          const env = 0.15 + 0.85 * u ** 1.3;
          const y =
            (l.y0 + (l.y1 - l.y0) * Math.sqrt(u) * (1 - 0.06 * Math.cos(phase))) * h +
            sway * Math.sin(phase) +
            l.amp * scale * env * (Math.sin(l.k1 * u * TAU - t * l.w1 + l.ph1) + 0.4 * Math.sin(l.k2 * u * TAU - t * l.w2 + l.ph2));
          pts[s * 2] = x;
          pts[s * 2 + 1] = y;
        }
        for (let s = 0; s < SEGMENTS; s++) {
          const u = s / SEGMENTS;
          const c = BLUE.map((v, i) => Math.round(v + (TEAL[i] - v) * u));
          const a = 0.55 * (1 - u * 0.7) * smooth(0, 0.08, u);
          ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${a})`;
          ctx.lineWidth = l.width * (1 - u * 0.7);
          ctx.beginPath();
          ctx.moveTo(pts[s * 2], pts[s * 2 + 1]);
          ctx.lineTo(pts[s * 2 + 2], pts[s * 2 + 3]);
          ctx.stroke();
        }

        const pulse = ((t * 0.07 + l.seed * 1.4) % 1.6) - 0.2;
        ctx.globalCompositeOperation = "lighter";
        for (const n of l.nodes) {
          const idx = Math.min(SEGMENTS, Math.round(n * SEGMENTS));
          const x = pts[idx * 2];
          const y = pts[idx * 2 + 1];
          const on = smooth(n - 0.25, n + 0.05, lit * 1.25);
          const flicker = reduced ? 0 : 0.12 * Math.sin(t * 1.3 + n * 40 + l.seed * 20);
          const wave = reduced ? 0 : Math.exp(-((n - pulse) ** 2) * 90);
          const g = Math.min(1, 0.12 + 0.68 * on + flicker + 0.6 * wave);
          const size = (8 + 18 * g) * (1 - n * 0.3);
          ctx.globalAlpha = g * 0.8;
          ctx.drawImage(glow, x - size / 2, y - size / 2, size, size);
          ctx.globalAlpha = Math.min(1, g + 0.1);
          ctx.fillStyle = "rgb(200,255,245)";
          ctx.beginPath();
          ctx.arc(x, y, 0.9 + 1.3 * g * (1 - n * 0.4), 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    };

    let raf = 0;
    let visible = false;
    let start = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      draw((now - start) / 1000);
    };
    const sync = () => {
      const run = visible && !document.hidden && !reduced;
      if (run && !raf) {
        start = performance.now() - 20000 * Math.random();
        raf = requestAnimationFrame(loop);
      } else if (!run && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const ro = new ResizeObserver(() => {
      resize();
      draw(0);
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      sync();
    });
    io.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    resize();
    draw(0);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [strands, from, b0, b1, reach, seed]);

  return <canvas ref={ref} aria-hidden="true" className={cn("h-full w-full mix-blend-screen", className)} />;
}
