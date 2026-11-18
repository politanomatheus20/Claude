import { cn } from "@/lib/utils";

const control =
  "w-full rounded-lg border border-white/10 bg-abyss-deep/60 px-3 text-sm text-mist placeholder:text-mist/30 transition-[border,box-shadow] outline-none hover:border-white/15 focus:border-jelly-teal/60 focus:shadow-[0_0_0_3px_rgb(53_232_200/0.12)] aria-[invalid=true]:border-danger/60 disabled:opacity-50";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(control, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(control, "min-h-20 py-2.5 leading-relaxed", className)} {...props} />;
}

/** Input monetário com prefixo R$. Aceita "1.234,56". */
export function MoneyInput({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-mist/40">R$</span>
      <input inputMode="decimal" autoComplete="off" className={cn(control, "tabular h-10 pl-9", className)} {...props} />
    </div>
  );
}

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(
          control,
          "h-10 cursor-pointer appearance-none pr-9 [&>option]:bg-abyss [&>option]:text-mist",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-mist/40"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="m4 6 4 4 4-4" />
      </svg>
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string[] | string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-mist/80">
        {label}
      </label>
      {children}
      {message ? (
        <p className="text-xs text-danger">{message}</p>
      ) : hint ? (
        <p className="text-xs text-mist/40">{hint}</p>
      ) : null}
    </div>
  );
}
