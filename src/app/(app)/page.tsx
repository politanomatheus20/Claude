import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, Plus } from "lucide-react";
import { GoalProgress } from "@/components/goal-progress";
import { MonthSwitcher } from "@/components/month-switcher";
import { PageHeader, Stat } from "@/components/page-header";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDashboard } from "@/lib/data";
import { currentMonth, date, money, monthLabel, monthShort, monthTitle, percent } from "@/lib/format";
import { billingLabel, licenseLabel, termLabel } from "@/lib/labels";
import { GoalForm } from "./metas/goal-form";

export const metadata: Metadata = { title: "Painel" };

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const { mes } = await searchParams;
  const month = typeof mes === "string" && /^\d{4}-\d{2}$/.test(mes) ? mes : currentMonth();
  const data = await getDashboard(month);
  const monthName = monthLabel(month).split(" de ")[0];
  const t = data.monthTotals;
  const pf = data.portfolio;

  return (
    <>
      <PageHeader
        eyebrow="Painel"
        title={monthTitle(month)}
        actions={<MonthSwitcher month={month} />}
      />

      <Card className="animate-fade-up px-5 py-6 sm:px-8 sm:py-8">
        {data.goal ? (
          <GoalProgress progress={data.progress} monthName={monthName} />
        ) : (
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium tracking-[0.16em] text-mist/45 uppercase">Sem meta definida</p>
              <p className="mt-2 max-w-md text-[15px] text-mist/70">
                Defina quanto precisa ser fechado em {monthName} para acompanhar o progresso.
                {data.progress.achievedCents > 0 ? ` Já somados: ${money(data.progress.achievedCents)}.` : ""}
              </p>
            </div>
            <GoalForm month={month} compact />
          </div>
        )}
      </Card>

      <Card className="mt-4 grid animate-fade-up grid-cols-2 max-lg:[&>*]:border-white/[0.06] max-lg:[&>*:nth-child(-n+4)]:border-b lg:grid-cols-5 lg:divide-x lg:divide-white/[0.06] [animation-delay:60ms]">
        <Stat label="Fechados no mês" value={data.ofMonth.length} hint="contratos e atualizações" />
        <Stat label="Valor anual (L)" value={money(t.annual)} />
        <Stat label="Total licença (R)" value={money(t.licenseTotal)} />
        <Stat label="Consultoria (S)" value={money(t.consulting)} />
        <Stat
          label="Resultado (T)"
          value={money(t.result)}
          hint={`Margem ${percent(t.annual > 0 ? t.result / t.annual : null)}`}
          tone={t.result > 0 ? "positive" : t.result < 0 ? "negative" : undefined}
        />
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 grid-cols-1 gap-4">
          <Card className="animate-fade-up [animation-delay:120ms]">
            <CardHeader
              title="Fechamentos do mês"
              description="Quanto cada contrato soma na meta"
              action={
                <Button asChild size="sm" variant="secondary">
                  <Link href="/clientes/novo">
                    <Plus />
                    Novo cliente
                  </Link>
                </Button>
              }
            />
            {data.ofMonth.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-mist/45">Nenhum contrato assinado neste mês.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-mist/45">
                      <th className="px-5 py-3 font-medium">Cliente</th>
                      <th className="px-3 py-3 font-medium">Modalidade</th>
                      <th className="px-3 py-3 text-right font-medium">Consultoria</th>
                      <th className="px-3 py-3 text-right font-medium">Resultado</th>
                      <th className="px-5 py-3 text-right font-medium">Na meta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {data.ofMonth.map((c) => (
                      <tr key={c.id} className="group transition hover:bg-white/[0.02]">
                        <td className="max-w-64 px-5 py-3">
                          <Link href={`/clientes/${c.clientId}`} className="flex items-center gap-1.5 font-medium hover:text-jelly-teal">
                            <span className="truncate">{c.client.name}</span>
                            <ArrowUpRight className="size-3.5 shrink-0 opacity-0 transition group-hover:opacity-60" />
                          </Link>
                          <span className="text-xs text-mist/40">
                            {c.kind === "atualizacao" ? "Atualização · " : ""}
                            {date((c.signedAt ?? c.startAt)!)}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={c.paymentType === "anual" ? "blue" : "neutral"}>{c.paymentType}</Badge>
                        </td>
                        <td className="tabular px-3 py-3 text-right text-mist/75">{c.calc.consulting ? money(c.calc.consulting) : "—"}</td>
                        <td className={"tabular px-3 py-3 text-right " + (c.calc.result < 0 ? "text-danger" : "text-mist/80")}>{money(c.calc.result)}</td>
                        <td className="tabular px-5 py-3 text-right font-medium text-jelly-teal">{c.calc.goalContribution ? money(c.calc.goalContribution) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="animate-fade-up [animation-delay:160ms]">
            <CardHeader
              title="Carteira total"
              description={`${pf.contracts} contratos · todos os meses`}
              action={
                <Button asChild size="sm" variant="ghost">
                  <Link href="/planilha">Ver planilha</Link>
                </Button>
              }
            />
            <div className="grid grid-cols-2 sm:grid-cols-4">
              <Stat label="Valor anual (L)" value={money(pf.annual)} />
              <Stat label="Total licença (R)" value={money(pf.licenseTotal)} />
              <Stat label="Resultado (T)" value={money(pf.result)} tone={pf.result >= 0 ? "positive" : "negative"} />
              <Stat label="Saldo a receber" value={money(pf.balanceDue)} />
            </div>
          </Card>
        </div>

        <div className="grid h-fit min-w-0 grid-cols-1 gap-4">
          <Card className="animate-fade-up [animation-delay:180ms]">
            <CardHeader title="Últimos 6 meses" description="Atingido x meta" />
            <History items={data.history} active={month} />
          </Card>

          <Card className="animate-fade-up [animation-delay:220ms]">
            <CardHeader title="Atenção" description="Vigências e pendências" />
            <ul className="divide-y divide-white/[0.05] text-sm">
              {data.expiring.slice(0, 5).map((c) => (
                <li key={`e-${c.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <Link href={`/clientes/${c.clientId}`} className="min-w-0 truncate hover:text-jelly-teal">
                    {c.client.name}
                  </Link>
                  <Badge tone={termLabel[c.calc.termStatus].tone}>{c.calc.termStatus === "vencido" ? "Vencido" : `Vence em ${c.calc.daysToExpire}d`}</Badge>
                </li>
              ))}
              {data.pending.slice(0, 6).map((c) => (
                <li key={`p-${c.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <Link href={`/clientes/${c.clientId}`} className="min-w-0 truncate hover:text-jelly-teal">
                    {c.client.name}
                  </Link>
                  <span className="flex shrink-0 gap-1">
                    {c.billingStatus !== "ok" ? <Badge tone={billingLabel[c.billingStatus].tone}>Fat. {billingLabel[c.billingStatus].label.toLowerCase()}</Badge> : null}
                    {c.licenseStatus !== "ok" ? <Badge tone={licenseLabel[c.licenseStatus].tone}>Lic. pendente</Badge> : null}
                  </span>
                </li>
              ))}
              {data.expiring.length + data.pending.length === 0 ? <li className="px-5 py-6 text-center text-mist/45">Nada pendente.</li> : null}
              {data.pending.length > 6 ? (
                <li className="px-5 py-2.5 text-right">
                  <Link href="/planilha" className="text-xs text-jelly-teal hover:underline">
                    +{data.pending.length - 6} pendências na planilha
                  </Link>
                </li>
              ) : null}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

function History({ items, active }: { items: { month: string; achievedCents: number; targetCents: number }[]; active: string }) {
  const max = Math.max(1, ...items.map((i) => Math.max(i.achievedCents, i.targetCents)));
  return (
    <ul className="flex flex-col gap-3.5 px-5 py-5">
      {items.map((i) => {
        const reached = i.targetCents > 0 && i.achievedCents >= i.targetCents;
        return (
          <li key={i.month}>
            <Link href={`/?mes=${i.month}`} className="group block">
              <div className="mb-1.5 flex items-baseline justify-between text-xs">
                <span className={i.month === active ? "font-medium text-mist capitalize" : "text-mist/50 capitalize group-hover:text-mist"}>{monthShort(i.month)}</span>
                <span className="tabular text-mist/50">
                  {money(i.achievedCents)}
                  {i.targetCents > 0 ? <span className="text-mist/30"> / {money(i.targetCents)}</span> : null}
                </span>
              </div>
              <div className="relative h-1.5 rounded-full bg-white/[0.05]">
                <div
                  className={reached ? "absolute inset-y-0 left-0 rounded-full bg-jelly-teal" : "bg-brand-gradient absolute inset-y-0 left-0 rounded-full"}
                  style={{ width: `${(i.achievedCents / max) * 100}%` }}
                />
                {i.targetCents > 0 ? (
                  <span className="absolute -top-0.5 h-2.5 w-0.5 rounded bg-mist/60" style={{ left: `calc(${(i.targetCents / max) * 100}% - 1px)` }} title={`Meta ${money(i.targetCents)}`} />
                ) : null}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
