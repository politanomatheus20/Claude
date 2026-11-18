import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, Plus } from "lucide-react";
import { GoalProgress } from "@/components/goal-progress";
import { MonthSwitcher } from "@/components/month-switcher";
import { PageHeader, Stat } from "@/components/page-header";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { monthlySupport, monthlyTraining } from "@/lib/calc";
import { getDashboard } from "@/lib/data";
import { currentMonth, date, money, monthLabel, monthShort, monthTitle } from "@/lib/format";
import { GoalForm } from "./metas/goal-form";

export const metadata: Metadata = { title: "Painel" };

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const { mes } = await searchParams;
  const month = typeof mes === "string" && /^\d{4}-\d{2}$/.test(mes) ? mes : currentMonth();
  const data = await getDashboard(month);
  const monthName = monthLabel(month).split(" de ")[0];

  return (
    <>
      <PageHeader
        eyebrow="Painel"
        title={monthTitle(month)}
        description="A meta considera apenas o suporte mensal e o treinamento de liderança diluído em 12 meses."
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
              </p>
            </div>
            <GoalForm month={month} compact />
          </div>
        )}
      </Card>

      <Card className="mt-4 grid animate-fade-up grid-cols-2 divide-white/[0.06] max-lg:[&>*:nth-child(-n+2)]:border-b max-lg:[&>*]:border-white/[0.06] lg:grid-cols-4 lg:divide-x [animation-delay:60ms]">
        <Stat label="Clientes fechados" value={data.totals.clients} hint="no mês" />
        <Stat label="Receita contratada" value={money(data.totals.revenueCents)} hint="12 meses de contrato" />
        <Stat label="Custo (invoices)" value={money(data.totals.costCents)} />
        <Stat
          label="Resultado"
          value={money(data.totals.resultCents)}
          tone={data.totals.resultCents > 0 ? "positive" : data.totals.resultCents < 0 ? "negative" : undefined}
        />
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="animate-fade-up [animation-delay:120ms]">
          <CardHeader
            title="Fechamentos do mês"
            description="Quanto cada cliente soma na meta"
            action={
              <Button asChild size="sm" variant="secondary">
                <Link href="/clientes/novo">
                  <Plus />
                  Novo cliente
                </Link>
              </Button>
            }
          />
          {data.contributions.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-mist/45">Nenhum cliente fechado neste mês ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="text-left text-xs text-mist/45">
                    <th className="px-5 py-3 font-medium">Cliente</th>
                    <th className="px-3 py-3 font-medium">Pagamento</th>
                    <th className="px-3 py-3 text-right font-medium">Suporte/mês</th>
                    <th className="px-3 py-3 text-right font-medium">Treinamento ÷ 12</th>
                    <th className="px-5 py-3 text-right font-medium">Na meta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {data.contributions.map(({ client, contribution }) => (
                    <tr key={client.id} className="group transition hover:bg-white/[0.02]">
                      <td className="px-5 py-3">
                        <Link href={`/clientes/${client.id}`} className="flex items-center gap-1.5 font-medium hover:text-jelly-teal">
                          {client.name}
                          <ArrowUpRight className="size-3.5 opacity-0 transition group-hover:opacity-60" />
                        </Link>
                        <span className="text-xs text-mist/40">{date(client.closedAt)}</span>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={client.paymentType === "anual" ? "blue" : "neutral"}>{client.paymentType}</Badge>
                      </td>
                      <td className="tabular px-3 py-3 text-right text-mist/80">{money(monthlySupport(client))}</td>
                      <td className="tabular px-3 py-3 text-right text-mist/60">
                        {client.trainingCents > 0 ? money(monthlyTraining(client)) : "—"}
                      </td>
                      <td className="tabular px-5 py-3 text-right font-medium text-jelly-teal">{money(contribution)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="animate-fade-up [animation-delay:180ms]">
          <CardHeader title="Últimos 6 meses" description="Atingido x meta" />
          <History items={data.history} active={month} />
        </Card>
      </div>
    </>
  );
}

function History({
  items,
  active,
}: {
  items: { month: string; achievedCents: number; targetCents: number }[];
  active: string;
}) {
  const max = Math.max(1, ...items.map((i) => Math.max(i.achievedCents, i.targetCents)));
  return (
    <ul className="flex flex-col gap-3.5 px-5 py-5">
      {items.map((i) => {
        const reached = i.targetCents > 0 && i.achievedCents >= i.targetCents;
        return (
          <li key={i.month}>
            <Link href={`/?mes=${i.month}`} className="group block">
              <div className="mb-1.5 flex items-baseline justify-between text-xs">
                <span className={i.month === active ? "font-medium text-mist capitalize" : "text-mist/50 capitalize group-hover:text-mist"}>
                  {monthShort(i.month)}
                </span>
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
                  <span
                    className="absolute -top-0.5 h-2.5 w-0.5 rounded bg-mist/60"
                    style={{ left: `calc(${(i.targetCents / max) * 100}% - 1px)` }}
                    title={`Meta ${money(i.targetCents)}`}
                  />
                ) : null}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
