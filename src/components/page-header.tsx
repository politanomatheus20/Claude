export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-jelly-teal uppercase">
            <span className="h-px w-5 bg-jelly-teal/60" />
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-mist/55">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="flex flex-col gap-1.5 px-5 py-4">
      <p className="text-xs text-mist/50">{label}</p>
      <p
        className={
          "tabular text-xl font-semibold tracking-tight " +
          (tone === "positive" ? "text-jelly-teal" : tone === "negative" ? "text-danger" : "")
        }
      >
        {value}
      </p>
      {hint ? <p className="text-xs text-mist/40">{hint}</p> : null}
    </div>
  );
}
