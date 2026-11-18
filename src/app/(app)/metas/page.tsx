import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { listGoals } from "@/lib/data";
import { currentMonth, dateTime, money, monthTitle } from "@/lib/format";
import { GoalForm } from "./goal-form";

export const metadata: Metadata = { title: "Metas" };

export default async function GoalsPage() {
  const goals = await listGoals();
  const month = currentMonth();
  const current = goals.find((g) => g.month === month);

  return (
    <>
      <PageHeader
        eyebrow="Metas"
        title="Metas mensais"
      />

      <Card className="animate-fade-up">
        <CardHeader title="Definir ou alterar meta" />
        <div className="px-5 py-5">
          <GoalForm month={month} targetCents={current?.targetCents} />
        </div>
      </Card>

      <Card className="mt-4 animate-fade-up [animation-delay:60ms]">
        <CardHeader title="Histórico" description={`${goals.length} ${goals.length === 1 ? "meta cadastrada" : "metas cadastradas"}`} />
        {goals.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-mist/45">Nenhuma meta cadastrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mist/45">
                  <th className="px-5 py-3 font-medium">Mês</th>
                  <th className="px-3 py-3 text-right font-medium">Meta</th>
                  <th className="px-3 py-3 text-right font-medium">Atingido</th>
                  <th className="w-[28%] px-3 py-3 font-medium">Progresso</th>
                  <th className="px-5 py-3 text-right font-medium">Atualizada em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {goals.map((g) => (
                  <tr key={g.month} className="transition hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <Link href={`/?mes=${g.month}`} className="font-medium hover:text-jelly-teal">
                        {monthTitle(g.month)}
                      </Link>
                    </td>
                    <td className="tabular px-3 py-3 text-right">{money(g.targetCents)}</td>
                    <td className="tabular px-3 py-3 text-right text-mist/75">{money(g.progress.achievedCents)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-1.5 flex-1 rounded-full bg-white/[0.06]">
                          <div
                            className={
                              g.progress.reached
                                ? "absolute inset-y-0 left-0 rounded-full bg-jelly-teal"
                                : "bg-brand-gradient absolute inset-y-0 left-0 rounded-full"
                            }
                            style={{ width: `${g.progress.ratio * 100}%` }}
                          />
                        </div>
                        {g.progress.reached ? (
                          <Badge tone="teal">Batida</Badge>
                        ) : (
                          <span className="tabular w-12 text-right text-xs text-mist/55">
                            {Math.round(g.progress.rawRatio * 100)}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-mist/40">
                      {g.updatedAt ? dateTime(g.updatedAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
