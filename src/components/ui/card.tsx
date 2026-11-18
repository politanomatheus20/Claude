import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("rounded-[var(--radius-card)] border border-white/[0.07] bg-abyss shadow-[var(--shadow-card)]", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-white/[0.06] px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {description ? <p className="mt-0.5 text-[13px] text-mist/50">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.ComponentProps<"span"> & { tone?: "neutral" | "teal" | "blue" | "warn" | "danger" }) {
  const tones = {
    neutral: "border-white/10 bg-white/[0.04] text-mist/70",
    teal: "border-jelly-teal/25 bg-jelly-teal/10 text-jelly-teal",
    blue: "border-jelly-sky/30 bg-jelly-blue/15 text-[#7fb0ff]",
    warn: "border-warn/25 bg-warn/10 text-warn",
    danger: "border-danger/25 bg-danger/10 text-danger",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium tracking-wide uppercase",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
