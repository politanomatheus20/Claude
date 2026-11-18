import Link from "next/link";
import { addMonths, format, parse } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { currentMonth, monthShort } from "@/lib/format";

export function MonthSwitcher({ month, basePath = "/" }: { month: string; basePath?: string }) {
  const d = parse(month, "yyyy-MM", new Date());
  const prev = format(addMonths(d, -1), "yyyy-MM");
  const next = format(addMonths(d, 1), "yyyy-MM");
  const isCurrent = month === currentMonth();
  const btn =
    "flex size-8 items-center justify-center rounded-md text-mist/60 transition hover:bg-white/[0.06] hover:text-mist";

  return (
    <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
      <Link href={`${basePath}?mes=${prev}`} className={btn} aria-label="Mês anterior">
        <ChevronLeft className="size-4" />
      </Link>
      <span className="tabular min-w-20 text-center text-sm font-medium capitalize">{monthShort(month)}</span>
      <Link href={`${basePath}?mes=${next}`} className={btn} aria-label="Próximo mês">
        <ChevronRight className="size-4" />
      </Link>
      {!isCurrent ? (
        <Link href={basePath} className="ml-1 rounded-md px-2 py-1 text-xs text-jelly-teal hover:bg-jelly-teal/10">
          Hoje
        </Link>
      ) : null}
    </div>
  );
}
